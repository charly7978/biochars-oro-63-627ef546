import * as tf from '@tensorflow/tfjs';

export class HydrationNeuralModel {
  private model: tf.LayersModel | null = null;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    const model = tf.sequential();
    
    // Add convolutional layer for feature extraction
    model.add(tf.layers.conv1d({
      inputShape: [300, 1],
      filters: 32,
      kernelSize: 5,
      activation: 'relu'
    }));

    // Add pooling layer
    model.add(tf.layers.maxPooling1d({ poolSize: 2 }));

    // Add flatten layer
    model.add(tf.layers.flatten());

    // Add dense layers
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    this.model = model;
  }

  public predict(signal: number[]): number[] {
    if (!this.model) {
      console.warn('Model not initialized');
      return [0];
    }

    try {
      // Prepare input - reshape signal to match expected input shape
      const reshapedSignal = signal.map(value => [value]); // Convert to 2D array
      const input = tf.tensor3d([reshapedSignal], [1, signal.length, 1]);
      
      // Make prediction
      const prediction = this.model.predict(input) as tf.Tensor;
      const result = prediction.dataSync();
      
      // Cleanup
      input.dispose();
      prediction.dispose();

      return Array.from(result);
    } catch (error) {
      console.error('Error during prediction:', error);
      return [0];
    }
  }
} 