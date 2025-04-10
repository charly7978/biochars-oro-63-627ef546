
import * as tf from '@tensorflow/tfjs';
import { TFBaseModel, TFModelOptions } from './TFBaseModel';

/**
 * Modelo TensorFlow para detectar ritmo cardíaco
 */
export class TFHeartRateModel extends TFBaseModel {
  private lastPredictionTime: number = 0;
  private predictionDuration: number = 0;
  
  constructor() {
    super({
      inputShape: [300],
      outputShape: [1],
      modelName: 'HeartRateModel',
      version: '1.0.0'
    });
  }
  
  /**
   * Inicializa el modelo
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('Initializing HeartRateModel');
      
      // Create a simple model for heart rate detection
      const input = tf.input({shape: [this.inputShape[0], 1]});
      
      // First convolutional block
      const conv1 = tf.layers.conv1d({
        filters: 16,
        kernelSize: 5,
        padding: 'same',
        activation: 'relu'
      }).apply(input);
      
      const pool1 = tf.layers.maxPooling1d({poolSize: 2}).apply(conv1);
      
      // Second convolutional block
      const conv2 = tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        padding: 'same',
        activation: 'relu'
      }).apply(pool1);
      
      const pool2 = tf.layers.maxPooling1d({poolSize: 2}).apply(conv2);
      
      // Custom operation for signal processing
      // Replace lambda with a standard layer implementation
      const processed = tf.layers.flatten().apply(pool2);
      
      // Calculate statistics
      const dense1 = tf.layers.dense({
        units: 64,
        activation: 'relu'
      }).apply(processed);
      
      const dropout = tf.layers.dropout({rate: 0.2}).apply(dense1);
      
      const dense2 = tf.layers.dense({
        units: 32,
        activation: 'relu'
      }).apply(dropout);
      
      // Output heart rate
      const output = tf.layers.dense({
        units: 1,
        activation: 'linear'
      }).apply(dense2);
      
      // Create and compile model
      this.model = tf.model({
        inputs: input as tf.SymbolicTensor,
        outputs: output as tf.SymbolicTensor
      });
      
      this.model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
      });
      
      this.isInitialized = true;
      console.log('HeartRateModel initialized successfully');
    } catch (error) {
      console.error('Error initializing HeartRateModel:', error);
      throw error;
    }
  }
  
  /**
   * Predicts heart rate from PPG signal
   */
  async predict(input: number[]): Promise<number[]> {
    this.lastPredictionTime = Date.now();
    
    try {
      if (!this.isInitialized || !this.model) {
        await this.initialize();
      }
      
      // Format input
      const inputTensor = this.preprocessInput(input);
      
      // Run prediction
      const prediction = this.model!.predict(inputTensor) as tf.Tensor;
      const result = await prediction.data();
      
      // Clean up
      inputTensor.dispose();
      prediction.dispose();
      
      // Calculate prediction time
      this.predictionDuration = Date.now() - this.lastPredictionTime;
      
      // Process result
      const heartRate = Math.max(40, Math.min(200, Math.round(Array.from(result)[0])));
      return [heartRate];
    } catch (error) {
      console.error('Error predicting heart rate:', error);
      this.predictionDuration = Date.now() - this.lastPredictionTime;
      return [0]; // Default value on error
    }
  }
  
  /**
   * Preprocess input data for model
   */
  private preprocessInput(data: number[]): tf.Tensor {
    // Ensure correct length
    let processedData = [...data];
    if (processedData.length < this.inputShape[0]) {
      // Pad with zeros
      const padding = Array(this.inputShape[0] - processedData.length).fill(0);
      processedData = [...processedData, ...padding];
    } else if (processedData.length > this.inputShape[0]) {
      // Truncate
      processedData = processedData.slice(0, this.inputShape[0]);
    }
    
    // Create a 3D tensor [batch, timesteps, features]
    return tf.tensor3d([processedData.map(v => [v])], [1, this.inputShape[0], 1]);
  }
  
  /**
   * Get prediction time in milliseconds
   */
  getPredictionTime(): number {
    return this.predictionDuration;
  }
  
  /**
   * Get model architecture information
   */
  getArchitecture(): string {
    return 'CNN-1D';
  }
}
