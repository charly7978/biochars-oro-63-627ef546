import * as tf from '@tensorflow/tfjs';
import { 
  BaseNeuralModel, 
  DenseLayer, 
  Conv1DLayer, 
  ResidualBlock,
  BatchNormLayer,
  TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en la estimación de presión arterial
 * 
 * Arquitectura:
 * 1. Capas convolucionales profundas para análisis de forma de onda
 * 2. Bloques residuales para mejorar el aprendizaje de características
 * 3. Salida dual para presión sistólica y diastólica
 */
export class BloodPressureNeuralModel extends BaseNeuralModel {
  // Layers
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private residualBlock1: ResidualBlock;
  private residualBlock2: ResidualBlock;
  
  // Ramas separadas para sistólica y diastólica
  private systolicBranch1: DenseLayer;
  private systolicBranch2: DenseLayer;
  private systolicOutput: DenseLayer;
  
  private diastolicBranch1: DenseLayer;
  private diastolicBranch2: DenseLayer;
  private diastolicOutput: DenseLayer;
  
  constructor() {
    super(
      'BloodPressureNeuralModel',
      [300], // 5 segundos de señal @ 60Hz
      [2],   // Salida: [sistólica, diastólica] en mmHg
      '2.1.0'
    );
    
    // Feature extraction layers
    this.conv1 = new Conv1DLayer(1, 32, 15, 1, 'relu');
    this.bn1 = new BatchNormLayer(32);
    
    // Residual blocks
    this.residualBlock1 = new ResidualBlock(32, 7);
    this.residualBlock2 = new ResidualBlock(32, 5);
    
    // Systolic branch
    this.systolicBranch1 = new DenseLayer(32, 24, undefined, undefined, 'relu');
    this.systolicBranch2 = new DenseLayer(24, 12, undefined, undefined, 'relu');
    this.systolicOutput = new DenseLayer(12, 1, undefined, undefined, 'linear');
    
    // Diastolic branch
    this.diastolicBranch1 = new DenseLayer(32, 24, undefined, undefined, 'relu');
    this.diastolicBranch2 = new DenseLayer(24, 12, undefined, undefined, 'relu');
    this.diastolicOutput = new DenseLayer(12, 1, undefined, undefined, 'linear');
  }
  
  /**
   * Predice presión arterial sistólica y diastólica
   * @param input Señal PPG
   * @returns [sistólica, diastólica] en mmHg
   */
  predict(input: Tensor1D): Tensor1D | null {
    // Chequeo de inicialización de TensorFlow y OpenCV
    if (typeof window !== 'undefined') {
      if (!window.cv) {
        console.error('[BloodPressureNeuralModel] OpenCV no está inicializado.');
        throw new Error('OpenCV debe estar inicializado para medir.');
      }
    }
    if (typeof tf === 'undefined' || !tf || !tf.ready) {
      console.error('[BloodPressureNeuralModel] TensorFlow no está inicializado.');
      throw new Error('TensorFlow debe estar inicializado para medir.');
    }
    const startTime = Date.now();
    try {
      console.log('[BloodPressureNeuralModel] Preprocesando entrada...');
      const processedInput = this.preprocessInput(input);
      let features = this.conv1.forward([processedInput]);
      features = this.bn1.forward(features);
      features = this.residualBlock1.forward(features);
      features = this.residualBlock2.forward(features);
      const pooled = this.globalAveragePooling(features);
      let systolicOut = this.systolicBranch1.forward(pooled);
      systolicOut = this.systolicBranch2.forward(systolicOut);
      systolicOut = this.systolicOutput.forward(systolicOut);
      let diastolicOut = this.diastolicBranch1.forward(pooled);
      diastolicOut = this.diastolicBranch2.forward(diastolicOut);
      diastolicOut = this.diastolicOutput.forward(diastolicOut);
      const systolic = Math.max(90, Math.min(180, 115 + systolicOut[0]));
      const diastolic = Math.max(60, Math.min(110, 75 + diastolicOut[0]));
      const adjustedDiastolic = Math.min(diastolic, systolic - 20);
      this.updatePredictionTime(startTime);
      console.log('[BloodPressureNeuralModel] Predicción final:', systolic, adjustedDiastolic);
      return [Math.round(systolic), Math.round(adjustedDiastolic)];
    } catch (error) {
      console.error('[BloodPressureNeuralModel] Error en predict:', error);
      this.updatePredictionTime(startTime);
      return null;
    }
  }
  
  /**
   * Preprocesa la señal para análisis de presión arterial
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      const padding = Array(this.inputShape[0] - input.length).fill(0);
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }
    
    // Aplicar filtro
    let processed = this.bandpassFilter(input);
    
    // Normalizar
    const { min, max } = this.findMinMax(processed);
    if (max > min) {
      processed = processed.map(v => (v - min) / (max - min));
    }
    
    return processed;
  }
  
  /**
   * Aplica un filtro paso banda simplificado
   */
  private bandpassFilter(signal: Tensor1D): Tensor1D {
    // Aplicar promedio móvil para filtro paso bajo
    const lpfWindow = 5;
    const lpfSignal = this.movingAverage(signal, lpfWindow);
    
    // Aplicar derivador para filtro paso alto
    const hpfSignal: Tensor1D = [];
    for (let i = 0; i < signal.length; i++) {
      hpfSignal.push(signal[i] - 0.95 * (lpfSignal[i] || 0));
    }
    
    return hpfSignal;
  }
  
  /**
   * Implementa promedio móvil
   */
  private movingAverage(signal: Tensor1D, window: number): Tensor1D {
    const result: Tensor1D = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - window); j <= Math.min(signal.length - 1, i + window); j++) {
        sum += signal[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Find min and max values in an array
   */
  private findMinMax(array: Tensor1D): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    
    for (const value of array) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    
    return { min, max };
  }
  
  /**
   * Global average pooling implementation
   */
  private globalAveragePooling(features: Tensor1D[]): Tensor1D {
    const result: Tensor1D = [];
    
    for (let f = 0; f < features.length; f++) {
      const sum = features[f].reduce((acc, val) => acc + val, 0);
      result.push(sum / features[f].length);
    }
    
    return result;
  }
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (15 * 1 * 32) + 32;
    
    // Residual blocks
    count += 2 * ((7 * 32 * 32) + 32 + (7 * 32 * 32) + 32);
    
    // Dense layers - systolic
    count += (32 * 24) + 24;
    count += (24 * 12) + 12;
    count += (12 * 1) + 1;
    
    // Dense layers - diastolic
    count += (32 * 24) + 24;
    count += (24 * 12) + 12;
    count += (12 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `CNN-ResNet-Dual (${this.parameterCount} params)`;
  }
}
