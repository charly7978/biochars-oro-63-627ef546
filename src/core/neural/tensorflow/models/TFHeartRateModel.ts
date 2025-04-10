
import * as tf from '@tensorflow/tfjs';
import { TFBaseModel } from './TFBaseModel';
import { Tensor1D } from '../../NeuralNetworkBase';
import { TensorUtils } from '../TensorAdapter';

/**
 * Modelo para predicción de frecuencia cardíaca basado en TensorFlow.js
 */
export class TFHeartRateModel extends TFBaseModel {
  private readonly INPUT_SIZE = 300;
  private readonly OUTPUT_SIZE = 1;
  private readonly VERSION = '1.0.0';
  private readonly ACTIVATION = 'relu';
  private readonly KERNEL_SIZE = 5;
  
  constructor() {
    super(
      'HeartRate',
      [300], // inputShape
      [1],   // outputShape
      '1.0.0'
    );
  }
  
  /**
   * Inicializa el modelo de TensorFlow
   */
  protected async initModel(): Promise<void> {
    try {
      // Intentar cargar modelo preexistente desde storage
      this.tfModel = await tf.loadLayersModel('indexeddb://heart-rate-model')
        .catch(() => null);
      
      if (!this.tfModel) {
        // Crear modelo desde cero
        this.tfModel = this.createModel();
        
        // Guardar para uso futuro
        await this.tfModel.save('indexeddb://heart-rate-model')
          .catch(err => console.error('Error guardando modelo:', err));
      }
    } catch (error) {
      console.error('Error inicializando modelo de frecuencia cardíaca:', error);
      // Crear modelo en memoria como fallback
      this.tfModel = this.createModel();
    }
  }
  
  /**
   * Crea un modelo CNN para procesar señales PPG
   */
  protected createModel(): tf.LayersModel {
    // Input layer
    const input = tf.input({shape: [this.INPUT_SIZE]});
    
    // Reshape para conv1d [batchSize, timeSteps, features]
    const reshapedInput = tf.layers.reshape({targetShape: [this.INPUT_SIZE, 1]}).apply(input);
    
    // Primer bloque convolucional
    let x = tf.layers.conv1d({
      filters: 16,
      kernelSize: this.KERNEL_SIZE,
      padding: 'same',
      activation: this.ACTIVATION,
      kernelInitializer: 'heNormal'
    }).apply(reshapedInput);
    
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Segundo bloque convolucional
    x = tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      padding: 'same',
      activation: this.ACTIVATION,
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Tercer bloque convolucional
    x = tf.layers.conv1d({
      filters: 64,
      kernelSize: 3,
      padding: 'same',
      activation: this.ACTIVATION,
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
    
    // Análisis de características
    x = tf.layers.flatten().apply(x);
    
    // Normalización y capas densas
    x = tf.layers.dense({
      units: 64,
      activation: this.ACTIVATION,
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    x = tf.layers.dropout({rate: 0.2}).apply(x);
    
    // Custom scalar multiplication using a dense layer
    const scaleLayer = tf.layers.dense({
      units: 1,
      useBias: false,
      kernelInitializer: tf.initializers.constant({value: 0.5})
    });
    
    // Apply scale layer
    const scaled = scaleLayer.apply(x);
    
    // Capa de salida
    const output = tf.layers.dense({
      units: this.OUTPUT_SIZE,
      activation: 'linear',
      kernelInitializer: 'heNormal'
    }).apply(scaled);
    
    // Crear modelo
    const model = tf.model({inputs: input, outputs: output});
    
    // Compilar
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mse']
    });
    
    return model;
  }
  
  /**
   * Aplica calibración a los datos de entrada
   */
  protected applyInputCalibration(input: Tensor1D): Tensor1D {
    // Normalizar señal
    return TensorUtils.normalizeInput(input, 0, 1);
  }
  
  /**
   * Preprocesa los datos para predicción
   */
  private preprocessInput(ppgValues: number[]): number[] {
    // Ensure we have exactly INPUT_SIZE values
    const paddedValues = TensorUtils.padArray(ppgValues, this.INPUT_SIZE);
    
    // Apply filtering and normalization
    const filtered = TensorUtils.movingAverage(paddedValues, 3);
    const normalized = TensorUtils.normalizeInput(filtered, 0, 1);
    
    return normalized;
  }
  
  /**
   * Procesa la predicción a través del modelo
   */
  async predictAsync(input: Tensor1D): Promise<Tensor1D> {
    try {
      // Asegurar que el modelo está inicializado
      if (!this.tfModel) {
        await this.initModel();
      }
      
      const startTime = performance.now();
      
      // Preprocesar entrada
      const preprocessed = this.preprocessInput(input);
      
      // Convert to proper tensor shape for the model
      const tensor = tf.tensor2d([preprocessed], [1, this.INPUT_SIZE]);
      
      // Ejecutar predicción
      const prediction = await this.tfModel!.predict(tensor) as tf.Tensor;
      const result = Array.from(await prediction.data());
      
      // Limpiar tensores
      tensor.dispose();
      prediction.dispose();
      
      // Aplicar calibración de salida
      const calibratedOutput = this.applyOutputCalibration(result);
      
      // Ajustar resultado para rango fisiológico
      const heartRate = Math.max(40, Math.min(200, calibratedOutput[0]));
      
      // Actualizar tiempo de predicción
      this.lastPredictionTime = performance.now() - startTime;
      
      return [heartRate];
    } catch (error) {
      console.error(`Error en predicción de frecuencia cardíaca:`, error);
      return [0];
    }
  }
}
