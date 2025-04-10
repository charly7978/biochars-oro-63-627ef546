import * as tf from '@tensorflow/tfjs';
import { OPTIMIZED_TENSORFLOW_CONFIG } from './tensorflow/TensorFlowConfig';

export class LipidsNeuralModel {
  private model: tf.LayersModel | null = null;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      this.model = await tf.loadLayersModel('/models/lipids/model.json');
      await this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });
      console.log('LipidsNeuralModel: Model loaded successfully');
    } catch (error) {
      console.error('LipidsNeuralModel: Error loading model:', error);
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({
          inputShape: [300, 1],
          filters: 32,
          kernelSize: 5,
          activation: 'relu'
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 2, activation: 'linear' })
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
      console.error('LipidsNeuralModel: Model not initialized');
      return [0, 0];
    }

    try {
      // Preparar los datos
      const input = tf.tensor3d([ppgSignal], [1, ppgSignal.length, 1]);
      
      // Hacer la predicción
      const prediction = this.model.predict(input) as tf.Tensor;
      const values = prediction.dataSync();
      
      // Limpiar tensores
      input.dispose();
      prediction.dispose();

      return Array.from(values);
    } catch (error) {
      console.error('LipidsNeuralModel: Error during prediction:', error);
      return [0, 0];
    }
  }
} 