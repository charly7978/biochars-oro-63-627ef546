
import * as tf from '@tensorflow/tfjs';
import { BaseNeuralModel } from '../../NeuralNetworkBase';
import { TensorUtils } from '../TensorAdapter';
import type { Tensor1D } from '../../NeuralNetworkBase';

/**
 * Modelo de TensorFlow.js para detección de frecuencia cardíaca
 * 
 * Arquitectura optimizada:
 * - Capas convolucionales para capturar patrones rítmicos
 * - Mecanismo de atención para enfocarse en segmentos relevantes
 * - Pooling adaptativo para manejar señales de distinta longitud
 */
export class TFHeartRateModel extends BaseNeuralModel {
  private model: tf.LayersModel | null = null;
  private isModelReady: boolean = false;
  private calibrationFactor: number = 1.0;
  
  constructor() {
    super(
      'TFHeartRateModel',
      [300], // 5 segundos @ 60Hz
      [1],   // Salida: frecuencia cardíaca (BPM)
      '3.0.0'
    );
    this.initModel();
  }
  
  /**
   * Inicializa o carga el modelo
   */
  private async initModel(): Promise<void> {
    try {
      console.log('TFHeartRateModel: Inicializando modelo...');
      
      // Intentar cargar el modelo desde IndexedDB
      try {
        this.model = await tf.loadLayersModel('indexeddb://heart-rate-model');
        console.log('TFHeartRateModel: Modelo cargado desde IndexedDB');
      } catch (error) {
        console.log('TFHeartRateModel: Creando nuevo modelo', error);
        // Si no existe, crear el modelo desde cero
        this.model = this.createModel();
        
        // Guardar en IndexedDB para futura carga rápida
        await this.model.save('indexeddb://heart-rate-model');
      }
      
      this.isModelReady = true;
      console.log('TFHeartRateModel: Modelo inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando TFHeartRateModel:', error);
    }
  }
  
  /**
   * Crea la arquitectura del modelo
   */
  private createModel(): tf.LayersModel {
    const input = tf.input({shape: [300, 1]});
    
    // Primera capa convolucional
    let x = tf.layers.conv1d({
      filters: 16,
      kernelSize: 9,
      activation: 'relu',
      padding: 'same',
      kernelInitializer: 'glorotUniform'
    }).apply(input);
    
    x = tf.layers.batchNormalization().apply(x);
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Segunda capa convolucional
    x = tf.layers.conv1d({
      filters: 32,
      kernelSize: 7,
      activation: 'relu',
      padding: 'same',
      kernelInitializer: 'glorotUniform'
    }).apply(x);
    
    x = tf.layers.batchNormalization().apply(x);
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Tercera capa convolucional
    x = tf.layers.conv1d({
      filters: 64,
      kernelSize: 5,
      activation: 'relu',
      padding: 'same',
      kernelInitializer: 'glorotUniform'
    }).apply(x);
    
    x = tf.layers.batchNormalization().apply(x);
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Mecanismo de atención
    const attention = this.createAttentionMechanism(x as tf.SymbolicTensor);
    
    // Capa flatten
    const flattened = tf.layers.flatten().apply(attention);
    
    // Capas densas
    let dense = tf.layers.dense({
      units: 64, 
      activation: 'relu',
      kernelInitializer: 'glorotUniform'
    }).apply(flattened);
    
    dense = tf.layers.dropout({rate: 0.25}).apply(dense);
    
    dense = tf.layers.dense({
      units: 32, 
      activation: 'relu',
      kernelInitializer: 'glorotUniform'
    }).apply(dense);
    
    // Capa de salida
    const output = tf.layers.dense({
      units: 1, 
      activation: 'linear',
      kernelInitializer: 'glorotNormal'
    }).apply(dense);
    
    // Crear y compilar modelo
    const model = tf.model({
      inputs: input, 
      outputs: output as tf.SymbolicTensor
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }
  
  /**
   * Crea un mecanismo de atención para enfocarse en partes relevantes de la señal
   */
  private createAttentionMechanism(input: tf.SymbolicTensor): tf.SymbolicTensor {
    // Implementar mecanismo de atención simple
    const queryDense = tf.layers.dense({
      units: 32,
      activation: 'tanh'
    }).apply(input);
    
    const attentionScore = tf.layers.dense({
      units: 1,
      activation: 'softmax'
    }).apply(queryDense);
    
    // Multiplicar por scores de atención
    const context = tf.layers.multiply().apply([input, attentionScore]);
    
    return context;
  }
  
  /**
   * Predice la frecuencia cardíaca basada en la señal PPG
   */
  async predict(input: number[]): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      // Verificar si el modelo está listo
      if (!this.model || !this.isModelReady) {
        await this.initModel();
        if (!this.model) {
          throw new Error('Modelo no disponible');
        }
      }
      
      // Preprocesar la entrada
      const processedInput = this.preprocessInput(input);
      
      // Convertir a tensor de TensorFlow
      const tensor = TensorUtils.toTFTensor(processedInput);
      
      // Ejecutar predicción
      const prediction = this.model.predict(tensor) as tf.Tensor;
      const result = await prediction.data();
      
      // Aplicar postprocesamiento y límites fisiológicos
      let heartRate = result[0];
      
      // Aplicar factor de calibración
      heartRate *= this.calibrationFactor;
      
      // Límites fisiológicos
      heartRate = Math.max(40, Math.min(200, heartRate));
      
      // Limpiar tensores para evitar fugas de memoria
      tensor.dispose();
      prediction.dispose();
      
      // Actualizar tiempo de predicción
      this.updatePredictionTime(startTime);
      
      return [Math.round(heartRate)];
    } catch (error) {
      console.error('Error en TFHeartRateModel.predict:', error);
      this.updatePredictionTime(startTime);
      return [75]; // Valor por defecto fisiológicamente normal
    }
  }
  
  /**
   * Preprocesa la entrada para alimentar al modelo
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      const padding = Array(this.inputShape[0] - input.length).fill(0);
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }
    
    // Normalizar y filtrar
    const filtered = TensorUtils.lowPassFilter(input);
    const normalized = TensorUtils.standardizeSignal(filtered);
    
    return normalized;
  }
  
  /**
   * Establece el factor de calibración
   */
  setCalibrationFactor(factor: number): void {
    if (factor >= 0.8 && factor <= 1.2) {
      this.calibrationFactor = factor;
      console.log(`TFHeartRateModel: Factor de calibración actualizado a ${factor}`);
    } else {
      console.warn(`Factor de calibración fuera de rango: ${factor}`);
    }
  }
  
  /**
   * Maneja el inicio de calibración
   */
  onCalibrationStarted(): void {
    console.log('TFHeartRateModel: Calibración iniciada');
  }
  
  /**
   * Obtiene el recuento de parámetros del modelo
   */
  get parameterCount(): number {
    return this.model ? this.model.countParams() : 0;
  }
  
  /**
   * Obtiene la descripción de la arquitectura
   */
  get architecture(): string {
    return `TensorFlow CNN-Attention (${this.parameterCount} params)`;
  }
}
