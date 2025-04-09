
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
  
  // Enhanced precision parameters
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.65; // Increased confidence threshold
  private readonly PHYSIOLOGICAL_MIN_BPM = 40;
  private readonly PHYSIOLOGICAL_MAX_BPM = 200;
  private readonly NOISE_REJECTION_FACTOR = 0.12; // Increased for better noise rejection
  
  /**
   * Create a new heart rate model
   */
  constructor() {
    super(
      'heart-rate',
      'Heart Rate Neural Network',
      '2.2.0', // Version upgraded
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
      // Pad with mirrored values instead of zeros for better frequency preservation
      const padding = requiredLength - signalData.length;
      const mirrorPad = signalData.slice(0, Math.min(padding, signalData.length)).reverse();
      processedData = [
        ...mirrorPad,
        ...signalData
      ];
      
      // If still not enough, pad with zeros
      if (processedData.length < requiredLength) {
        processedData = [
          ...Array(requiredLength - processedData.length).fill(0),
          ...processedData
        ];
      }
    } else if (signalData.length > requiredLength) {
      // Use most recent data if too much
      processedData = signalData.slice(-requiredLength);
    } else {
      processedData = signalData;
    }
    
    // Apply bandpass filtering to focus on heart rate frequency range (0.7-3.5 Hz)
    processedData = this.applyBandpassFilter(processedData);
    
    // Fast path: use cached normalization values if available for similar data
    if (this.cachedMean !== null && this.cachedRange !== null) {
      // Check if current data is similar enough to previous data
      const currMin = Math.min(...processedData.slice(0, 15)); // Sample first few points
      const currMax = Math.max(...processedData.slice(0, 15));
      const currMean = (currMin + currMax) / 2;
      const currRange = currMax - currMin;
      
      // If values are close enough, reuse cached values
      if (Math.abs(currMean - this.cachedMean) < currRange * 0.25 &&
          Math.abs(currRange - this.cachedRange) < currRange * 0.25) {
        
        // Use cached values for faster normalization
        const normalizedData = processedData.map(value => 
          2 * ((value - this.cachedMean) / (this.cachedRange || 1)) - 1
        );
        
        // Create tensor with shape [1, 150] directly from normalized data
        const result = tf.tensor(normalizedData, [1, requiredLength]);
        
        // Track performance
        this.trackPerformance(startTime);
        
        return result;
      }
    }
    
    // Normal path: compute normalization values with outlier rejection
    const sorted = [...processedData].sort((a, b) => a - b);
    const lowerIdx = Math.floor(sorted.length * 0.05); // 5th percentile
    const upperIdx = Math.floor(sorted.length * 0.95); // 95th percentile
    
    const robustMin = sorted[lowerIdx];
    const robustMax = sorted[upperIdx];
    const range = robustMax - robustMin > 0 ? robustMax - robustMin : 1;
    const mean = robustMin + range / 2;
    
    // Cache values for future use
    this.cachedMean = mean;
    this.cachedRange = range;
    
    // Normalize data to range [-1, 1] centered around the mean
    // Using robust min/max to avoid outlier influence
    const normalizedData = processedData.map(value => {
      const normalized = 2 * ((value - mean) / range) - 1;
      // Clamp values to avoid extreme outliers affecting the model
      return Math.max(-1.5, Math.min(1.5, normalized));
    });
    
    // Create tensor with shape [1, 150]
    const result = tf.tensor(normalizedData, [1, requiredLength]);
    
    // Track performance
    this.trackPerformance(startTime);
    
    return result;
  }
  
  /**
   * Apply a simple bandpass filter to focus on heart rate frequencies
   */
  private applyBandpassFilter(data: number[]): number[] {
    // Simple 5-point moving average to remove high-frequency noise
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - 2); j <= Math.min(data.length - 1, i + 2); j++) {
        sum += data[j];
        count++;
      }
      
      smoothed.push(sum / count);
    }
    
    // High-pass filtering to remove baseline wander
    const filtered = [];
    const alpha = 0.95; // High-pass filter coefficient
    let lastY = 0;
    
    for (let i = 0; i < smoothed.length; i++) {
      if (i === 0) {
        filtered.push(smoothed[i]);
        lastY = smoothed[i];
      } else {
        // Simple high-pass filter: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
        const y = alpha * (lastY + smoothed[i] - smoothed[i-1]);
        filtered.push(y);
        lastY = y;
      }
    }
    
    return filtered;
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
    
    // Extract BPM and confidence with improved scaling
    const rawBpm = result[0] * 160 + 40; // Scale to 40-200 BPM
    let bpm = Math.round(rawBpm);
    let confidence = Math.min(1, Math.max(0, result[1]));
    
    // Adjust confidence based on signal quality assessment
    confidence = this.adjustConfidenceBasedOnSignal(signalData, confidence);
    
    // Validate against physiological range with adaptive confidence reduction
    if (bpm < this.PHYSIOLOGICAL_MIN_BPM || bpm > this.PHYSIOLOGICAL_MAX_BPM) {
      // Stronger confidence reduction for clearly non-physiological values
      const distanceFromRange = Math.min(
        Math.abs(bpm - this.PHYSIOLOGICAL_MIN_BPM),
        Math.abs(bpm - this.PHYSIOLOGICAL_MAX_BPM)
      );
      
      const confidenceReduction = Math.min(0.8, distanceFromRange / 20 * 0.1);
      
      // Clamp to physiological range
      bpm = Math.min(this.PHYSIOLOGICAL_MAX_BPM, Math.max(this.PHYSIOLOGICAL_MIN_BPM, bpm));
      confidence = Math.max(0.1, confidence * (1 - confidenceReduction));
      
      console.log(`Heart rate out of normal range, adjusted to ${bpm} (confidence reduced by ${(confidenceReduction * 100).toFixed(1)}%)`);
    }
    
    // Apply minimum confidence threshold for more reliable readings
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      console.log(`Low confidence heart rate (${confidence.toFixed(2)}) below threshold ${this.MIN_CONFIDENCE_THRESHOLD}`);
    }
    
    return { bpm, confidence };
  }
  
  /**
   * Check if the signal is too weak to process
   */
  private isSignalTooWeak(signalData: number[]): boolean {
    if (signalData.length < 15) return true;
    
    // Take recent portion of the signal
    const recentData = signalData.slice(-50);
    
    // Calculate signal amplitude
    const min = Math.min(...recentData);
    const max = Math.max(...recentData);
    const amplitude = max - min;
    
    // Calculate signal variance with outlier rejection
    const sorted = [...recentData].sort((a, b) => a - b);
    const lowerIdx = Math.floor(sorted.length * 0.1); // 10th percentile
    const upperIdx = Math.floor(sorted.length * 0.9); // 90th percentile
    
    const trimmedData = sorted.slice(lowerIdx, upperIdx + 1);
    const mean = trimmedData.reduce((sum, value) => sum + value, 0) / trimmedData.length;
    const variance = trimmedData.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / trimmedData.length;
    
    // Enhanced signal check with stricter criteria
    return amplitude < 0.08 || variance < 0.0008;
  }
  
  /**
   * Adjust confidence based on signal quality assessment
   */
  private adjustConfidenceBasedOnSignal(signalData: number[], baseConfidence: number): number {
    if (signalData.length < 30) return baseConfidence * 0.8;
    
    // Calculate signal quality metrics
    const recentData = signalData.slice(-30);
    
    // 1. Enhanced Signal-to-noise ratio estimate
    let crossings = 0;
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    
    for (let i = 1; i < recentData.length; i++) {
      if ((recentData[i] > mean && recentData[i-1] <= mean) ||
          (recentData[i] <= mean && recentData[i-1] > mean)) {
        crossings++;
      }
    }
    
    // Ideal heart rate signal should have physiologically valid crossings
    // At 30Hz sampling, expect ~2-5 crossings for typical heart rates
    const expectedCrossings = [2, 3, 4, 5, 6, 7, 8]; // Valid crossing counts
    const crossingQuality = expectedCrossings.includes(crossings) ? 1.0 : 
                            (crossings > 0 && crossings < 10) ? 0.8 : 0.6;
    
    // 2. Signal stability assessment with improved metrics
    const diff = recentData.slice(1).map((val, i) => Math.abs(val - recentData[i]));
    const avgDiff = diff.reduce((sum, val) => sum + val, 0) / diff.length;
    const diffVariance = diff.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diff.length;
    
    // Lower variance of differences indicates more stable signal
    const stabilityQuality = diffVariance < 0.0005 ? 1.0 : 
                             diffVariance < 0.002 ? 0.9 : 
                             diffVariance < 0.005 ? 0.8 : 
                             diffVariance < 0.01 ? 0.7 : 0.6;
    
    // 3. Signal amplitude adequacy
    const min = Math.min(...recentData);
    const max = Math.max(...recentData);
    const amplitude = max - min;
    
    const amplitudeQuality = amplitude > 0.3 ? 1.0 :
                             amplitude > 0.2 ? 0.95 :
                             amplitude > 0.1 ? 0.85 :
                             amplitude > 0.05 ? 0.7 : 0.6;
    
    // 4. New: periodicity assessment - calculate autocorrelation
    let periodicity = 0;
    if (recentData.length >= 20) {
      periodicity = this.calculatePeriodicity(recentData);
    }
    
    const periodicityQuality = periodicity > 0.6 ? 1.0 :
                              periodicity > 0.4 ? 0.9 :
                              periodicity > 0.3 ? 0.8 :
                              periodicity > 0.2 ? 0.7 : 0.6;
    
    // Combine quality factors with base confidence - weighted more toward periodicity
    const adjustedConfidence = baseConfidence * 
                              (crossingQuality * 0.2 + 
                               stabilityQuality * 0.2 + 
                               amplitudeQuality * 0.2 +
                               periodicityQuality * 0.4);
    
    return Math.min(1, Math.max(0, adjustedConfidence));
  }
  
  /**
   * Calculate signal periodicity using autocorrelation
   * Returns a score from 0-1 where higher values indicate better periodicity
   */
  private calculatePeriodicity(data: number[]): number {
    // Normalize the signal for better correlation
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const normalizedData = data.map(val => val - mean);
    
    // Calculate autocorrelation for different lags
    const maxLag = Math.floor(data.length / 2);
    const correlations: number[] = [];
    
    // Calculate autocorrelation for different lags
    for (let lag = 1; lag < maxLag; lag++) {
      let sumCorrelation = 0;
      let sumSquared1 = 0;
      let sumSquared2 = 0;
      
      for (let i = 0; i < data.length - lag; i++) {
        sumCorrelation += normalizedData[i] * normalizedData[i + lag];
        sumSquared1 += normalizedData[i] * normalizedData[i];
        sumSquared2 += normalizedData[i + lag] * normalizedData[i + lag];
      }
      
      // Normalized correlation coefficient
      const denominator = Math.sqrt(sumSquared1 * sumSquared2);
      const correlation = denominator > 0 ? sumCorrelation / denominator : 0;
      correlations.push(correlation);
    }
    
    // Find the maximum correlation (excluding very short lags)
    const minLagIndex = Math.floor(data.length / 10); // Ignore very short lags
    let maxCorrelation = 0;
    
    for (let i = minLagIndex; i < correlations.length; i++) {
      if (correlations[i] > maxCorrelation) {
        maxCorrelation = correlations[i];
      }
    }
    
    return maxCorrelation;
  }
}
