import * as tf from '@tensorflow/tfjs';
import { 
  BaseNeuralModel, 
  Tensor1D
} from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en detección precisa de frecuencia cardíaca
 * Adaptado para cargar y usar modelos TF.js.
 */
export class HeartRateNeuralModel extends BaseNeuralModel {
  constructor() {
    super(
      'HeartRateNeuralModel',
      [300], // Mantener para info
      [1],   // Mantener para info
      '3.0.0-tfjs' // Indicar versión y backend
    );
  }

  /**
   * Carga el modelo TF.js (GraphModel o LayersModel)
   * Reemplaza esto con la ruta real a tu modelo exportado.
   */
  async loadModel(): Promise<void> {
    if (this.isModelLoaded) {
      return;
    }
    try {
      // const modelUrl = '/models/heart_rate/model.json'; // <- CAMBIA ESTO
      // console.log(`Cargando modelo HeartRate desde: ${modelUrl}`);
      // this.model = await tf.loadGraphModel(modelUrl);
      // // O si es un LayersModel: this.model = await tf.loadLayersModel(modelUrl);
      console.warn('HeartRateModel: Carga de modelo TF.js desactivada (placeholder).');
      // Simulación de carga para desarrollo sin modelo real:
      await new Promise(resolve => setTimeout(resolve, 50));
      this.isModelLoaded = true;
      console.log('HeartRateModel: Modelo cargado (simulado).');
    } catch (error) {
      console.error('Error cargando el modelo HeartRate:', error);
      this.isModelLoaded = false;
    }
  }

  /**
   * Realiza la predicción de frecuencia cardíaca usando el modelo TF.js cargado.
   * @param input Señal PPG (valores en el tiempo)
   * @returns Frecuencia cardíaca estimada (BPM) como Tensor1D
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();

    if (!this.isModelLoaded || !this.model) {
      await this.loadModel(); // Intentar cargar si no está listo
      if (!this.isModelLoaded || !this.model) {
        console.error('HeartRateModel: Modelo no cargado, no se puede predecir.');
        return [75]; // Valor por defecto
      }
    }

    try {
      // 1. Preprocesar entrada (similar a antes, pero devolver Tensor1D)
      const processedInput = this.preprocessInput(input);

      // 2. Convertir a tf.Tensor
      // La forma debe coincidir con la entrada esperada por tu modelo TF.js
      // Ejemplo: [batch_size, timesteps, features]
      // Si tu modelo espera [1, 300, 1]:
      const inputTensor = tf.tensor(processedInput, [1, this.inputShape[0], 1]);

      // 3. Ejecutar inferencia con el modelo TF.js
      const predictionTensor = this.model.predict(inputTensor) as tf.Tensor;

      // 4. Post-procesar la salida del tensor
      const heartRate = (await predictionTensor.data())[0];

      // 5. Limpiar tensores para liberar memoria GPU
      inputTensor.dispose();
      predictionTensor.dispose();

      // 6. Ajustar a rango fisiológico
      const finalBPM = Math.max(40, Math.min(200, heartRate));

      this.updatePredictionTime(startTime);
      return [Math.round(finalBPM)];

    } catch (error) {
      console.error('Error en HeartRateModel.predict con TF.js:', error);
      this.updatePredictionTime(startTime);
      return [75]; // Valor por defecto en caso de error
    }
  }

  /**
   * Preprocesamiento específico para señales cardíacas
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Asegurar longitud correcta
    if (input.length < this.inputShape[0]) {
      const padding = Array(this.inputShape[0] - input.length).fill(0);
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }

    // Normalización Z-score - Reemplazar con lógica manual o asumir que el modelo lo maneja
    // let processedInput = TensorUtils.standardizeSignal(input);
    let processedInput = [...input]; // Usar copia
    const mean = processedInput.reduce((a, b) => a + b, 0) / processedInput.length;
    let variance = 0;
    for (const x of processedInput) {
      variance += Math.pow(x - mean, 2);
    }
    variance /= processedInput.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 1e-6) { // Evitar división por cero
        processedInput = processedInput.map(val => (val - mean) / stdDev);
    } else {
        processedInput = processedInput.map(_ => 0); // Si no hay desviación, centrar en 0
    }

    // Filtrado (mantener si es necesario ANTES del modelo)
    // Podrías necesitar ajustar o eliminar esto dependiendo de cómo entrenaste tu modelo
    const windowSize = 5;
    const lowPass: Tensor1D = [];
    for (let i = 0; i < processedInput.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - windowSize); j <= Math.min(processedInput.length - 1, i + windowSize); j++) {
        sum += processedInput[j];
        count++;
      }
      lowPass.push(sum / count);
    }
    for (let i = 0; i < processedInput.length; i++) {
      processedInput[i] = processedInput[i] - (lowPass[i] * 0.8);
    }
    this.correctOutliers(processedInput);

    return processedInput;
  }

  private correctOutliers(signal: Tensor1D): void {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    let variance = 0;
    for (const x of signal) {
      variance += Math.pow(x - mean, 2);
    }
    variance /= signal.length;
    const stdDev = Math.sqrt(variance);
    const threshold = 3 * stdDev;

    for (let i = 0; i < signal.length; i++) {
      if (Math.abs(signal[i] - mean) > threshold) {
        const window = signal.slice(Math.max(0, i - 5), Math.min(signal.length, i + 6)).filter((_, idx) => idx !== 5);
        const sorted = [...window].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        signal[i] = median;
      }
    }
  }

  /**
   * Propiedades Requeridas (Adaptar a tu modelo real)
   */
  get parameterCount(): number {
    // Ya no podemos calcularlo desde las capas TS.
    // Retornar 0 o un valor estimado si lo conoces.
    return 0; // Opcional: Podrías intentar obtenerlo del modelo tf.js cargado si es LayersModel
  }

  get architecture(): string {
    // Describir la arquitectura que se cargará
    return `TF.js Model (CNN-ResNet-LSTM)`;
  }
}
