
import * as tf from '@tensorflow/tfjs';
import { BaseTensorflowModel } from './TensorflowModelInterface';

/**
 * Standardized Heart Rate Neural Model
 * Implements the standardized TensorFlow model interface
 */
export class StandardizedHeartRateModel extends BaseTensorflowModel {
  /**
   * Create a new heart rate model
   */
  constructor() {
    super(
      'heart-rate',
      'Heart Rate Neural Network',
      '2.0.0',
      'Heart rate estimation from PPG signals with improved accuracy and robustness'
    );
  }
  
  /**
   * Prepare input tensor for the model
   */
  protected prepareInput(signalData: number[]): tf.Tensor {
    // Ensure we have enough data
    const requiredLength = 150;
    let processedData: number[];
    
    if (signalData.length < requiredLength) {
      // Pad with zeros if not enough data
      processedData = [
        ...Array(requiredLength - signalData.length).fill(0),
        ...signalData
      ];
    } else if (signalData.length > requiredLength) {
      // Use most recent data if too much
      processedData = signalData.slice(-requiredLength);
    } else {
      processedData = signalData;
    }
    
    // Normalize data to range [-1, 1]
    const min = Math.min(...processedData);
    const max = Math.max(...processedData);
    const range = max - min > 0 ? max - min : 1;
    
    const normalizedData = processedData.map(value => 
      2 * ((value - min) / range) - 1
    );
    
    // Create tensor with shape [1, 150]
    return tf.tensor(normalizedData, [1, requiredLength]);
  }
  
  /**
   * Process heart rate data with additional validation
   */
  public async processHeartRate(signalData: number[]): Promise<{
    bpm: number;
    confidence: number;
  } | null> {
    const result = await this.process(signalData);
    
    if (!result || result.length < 2) {
      return null;
    }
    
    // Extract BPM and confidence
    const bpm = Math.round(result[0] * 160 + 40); // Scale to 40-200 BPM
    const confidence = Math.min(1, Math.max(0, result[1]));
    
    // Validate physiological range
    if (bpm < 40 || bpm > 200) {
      return {
        bpm: Math.min(200, Math.max(40, bpm)),
        confidence: confidence * 0.5 // Reduce confidence for out-of-range values
      };
    }
    
    return { bpm, confidence };
  }
}
