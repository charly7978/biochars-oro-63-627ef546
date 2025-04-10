
import * as tf from '@tensorflow/tfjs';

/**
 * TensorFlow.js based Heart Rate model
 * Processes PPG signals to estimate heart rate
 */
export class TFHeartRateModel {
  private model: tf.LayersModel | null = null;
  private inputLength: number = 300;
  private isCompiled: boolean = false;
  
  /**
   * Initialize the model architecture
   */
  async initialize(): Promise<void> {
    try {
      // Create sequential model
      const model = tf.sequential();
      
      // Input layer with shape [null, inputLength, 1]
      // 1D convolutional layers for feature extraction
      model.add(tf.layers.conv1d({
        inputShape: [this.inputLength, 1],
        filters: 16,
        kernelSize: 15,
        strides: 1,
        padding: 'same',
        activation: 'relu',
        kernelInitializer: 'glorotNormal'
      }));
      
      // Batch normalization improves training stability
      model.add(tf.layers.batchNormalization());
      
      // Max pooling to reduce dimensions
      model.add(tf.layers.maxPooling1d({
        poolSize: 2,
        strides: 2
      }));
      
      // Second convolutional block
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 7,
        strides: 1,
        padding: 'same',
        activation: 'relu'
      }));
      model.add(tf.layers.batchNormalization());
      model.add(tf.layers.maxPooling1d({
        poolSize: 2,
        strides: 2
      }));
      
      // Third convolutional block
      model.add(tf.layers.conv1d({
        filters: 64,
        kernelSize: 5,
        strides: 1,
        padding: 'same',
        activation: 'relu'
      }));
      model.add(tf.layers.batchNormalization());
      model.add(tf.layers.maxPooling1d({
        poolSize: 2,
        strides: 2
      }));
      
      // Bidirectional LSTM for temporal patterns
      model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({
          units: 32,
          returnSequences: false
        })
      }));
      
      // Flatten output for dense layers
      model.add(tf.layers.flatten());
      
      // Dense layers for regression
      model.add(tf.layers.dense({
        units: 24,
        activation: 'relu'
      }));
      model.add(tf.layers.dropout({ rate: 0.3 }));
      model.add(tf.layers.dense({
        units: 12,
        activation: 'relu'
      }));
      
      // Output layer - single value for heart rate
      model.add(tf.layers.dense({
        units: 1,
        activation: 'linear' // Linear activation for regression
      }));
      
      // Compile the model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['meanAbsoluteError']
      });
      
      this.model = model;
      this.isCompiled = true;
      
      console.log('TFHeartRateModel initialized successfully');
    } catch (error) {
      console.error('Error initializing TFHeartRateModel:', error);
      throw error;
    }
  }
  
  /**
   * Predict heart rate from PPG signal
   * @param ppgData Array of PPG values
   * @returns Predicted heart rate in BPM
   */
  async predict(ppgData: number[]): Promise<number> {
    if (!this.model || !this.isCompiled) {
      throw new Error('Model not initialized');
    }
    
    try {
      // Ensure we have enough data
      if (ppgData.length < this.inputLength) {
        // Pad with zeros if needed
        const padding = Array(this.inputLength - ppgData.length).fill(0);
        ppgData = [...ppgData, ...padding];
      } else if (ppgData.length > this.inputLength) {
        // Take the last 'inputLength' values
        ppgData = ppgData.slice(-this.inputLength);
      }
      
      // Preprocess - normalize
      const normalizedData = this.normalize(ppgData);
      
      // Reshape to [1, inputLength, 1] for model input
      const inputTensor = tf.tensor3d([normalizedData], [1, this.inputLength, 1]);
      
      // Run inference
      const output = this.model.predict(inputTensor) as tf.Tensor;
      
      // Get prediction value
      const prediction = await output.data();
      
      // Dispose tensors to prevent memory leaks
      inputTensor.dispose();
      output.dispose();
      
      // Clamp result to physiological range (40-200 BPM)
      const heartRate = Math.max(40, Math.min(200, prediction[0]));
      
      return Math.round(heartRate);
    } catch (error) {
      console.error('Error predicting heart rate:', error);
      return 75; // Return a reasonable default
    }
  }
  
  /**
   * Normalize PPG data using z-score normalization
   */
  private normalize(data: number[]): number[] {
    // Calculate mean
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / data.length;
    
    // Calculate standard deviation
    let variance = 0;
    for (const val of data) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= data.length;
    const stdDev = Math.sqrt(variance);
    
    // Avoid division by zero
    if (stdDev === 0) {
      return data.map(() => 0);
    }
    
    // Apply z-score normalization
    return data.map(val => (val - mean) / stdDev);
  }
  
  /**
   * Dispose the model to free memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isCompiled = false;
    }
  }
}
