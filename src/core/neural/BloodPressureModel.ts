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
      const modelUrl = '/models/blood-pressure/model.json'; // Corregido para apuntar a blood-pressure
      console.log(`Cargando modelo BloodPressure desde: ${modelUrl}`);
      this.model = await tf.loadGraphModel(modelUrl);
      // // O si es un LayersModel: this.model = await tf.loadLayersModel(modelUrl);
      // console.warn('BloodPressureModel: Carga de modelo TF.js desactivada (placeholder).');
      // await new Promise(resolve => setTimeout(resolve, 50)); // Simulación Eliminada
      this.isModelLoaded = true;
      console.log('BloodPressureModel: Modelo TF.js cargado exitosamente.');
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
      
      // Verificar rangos fisiológicos
      if (systolic < 80 || systolic > 200 || diastolic < 40 || diastolic > 120) {
        console.error('BloodPressureNeuralModel: Resultados fuera de rango fisiológico', { 
          systolic, diastolic 
        });
        return [0, 0]; // Indicar que no hay medición
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
      
      // Redondear a enteros para consistencia
      return [Math.round(systolic), Math.round(diastolic)];
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
    const { min, max } = this.findMinMax(processedInput);
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
    const RC_low = 1.0 / (2 * Math.PI * highCutoff);
    const RC_high = 1.0 / (2 * Math.PI * lowCutoff);
    
    // Coeficientes de filtro paso alto (DC removal)
    const alpha_high = RC_high / (RC_high + dt);
    
    // Coeficientes de filtro paso bajo
    const alpha_low = dt / (RC_low + dt);
    
    // Aplicar filtrado
    const filtered: Tensor1D = [];
    let lastHighpass = 0;
    let lastLowpass = 0;
    
    for (let i = 0; i < signal.length; i++) {
      // Paso alto para eliminar componente DC
      const highpass = alpha_high * (lastHighpass + signal[i] - (i > 0 ? signal[i-1] : signal[i]));
      
      // Paso bajo para eliminar ruido de alta frecuencia
      const lowpass = lastLowpass + alpha_low * (highpass - lastLowpass);
      
      // Actualizar estados
      lastHighpass = highpass;
      lastLowpass = lowpass;
      
      // Guardar valor filtrado
      filtered.push(lowpass);
    }
    
    return filtered;
  }
  
  /**
   * Encuentra valores mínimo y máximo en un array
   */
  private findMinMax(array: Tensor1D): { min: number; max: number } {
    if (!array || array.length === 0) return { min: 0, max: 0 };
    
    let min = array[0];
    let max = array[0];
    
    for (let i = 1; i < array.length; i++) {
      if (array[i] < min) min = array[i];
      if (array[i] > max) max = array[i];
    }
    
    return { min, max };
  }
  
  get parameterCount(): number {
    // Ya no se puede calcular desde capas TS
    return 0;
  }
  
  get architecture(): string {
    // Describir la arquitectura cargada
    return `TF.js Model (CNN-ResNet-Dual)`;
  }
}
