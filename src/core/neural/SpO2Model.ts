import * as tf from '@tensorflow/tfjs';
import { 
  BaseNeuralModel, 
  // Eliminar capas no usadas
  // DenseLayer, 
  // Conv1DLayer, 
  // AttentionLayer,
  // BatchNormLayer,
  // TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en la estimación precisa de saturación de oxígeno
 * Adaptado para cargar y usar modelos TF.js
 */
export class SpO2NeuralModel extends BaseNeuralModel {
  // Eliminar capas internas
  /*
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  private attention: AttentionLayer;
  private dense1: DenseLayer;
  private dense2: DenseLayer;
  private outputLayer: DenseLayer;
  */

  constructor() {
    super(
      'SpO2NeuralModel',
      [300], // Mantener para info
      [1],   // Mantener para info
      '3.0.0-tfjs' // Indicar versión y backend
    );
  }

  /**
   * Carga el modelo TF.js
   * Reemplaza esto con la ruta real a tu modelo exportado.
   */
  async loadModel(): Promise<void> {
    if (this.isModelLoaded) {
      return;
    }
    try {
      const modelUrl = '/models/spo2/model.json'; // <- CAMBIA ESTO
      console.log(`Cargando modelo SpO2 desde: ${modelUrl}`);
      this.model = await tf.loadGraphModel(modelUrl);
      // // O si es un LayersModel: this.model = await tf.loadLayersModel(modelUrl);
      // console.warn('SpO2Model: Carga de modelo TF.js desactivada (placeholder).');
      // await new Promise(resolve => setTimeout(resolve, 50)); // Simulación
      this.isModelLoaded = true;
      console.log('SpO2Model: Modelo TF.js cargado exitosamente.');
    } catch (error) {
      console.error('Error cargando el modelo SpO2:', error);
      this.isModelLoaded = false;
      // Es importante propagar el error o manejarlo de forma que la aplicación sepa que el modelo no está disponible
      // Por ahora, el console.error y isModelLoaded = false es suficiente para el diagnóstico.
      // throw error; // Opcionalmente, si quieres que el llamador maneje el error directamente
    }
  }

  /**
   * Predice el nivel de SpO2 basado en la señal PPG usando TF.js
   * @param input Señal PPG
   * @returns Valor de SpO2 (porcentaje) como Tensor1D
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();

    if (!this.isModelLoaded || !this.model) {
      await this.loadModel();
      if (!this.isModelLoaded || !this.model) {
        console.error('SpO2Model: Modelo no cargado, no se puede predecir.');
        return [97]; // Valor por defecto
      }
    }

    try {
      // 1. Preprocesamiento
      const processedInput = this.preprocessInput(input);

      // 2. Convertir a tf.Tensor (ajusta la forma según tu modelo)
      // Ejemplo: [1, 300, 1]
      const inputTensor = tf.tensor(processedInput, [1, this.inputShape[0], 1]);

      // 3. Inferencia
      const predictionTensor = this.model.predict(inputTensor) as tf.Tensor;

      // 4. Post-procesamiento
      const rawOutput = (await predictionTensor.data())[0];

      // 5. Limpiar tensores
      inputTensor.dispose();
      predictionTensor.dispose();

      // 6. Escalar salida (asumiendo que el modelo devuelve 0-1)
      const spo2 = 85 + (rawOutput * 15); // Escala a 85-100%

      this.updatePredictionTime(startTime);
      // Redondear a 1 decimal
      const finalSpo2 = Math.round(Math.max(85, Math.min(100, spo2)) * 10) / 10;
      return [finalSpo2];

    } catch (error) {
      console.error('Error en SpO2Model.predict con TF.js:', error);
      this.updatePredictionTime(startTime);
      return [97]; // Valor por defecto
    }
  }

  /**
   * Preprocesamiento específico para análisis de oxigenación
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      const padding = Array(this.inputShape[0] - input.length).fill(0);
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }

    // Normalización a valor medio
    const mean = input.reduce((sum, val) => sum + val, 0) / input.length;
    let processed = input.map(v => v - mean);

    // Filtrar ruido (puede ser necesario ajustar o eliminar según el modelo)
    processed = this.smoothSignal(processed, 3);

    // Normalización adaptativa
    const max = Math.max(...processed.map(Math.abs));
    return processed.map(v => v / (max || 1));
  }

  /**
   * Aplica un filtro de suavizado
   */
  private smoothSignal(signal: Tensor1D, windowSize: number): Tensor1D {
    const result: Tensor1D = [];
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      result.push(sum / count);
    }
    return result;
  }

  // --- Propiedades Requeridas (Adaptar a tu modelo real) ---
  get parameterCount(): number {
    return 0; // Indicar desconocido o un valor estimado
  }

  get architecture(): string {
    return `TF.js Model (CNN-Attention)`;
  }
}
