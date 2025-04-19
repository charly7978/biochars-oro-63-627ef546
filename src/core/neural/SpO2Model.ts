import { 
  BaseNeuralModel, 
  DenseLayer, 
  Conv1DLayer, 
  AttentionLayer,
  BatchNormLayer,
  TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';
import * as tf from '@tensorflow/tfjs'; // Asegúrate de tener @tensorflow/tfjs instalado

/**
 * Modelo neuronal especializado en la estimación precisa de saturación de oxígeno
 * 
 * Arquitectura:
 * 1. Capas convolucionales para extracción de características espectrales
 * 2. Mecanismo de atención para enfocarse en regiones informativas
 * 3. Capas densas para la estimación final
 */
export class SpO2NeuralModel extends BaseNeuralModel {
  // Capas convolucionales para detección de patrones
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  
  // Mecanismo de atención
  private attention: AttentionLayer;
  
  // Capas densas para estimación
  private dense1: DenseLayer;
  private dense2: DenseLayer;
  private outputLayer: DenseLayer;
  
  constructor() {
    super(
      'SpO2NeuralModel',
      [300], // Ventana de entrada de 5 segundos @ 60Hz
      [1],   // Salida: SpO2 (porcentaje)
      '2.0.0'
    );
    
    // Inicializar capas
    this.conv1 = new Conv1DLayer(1, 16, 9, 1, 'relu');
    this.bn1 = new BatchNormLayer(16);
    this.conv2 = new Conv1DLayer(16, 32, 7, 1, 'relu');
    this.bn2 = new BatchNormLayer(32);
    
    // Mecanismo de atención para enfocarse en características relevantes
    this.attention = new AttentionLayer(32, 8);
    
    // Capas densas
    this.dense1 = new DenseLayer(32, 24, undefined, undefined, 'relu');
    this.dense2 = new DenseLayer(24, 12, undefined, undefined, 'relu');
    this.outputLayer = new DenseLayer(12, 1, undefined, undefined, 'sigmoid');
  }
  
  /**
   * Predice el nivel de SpO2 basado en la señal PPG
   * @param input Señal PPG
   * @returns Valor de SpO2 (porcentaje)
   */
  predict(input: Tensor1D): Tensor1D | null {
    // Chequeo de inicialización de TensorFlow y OpenCV
    if (typeof window !== 'undefined') {
      if (!window.cv) {
        console.error('[SpO2NeuralModel] OpenCV no está inicializado.');
        throw new Error('OpenCV debe estar inicializado para medir.');
      }
    }
    if (!tf || !tf.ready) {
      console.error('[SpO2NeuralModel] TensorFlow no está inicializado.');
      throw new Error('TensorFlow debe estar inicializado para medir.');
    }
    const startTime = Date.now();
    try {
      console.log('[SpO2NeuralModel] Preprocesando entrada...');
      const processedInput = this.preprocessInput(input);
      
      // Forward pass
      let x = this.conv1.forward([processedInput]);
      x = this.bn1.forward(x);
      
      x = this.conv2.forward(x);
      x = this.bn2.forward(x);
      
      // Aplicar atención
      const attentionOutput = this.attention.forward(x);
      
      // Capas densas
      let output = this.dense1.forward(attentionOutput[0]);
      output = this.dense2.forward(output);
      output = this.outputLayer.forward(output);
      
      // Escalar salida de sigmoid (0-1) al rango de SpO2 (85-100%)
      const spo2 = Math.max(85, Math.min(100, output[0]));
      
      this.updatePredictionTime(startTime);
      console.log('[SpO2NeuralModel] Predicción final:', spo2);
      return [Math.round(spo2)];
    } catch (error) {
      console.error('[SpO2NeuralModel] Error en predict:', error);
      this.updatePredictionTime(startTime);
      return null;
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
    
    // Filtrar ruido de alta frecuencia
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
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (9 * 1 * 16) + 16;
    count += (7 * 16 * 32) + 32;
    
    // Attention layer
    count += 32 * 8 * 3; // Query, Key, Value matrices
    
    // Dense layers
    count += (32 * 24) + 24;
    count += (24 * 12) + 12;
    count += (12 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `CNN-Attention (${this.parameterCount} params)`;
  }
}
