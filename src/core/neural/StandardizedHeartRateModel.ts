
import * as tf from '@tensorflow/tfjs';
import { BaseTensorflowModel } from './TensorflowModelInterface';

/**
 * Standardized Heart Rate Neural Model
 * Implements the standardized TensorFlow model interface
 * Optimized for performance and accuracy
 */
export class StandardizedHeartRateModel extends BaseTensorflowModel {
  // Cached normalization values for improved performance
  private cachedMean: number | null = null;
  private cachedRange: number | null = null;
  private lastProcessTime: number = 0;
  private processingTimeHistory: number[] = [];
  private readonly HISTORY_SIZE = 10;
  
  /**
   * Create a new heart rate model
   */
  constructor() {
    super(
      'heart-rate',
      'Heart Rate Neural Network',
      '2.1.0',
      'Heart rate estimation from PPG signals with improved accuracy, robustness and performance'
    );
  }
  
  /**
   * Prepare input tensor for the model with optimized preprocessing
   */
  protected prepareInput(signalData: number[]): tf.Tensor {
    const startTime = performance.now();
    
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
    
    // Fast path: use cached normalization values if available for similar data
    if (this.cachedMean !== null && this.cachedRange !== null) {
      // Check if current data is similar enough to previous data
      const currMin = Math.min(...processedData.slice(0, 10)); // Sample first few points
      const currMax = Math.max(...processedData.slice(0, 10));
      const currMean = (currMin + currMax) / 2;
      const currRange = currMax - currMin;
      
      // If values are close enough, reuse cached values
      if (Math.abs(currMean - this.cachedMean) < currRange * 0.3 &&
          Math.abs(currRange - this.cachedRange) < currRange * 0.3) {
        
        // Use cached values for faster normalization
        const normalizedData = processedData.map(value => 
          2 * ((value - this.cachedMean) / this.cachedRange) - 1
        );
        
        // Create tensor with shape [1, 150] directly from normalized data
        const result = tf.tensor(normalizedData, [1, requiredLength]);
        
        // Track performance
        this.trackPerformance(startTime);
        
        return result;
      }
    }
    
    // Normal path: compute normalization values
    const min = Math.min(...processedData);
    const max = Math.max(...processedData);
    const range = max - min > 0 ? max - min : 1;
    const mean = min + range / 2;
    
    // Cache values for future use
    this.cachedMean = mean;
    this.cachedRange = range;
    
    // Normalize data to range [-1, 1] centered around the mean
    const normalizedData = processedData.map(value => 
      2 * ((value - min) / range) - 1
    );
    
    // Create tensor with shape [1, 150]
    const result = tf.tensor(normalizedData, [1, requiredLength]);
    
    // Track performance
    this.trackPerformance(startTime);
    
    return result;
  }
  
  /**
   * Track preprocessing performance for optimization
   */
  private trackPerformance(startTime: number): void {
    const processingTime = performance.now() - startTime;
    this.processingTimeHistory.push(processingTime);
    
    if (this.processingTimeHistory.length > this.HISTORY_SIZE) {
      this.processingTimeHistory.shift();
    }
    
    // Log performance stats occasionally
    if (performance.now() - this.lastProcessTime > 5000) {
      const avgTime = this.processingTimeHistory.reduce((a, b) => a + b, 0) / 
                     this.processingTimeHistory.length;
      
      console.log(`HeartRateModel preprocessing performance: ${avgTime.toFixed(2)}ms avg`);
      this.lastProcessTime = performance.now();
    }
  }
  
  /**
   * Process heart rate data with additional validation and confidence estimation
   */
  public async processHeartRate(signalData: number[]): Promise<{
    bpm: number;
    confidence: number;
  } | null> {
    // Skip processing if signal is too weak
    if (this.isSignalTooWeak(signalData)) {
      return {
        bpm: 0,
        confidence: 0
      };
    }
    
    const result = await this.process(signalData);
    
    if (!result || result.length < 2) {
      return null;
    }
    
    // Extract BPM and confidence
    const rawBpm = result[0] * 160 + 40; // Scale to 40-200 BPM
    const bpm = Math.round(rawBpm);
    let confidence = Math.min(1, Math.max(0, result[1]));
    
    // Adjust confidence based on signal quality assessment
    confidence = this.adjustConfidenceBasedOnSignal(signalData, confidence);
    
    // Validate physiological range
    if (bpm < 40 || bpm > 200) {
      return {
        bpm: Math.min(200, Math.max(40, bpm)),
        confidence: confidence * 0.5 // Reduce confidence for out-of-range values
      };
    }
    
    return { bpm, confidence };
  }
  
  /**
   * Check if the signal is too weak to process
   */
  private isSignalTooWeak(signalData: number[]): boolean {
    if (signalData.length < 10) return true;
    
    // Take recent portion of the signal
    const recentData = signalData.slice(-50);
    
    // Calculate signal amplitude
    const min = Math.min(...recentData);
    const max = Math.max(...recentData);
    const amplitude = max - min;
    
    // Calculate signal variance
    const mean = recentData.reduce((sum, value) => sum + value, 0) / recentData.length;
    const variance = recentData.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / recentData.length;
    
    // Signal is too weak if amplitude or variance is very low
    return amplitude < 0.05 || variance < 0.0005;
  }
  
  /**
   * Adjust confidence based on signal quality assessment
   */
  private adjustConfidenceBasedOnSignal(signalData: number[], baseConfidence: number): number {
    if (signalData.length < 30) return baseConfidence * 0.8;
    
    // Calculate signal quality metrics
    const recentData = signalData.slice(-30);
    
    // 1. Signal-to-noise ratio estimate
    let crossings = 0;
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    
    for (let i = 1; i < recentData.length; i++) {
      if ((recentData[i] > mean && recentData[i-1] <= mean) ||
          (recentData[i] <= mean && recentData[i-1] > mean)) {
        crossings++;
      }
    }
    
    // Ideal heart rate signal should have 2-5 crossings in this window (assuming 30Hz)
    const crossingQuality = crossings >= 2 && crossings <= 8 ? 1.0 : 0.7;
    
    // 2. Signal stability
    const diff = recentData.slice(1).map((val, i) => Math.abs(val - recentData[i]));
    const avgDiff = diff.reduce((sum, val) => sum + val, 0) / diff.length;
    const diffVariance = diff.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diff.length;
    
    // Lower variance of differences indicates more stable signal
    const stabilityQuality = diffVariance < 0.001 ? 1.0 : 
                             diffVariance < 0.005 ? 0.9 : 
                             diffVariance < 0.01 ? 0.8 : 0.7;
    
    // 3. Signal amplitude adequacy
    const min = Math.min(...recentData);
    const max = Math.max(...recentData);
    const amplitude = max - min;
    
    const amplitudeQuality = amplitude > 0.2 ? 1.0 :
                             amplitude > 0.1 ? 0.9 :
                             amplitude > 0.05 ? 0.8 : 0.7;
    
    // Combine quality factors with base confidence
    const adjustedConfidence = baseConfidence * 
                              (crossingQuality * 0.4 + 
                               stabilityQuality * 0.3 + 
                               amplitudeQuality * 0.3);
    
    return Math.min(1, Math.max(0, adjustedConfidence));
  }
}
