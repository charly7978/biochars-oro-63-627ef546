/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import * as tf from '@tensorflow/tfjs';
import { logSignalProcessing } from '../../utils/signalNormalization';

/**
 * TensorFlow-based signal processor
 * Processes image data to extract signal information
 */
export class TFSignalProcessor {
  private model: tf.GraphModel | null = null;
  private modelStatus: string = 'loading';
  private readonly MODEL_URL = '/tfjs_model/model.json';

  /**
   * Load the TensorFlow model
   */
  async loadModel() {
    try {
      this.model = await tf.loadGraphModel(this.MODEL_URL);
      this.modelStatus = 'ready';
      console.log('TFSignalProcessor: TensorFlow model loaded successfully');
    } catch (error) {
      this.modelStatus = 'error';
      logSignalProcessing("Signal processing error", error);
      console.error('TFSignalProcessor: Error loading TensorFlow model:', error);
    }
  }

  /**
   * Process image data using TensorFlow model
   */
  process(imageData: ImageData): {
    timestamp: number;
    quality: number;
    noise: number;
    stability: number;
    periodicity: number;
  } | null {
    if (!this.model) {
      console.warn('TFSignalProcessor: Model not loaded, cannot process data');
      return null;
    }

    try {
      tf.engine().startScope();

      // Convert image data to tensor
      const tensor = tf.browser.fromPixels(imageData, 1);
      const resized = tf.image.resizeBilinear(tensor, [64, 64]).toFloat();
      const offset = tf.scalar(127.5);
      const normalized = resized.sub(offset).div(offset);
      const batched = normalized.expandDims(0);

      // Run inference
      const prediction = this.model.predict(batched);
      const data = (prediction as tf.Tensor).dataSync();

      tf.engine().endScope();

      // Extract results
      const overall = data[0];
      const noise = data[1];
      const stability = data[2];
      const periodicity = data[3];

      // Create quality metrics object
      const qualityMetrics = {
        timestamp: Date.now(),
        quality: overall, // Add the missing 'quality' property
        noise: noise,
        stability: stability,
        periodicity: periodicity
      };

      return qualityMetrics;
    } catch (error) {
      logSignalProcessing("Signal processing error", error);
      console.error('TFSignalProcessor: Error processing image data:', error);
      tf.engine().endScope();
      return null;
    }
  }

  /**
   * Get the model status
   */
  getModelStatus(): string {
    return this.modelStatus;
  }
}
