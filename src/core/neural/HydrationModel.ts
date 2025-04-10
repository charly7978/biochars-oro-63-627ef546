
import * as tf from '@tensorflow/tfjs';

export class HydrationNeuralModel {
  private model: tf.LayersModel | null = null;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      this.model = await tf.loadLayersModel('/models/hydration/model.json');
      await this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });
      console.log('HydrationNeuralModel: Model loaded successfully');
    } catch (error) {
      console.error('HydrationNeuralModel: Error loading model:', error);
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({
          inputShape: [300, 1],
          filters: 16,
          kernelSize: 5,
          activation: 'relu'
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    return model;
  }

  public predict(ppgSignal: number[]): number[] {
    if (!this.model) {
      console.error('HydrationNeuralModel: Model not initialized');
      return [0];
    }

    try {
      // Prepare data
      const input = tf.tensor3d([ppgSignal], [1, ppgSignal.length, 1]);
      
      // Make prediction
      const prediction = this.model.predict(input) as tf.Tensor;
      const values = prediction.dataSync();
      
      // Clean up tensors
      input.dispose();
      prediction.dispose();

      // Map the sigmoid output to a percentage (0-100)
      return [Math.round(Array.from(values)[0] * 100)];
    } catch (error) {
      console.error('HydrationNeuralModel: Error during prediction:', error);
      return [0];
    }
  }
}
