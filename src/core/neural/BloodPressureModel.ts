
import * as tf from '@tensorflow/tfjs';
import { 
  BaseNeuralModel, 
  Tensor1D 
} from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en la estimación de presión arterial
 * Adaptado para cargar y usar modelos TF.js
 * 
 * IMPORTANTE: Este modelo solo trabaja con datos reales, sin simulación.
 * NO utiliza Math.random() ni ninguna función que genere datos aleatorios.
 */
export class BloodPressureNeuralModel extends BaseNeuralModel {
  // Parámetros de filtrado
  private readonly filterParams = {
    lowCutoff: 0.5,  // Hz - eliminar componente DC
    highCutoff: 5.0, // Hz - mantener componente cardíaca
    samplingRate: 60 // Hz - estimación de tasa de muestreo típica
  };
  
  constructor() {
    super(
      'BloodPressureNeuralModel',
      [300], // 5 segundos de señal @ 60Hz
      [2],   // Salida: [sistólica, diastólica] en mmHg
      '3.1.0-tfjs' // Indicar versión y backend
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
      const modelUrl = '/models/blood-pressure/model.json';
      console.log(`Cargando modelo BloodPressure desde: ${modelUrl}`);
      this.model = await tf.loadGraphModel(modelUrl);
      this.isModelLoaded = true;
      console.log('BloodPressureModel: Modelo cargado exitosamente.');
    } catch (error) {
      console.error('Error cargando el modelo BloodPressure:', error);
      this.isModelLoaded = false;
    }
  }
  
  /**
   * Predice presión arterial sistólica y diastólica usando TF.js
   * @param input Señal PPG
   * @returns [sistólica, diastólica] en mmHg, o [0,0] si no hay estimación confiable
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();
    
    if (!this.isModelLoaded || !this.model) {
      await this.loadModel();
      if (!this.isModelLoaded || !this.model) {
        console.error('BloodPressureModel: Modelo no cargado, no se puede predecir.');
        return [0, 0]; // Indicar fallo
      }
    }
    
    try {
      // 1. Preprocesar entrada
      const processedInput = this.preprocessInput(input);
      
      // 2. Convertir a tf.Tensor (ajusta la forma a tu modelo)
      // Ejemplo: [1, 300, 1]
      const inputTensor = tf.tensor(processedInput, [1, this.inputShape[0], 1]);
      
      // 3. Inferencia
      const predictionTensor = this.model.predict(inputTensor) as tf.Tensor;
      
      // 4. Post-procesamiento (asumiendo salida de 2 valores)
      const outputData = await predictionTensor.data();
      const systolic = outputData[0];
      const diastolic = outputData[1];
      
      // 5. Limpiar tensores
      inputTensor.dispose();
      predictionTensor.dispose();
      
      // Verificar si los resultados son fisiológicamente válidos
      if (isNaN(systolic) || isNaN(diastolic) || systolic <= 0 || diastolic <= 0) {
        console.error('BloodPressureNeuralModel: Resultados inválidos', { systolic, diastolic });
        return [0, 0]; // Indicar que no hay medición
      }
      
      // Verificar rangos fisiológicos sin usar Math
      let validSystolic = systolic;
      if (validSystolic < 80) validSystolic = 0;
      if (validSystolic > 200) validSystolic = 0;
      
      let validDiastolic = diastolic;
      if (validDiastolic < 40) validDiastolic = 0;
      if (validDiastolic > 120) validDiastolic = 0;
      
      if (validSystolic === 0 || validDiastolic === 0) {
        console.error('BloodPressureNeuralModel: Resultados fuera de rango fisiológico', { 
          systolic, diastolic 
        });
        return [0, 0];
      }
      
      // Verificar que la sistólica es mayor que la diastólica
      if (systolic <= diastolic) {
        console.error('BloodPressureNeuralModel: Relación inválida entre sistólica y diastólica', { 
          systolic, diastolic 
        });
        return [0, 0]; // Indicar que no hay medición
      }
      
      // Verificar que la presión de pulso es realista
      const pulsePressure = systolic - diastolic;
      if (pulsePressure < 20 || pulsePressure > 80) {
        console.error('BloodPressureNeuralModel: Presión de pulso no fisiológica', { 
          systolic, diastolic, pulsePressure 
        });
        return [0, 0]; // Indicar que no hay medición
      }
      
      this.updatePredictionTime(startTime);
      
      // Redondear a enteros para consistencia sin usar Math.round
      return [
        systolic > 0 ? (systolic + 0.5) | 0 : 0,
        diastolic > 0 ? (diastolic + 0.5) | 0 : 0
      ];
    } catch (error) {
      console.error('Error en BloodPressureNeuralModel.predict:', error);
      this.updatePredictionTime(startTime);
      return [0, 0]; // Indicar que no hay medición en caso de error
    }
  }
  
  /**
   * Preprocesa la señal para análisis de presión arterial
   * Solo aplica filtrado y normalización, sin manipulación
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    let processedInput: Tensor1D;
    if (input.length < this.inputShape[0]) {
      // Padding con repetición de bordes si es más corta
      processedInput = [...input];
      const lastValue = input[input.length - 1] || 0;
      for (let i = input.length; i < this.inputShape[0]; i++) {
        processedInput.push(lastValue);
      }
    } else if (input.length > this.inputShape[0]) {
      // Tomar solo la parte final si es más larga
      processedInput = input.slice(-this.inputShape[0]);
    } else {
      processedInput = [...input];
    }
    
    // Aplicar filtro paso banda
    processedInput = this.bandpassFilter(processedInput);
    
    // Normalizar si hay un rango significativo
    const min = findMinimum(processedInput);
    const max = findMaximum(processedInput);
    const range = max - min;
    
    if (range > 0.001) { // Solo normalizar si hay un rango significativo
      for (let i = 0; i < processedInput.length; i++) {
        processedInput[i] = (processedInput[i] - min) / range;
      }
    } else {
      // Si no hay rango, centrar en cero
      for (let i = 0; i < processedInput.length; i++) {
        processedInput[i] = 0;
      }
      
      console.log('BloodPressureNeuralModel: Señal con amplitud insuficiente');
    }
    
    return processedInput;
  }
  
  /**
   * Aplica un filtro paso banda mejorado usando coeficientes IIR
   * basados en frecuencias de corte biomédicamente relevantes
   */
  private bandpassFilter(signal: Tensor1D): Tensor1D {
    const { lowCutoff, highCutoff, samplingRate } = this.filterParams;
    
    // Diseño de filtro IIR Butterworth de segundo orden (aproximación simplificada)
    const dt = 1.0 / samplingRate;
    const rc_low = 1.0 / (2.0 * 3.14159 * lowCutoff);
    const rc_high = 1.0 / (2.0 * 3.14159 * highCutoff);
    
    // Coeficientes de filtro
    const alpha_low = dt / (rc_low + dt);
    const alpha_high = rc_high / (rc_high + dt);
    
    // Aplicar filtro
    const filtered: number[] = [];
    let y_prev_low = 0;
    let y_prev_high = 0;
    
    for (let i = 0; i < signal.length; i++) {
      // Paso alto (elimina componente DC)
      let highpass;
      if (i > 0) {
        // Inicializar con el valor actual para el primer elemento
        highpass = alpha_high * (y_prev_high + signal[i] - signal[i-1]);
      } else {
        highpass = signal[i];
      }
      
      // Almacenar para la siguiente iteración
      y_prev_high = highpass;
      
      // Paso bajo (elimina ruido de alta frecuencia)
      const y = y_prev_low + alpha_low * (highpass - y_prev_low);
      y_prev_low = y;
      
      filtered.push(y);
    }
    
    return filtered;
  }
  
  get parameterCount(): number {
    return 0; // Indicar desconocido
  }

  get architecture(): string {
    return `TF.js Model (CNN-BiLSTM-Attention)`;
  }
}

// Funciones auxiliares para evitar dependencia de Math
function findMinimum(values: number[]): number {
  if (!values.length) return 0;
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

function findMaximum(values: number[]): number {
  if (!values.length) return 0;
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}
