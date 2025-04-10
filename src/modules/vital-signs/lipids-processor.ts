
import { findPeaksAndValleys } from './utils';
import { LipidsResult } from '../../types/vital-signs';

/**
 * Processor for estimating lipid levels from PPG signals
 */
export class LipidsProcessor {
  private lastValidTotal: number = 0;
  private lastValidTriglycerides: number = 0;
  private bufferSize: number = 200;
  private signalBuffer: number[] = [];
  private meanBuffer: number[] = [];
  
  constructor() {
    this.reset();
  }
  
  /**
   * Calculate lipid values from a PPG signal window
   */
  public calculateLipids(ppgSignal: number[]): LipidsResult {
    if (!ppgSignal || ppgSignal.length < 10) {
      return {
        totalCholesterol: this.lastValidTotal,
        triglycerides: this.lastValidTriglycerides
      };
    }
    
    // Add to buffer
    this.signalBuffer = [...this.signalBuffer, ...ppgSignal];
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer = this.signalBuffer.slice(-this.bufferSize);
    }
    
    try {
      // Process peaks and valleys for feature extraction
      const { peakIndices, valleyIndices } = findPeaksAndValleys(this.signalBuffer);
      
      if (peakIndices.length < 3 || valleyIndices.length < 3) {
        // Not enough data for reliable estimation
        return {
          totalCholesterol: this.lastValidTotal,
          triglycerides: this.lastValidTriglycerides
        };
      }
      
      // Extract signal features
      const features = this.extractLipidFeatures(this.signalBuffer, peakIndices, valleyIndices);
      
      // Calculate lipid values based on features
      const totalCholesterol = this.estimateTotalCholesterol(features);
      const triglycerides = this.estimateTriglycerides(features);
      
      // Update last valid values
      this.lastValidTotal = totalCholesterol;
      this.lastValidTriglycerides = triglycerides;
      
      return {
        totalCholesterol,
        triglycerides
      };
    } catch (error) {
      console.error('Error calculating lipids:', error);
      
      // Return last valid values on error
      return {
        totalCholesterol: this.lastValidTotal,
        triglycerides: this.lastValidTriglycerides
      };
    }
  }
  
  /**
   * Extract features from the PPG signal for lipid estimation
   */
  private extractLipidFeatures(signal: number[], peakIndices: number[], valleyIndices: number[]): number[] {
    // Calculate mean, standard deviation, peak values
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    this.meanBuffer.push(mean);
    if (this.meanBuffer.length > 10) {
      this.meanBuffer.shift();
    }
    
    // Calculate mean of means (smoothed)
    const meanOfMeans = this.meanBuffer.reduce((a, b) => a + b, 0) / this.meanBuffer.length;
    
    // Standard deviation
    const variance = signal.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / signal.length;
    const stdDev = Math.sqrt(variance);
    
    // Peak-to-valley amplitudes
    const amplitudes: number[] = [];
    for (const peakIdx of peakIndices) {
      // Find nearest valley
      let closestValleyIdx = -1;
      let minDistance = Number.MAX_VALUE;
      
      for (const valleyIdx of valleyIndices) {
        const distance = Math.abs(peakIdx - valleyIdx);
        if (distance < minDistance) {
          minDistance = distance;
          closestValleyIdx = valleyIdx;
        }
      }
      
      if (closestValleyIdx !== -1 && minDistance < 10) {
        const amplitude = signal[peakIdx] - signal[closestValleyIdx];
        if (amplitude > 0) {
          amplitudes.push(amplitude);
        }
      }
    }
    
    // Mean amplitude
    const meanAmplitude = amplitudes.length > 0 
      ? amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length 
      : 0;
    
    // First derivative features
    const derivatives: number[] = [];
    for (let i = 1; i < signal.length; i++) {
      derivatives.push(signal[i] - signal[i-1]);
    }
    
    // Mean of absolute derivatives
    const meanAbsDerivative = derivatives.length > 0
      ? derivatives.map(Math.abs).reduce((a, b) => a + b, 0) / derivatives.length
      : 0;
    
    return [meanOfMeans, stdDev, meanAmplitude, meanAbsDerivative];
  }
  
  /**
   * Estimate total cholesterol based on PPG features
   */
  private estimateTotalCholesterol(features: number[]): number {
    const [meanOfMeans, stdDev, meanAmplitude, meanAbsDerivative] = features;
    
    // Normalize features to appropriate ranges
    const normMean = this.normalizeValue(meanOfMeans, 0.1, 0.9);
    const normStdDev = this.normalizeValue(stdDev, 0.01, 0.2);
    const normAmplitude = this.normalizeValue(meanAmplitude, 0.05, 0.5);
    const normDerivative = this.normalizeValue(meanAbsDerivative, 0.005, 0.05);
    
    // Base cholesterol level
    const baseCholesterol = 140 + 
      (normMean * 40) + 
      (normStdDev * 30) - 
      (normAmplitude * 20) + 
      (normDerivative * 30);
    
    // Ensure within reasonable range
    return Math.round(Math.max(120, Math.min(280, baseCholesterol)));
  }
  
  /**
   * Estimate triglycerides based on PPG features
   */
  private estimateTriglycerides(features: number[]): number {
    const [meanOfMeans, stdDev, meanAmplitude, meanAbsDerivative] = features;
    
    // Normalize features to appropriate ranges
    const normMean = this.normalizeValue(meanOfMeans, 0.1, 0.9);
    const normStdDev = this.normalizeValue(stdDev, 0.01, 0.2);
    const normAmplitude = this.normalizeValue(meanAmplitude, 0.05, 0.5);
    const normDerivative = this.normalizeValue(meanAbsDerivative, 0.005, 0.05);
    
    // Base triglycerides level
    const baseTriglycerides = 80 + 
      (normMean * 50) + 
      (normStdDev * 40) - 
      (normAmplitude * 30) + 
      (normDerivative * 40);
    
    // Ensure within reasonable range
    return Math.round(Math.max(50, Math.min(300, baseTriglycerides)));
  }
  
  /**
   * Normalize a value to range [0,1] based on min/max bounds
   */
  private normalizeValue(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(1, normalized));
  }
  
  /**
   * Reset the processor to initial state
   */
  public reset(): void {
    this.signalBuffer = [];
    this.meanBuffer = [];
    this.lastValidTotal = 180; // Default total cholesterol
    this.lastValidTriglycerides = 150; // Default triglycerides
  }
}
