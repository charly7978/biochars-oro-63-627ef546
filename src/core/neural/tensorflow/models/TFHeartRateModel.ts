
import * as tf from '@tensorflow/tfjs';
import { TFBaseModel, TFModelOptions } from './TFBaseModel';
import { TensorUtils } from '../TensorAdapter';

/**
 * TensorFlow model for heart rate prediction from PPG signals
 */
export class TFHeartRateModel extends TFBaseModel {
  private readonly MIN_HEART_RATE: number = 40;
  private readonly MAX_HEART_RATE: number = 200;
  private readonly DEFAULT_INPUT_SIZE: number = 300;
  
  constructor(options?: Partial<TFModelOptions>) {
    super({
      inputSize: options?.inputSize || 300,
      useWebGL: options?.useWebGL !== undefined ? options.useWebGL : true,
      useBatchNorm: options?.useBatchNorm !== undefined ? options.useBatchNorm : true,
      useQuantization: options?.useQuantization !== undefined ? options.useQuantization : false,
      useRegularization: options?.useRegularization !== undefined ? options.useRegularization : true,
    });
  }
  
  /**
   * Get model name
   */
  getModelName(): string {
    return 'HeartRate';
  }
  
  /**
   * Create the model architecture
   */
  protected async createModel(): Promise<tf.LayersModel> {
    const { inputSize, useBatchNorm, useRegularization } = this.options;
    
    // Create model
    const input = tf.input({ shape: [inputSize, 1] });
    
    // Use sequential processing to create smaller model
    const convModule = (x: tf.SymbolicTensor, filters: number, kernelSize: number, poolSize: number = 2): tf.SymbolicTensor => {
      // Add padding for causal convolution
      const padded = tf.layers.zeroPadding1d({ padding: [kernelSize - 1, 0] }).apply(x) as tf.SymbolicTensor;
      
      // Apply convolution
      let conv = tf.layers.conv1d({
        filters,
        kernelSize,
        activation: 'relu',
        kernelRegularizer: useRegularization ? tf.regularizers.l2({ l2: 0.001 }) : null,
      }).apply(padded) as tf.SymbolicTensor;
      
      // Add batch normalization if needed
      if (useBatchNorm) {
        conv = tf.layers.batchNormalization().apply(conv) as tf.SymbolicTensor;
      }
      
      // Apply max pooling
      return tf.layers.maxPooling1d({ poolSize }).apply(conv) as tf.SymbolicTensor;
    };
    
    // Create a custom lambda layer using functional API
    const createLambdaLayer = (func: (x: tf.Tensor) => tf.Tensor) => {
      return (input: tf.SymbolicTensor) => {
        const lambdaLayer = tf.layers.layer({
          name: 'customLambda',
          computeOutputShape: (inputShape) => inputShape,
          call: (inputs: tf.Tensor | tf.Tensor[], kwargs) => {
            return func(Array.isArray(inputs) ? inputs[0] : inputs);
          }
        });
        return lambdaLayer.apply(input);
      };
    };
    
    // Create the network using functional API
    let x = input;
    
    // Standard deviation calculation as a custom lambda layer
    const stdLayer = createLambdaLayer((x: tf.Tensor) => {
      return tf.tidy(() => {
        const mean = tf.mean(x, 1, true);
        const variance = tf.mean(tf.square(tf.sub(x, mean)), 1, true);
        return tf.sqrt(variance);
      });
    });
    
    // Apply convolutional layers
    x = convModule(x, 16, 5, 2);
    x = convModule(x, 32, 5, 2);
    x = convModule(x, 64, 3, 2);
    x = convModule(x, 128, 3, 2);
    
    // Flatten results
    x = tf.layers.flatten().apply(x) as tf.SymbolicTensor;
    
    // Apply dense layers
    x = tf.layers.dense({ units: 64, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;
    x = tf.layers.dense({ units: 32, activation: 'relu' }).apply(x) as tf.SymbolicTensor;
    
    // Output layer for heart rate (single value)
    const output = tf.layers.dense({ units: 1, activation: 'linear' }).apply(x) as tf.SymbolicTensor;
    
    // Create model
    const model = tf.model({ inputs: input, outputs: output });
    
    return model;
  }
  
  /**
   * Compile the model
   */
  protected compileModel(): void {
    if (!this.model) {
      throw new Error('Model not created');
    }
    
    this.model.compile({
      optimizer: tf.train.adam({ learningRate: 0.001 }),
      loss: 'meanSquaredError',
      metrics: ['meanAbsoluteError']
    });
  }
  
  /**
   * Load pretrained model
   */
  protected async loadModel(): Promise<tf.LayersModel | null> {
    // For now, we have no pretrained model to load
    return null;
  }
  
  /**
   * Make heart rate prediction from PPG signal
   */
  public async predict(ppgValues: number[]): Promise<number[]> {
    // Verify model is loaded
    if (!this.model || !this.isLoaded) {
      await this.initialize();
    }
    
    // Start prediction timing
    const startTime = performance.now();
    
    // Preprocess input
    const tensorInput = TensorUtils.preprocessForConv1D(ppgValues, this.inputSize);
    
    try {
      // Execute prediction
      const prediction = this.model!.predict(tensorInput) as tf.Tensor;
      
      // Convert to number
      const result = await prediction.data();
      
      // Constrain to physiological range
      const heartRate = Math.min(this.MAX_HEART_RATE, 
        Math.max(this.MIN_HEART_RATE, Math.round(result[0])));
      
      // Clean up tensors
      prediction.dispose();
      tensorInput.dispose();
      
      // End prediction timing
      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      this.lastPredictionTime = elapsedTime;
      
      console.log(`Heart rate prediction: ${heartRate} BPM (took ${elapsedTime.toFixed(2)} ms)`);
      
      return [heartRate];
    } catch (error) {
      console.error('Error making heart rate prediction:', error);
      tensorInput.dispose();
      return [75]; // Default fallback
    }
  }
}
