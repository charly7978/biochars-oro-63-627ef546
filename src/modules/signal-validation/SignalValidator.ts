
import { ValidationConfig } from './ValidationConfig';

/**
 * Dedicated module for validating PPG signals using medical-grade standards
 * Provides robust signal validation with strict criteria
 */
export class SignalValidator {
  // Validation state
  private validSampleCounter: number = 0;
  private lastValidTime: number = 0;
  
  // Tracking buffers
  private signalQualityHistory: number[] = [];
  private amplitudeHistory: number[] = [];
  private noiseBuffer: number[] = [];
  
  /**
   * Validates signal quality and determines if it meets medical standards
   */
  public validateSignalQuality(
    ppgValue: number,
    signalQuality?: number
  ): { 
    isValid: boolean; 
    validSampleCounter: number;
    validationMessage?: string;
  } {
    // Update quality history if provided
    if (signalQuality !== undefined) {
      this.signalQualityHistory.push(signalQuality);
      if (this.signalQualityHistory.length > ValidationConfig.QUALITY_HISTORY_SIZE) {
        this.signalQualityHistory.shift();
      }
    }
    
    // Calculate quality metrics
    const avgQuality = this.signalQualityHistory.length > 0 ? 
      this.signalQualityHistory.reduce((sum, q) => sum + q, 0) / this.signalQualityHistory.length : 0;
    
    const goodQualityRatio = this.signalQualityHistory.length > 5 ?
      this.signalQualityHistory.filter(q => q >= ValidationConfig.MIN_QUALITY_THRESHOLD).length / this.signalQualityHistory.length : 0;
    
    const hasReliableSignal = avgQuality >= ValidationConfig.MIN_QUALITY_THRESHOLD && 
                             goodQualityRatio >= ValidationConfig.MIN_QUALITY_RATIO;
    
    // Strict quality validation
    if (signalQuality !== undefined && (!hasReliableSignal || signalQuality < ValidationConfig.MIN_QUALITY_THRESHOLD)) {
      this.validSampleCounter = 0;
      return { 
        isValid: false, 
        validSampleCounter: 0,
        validationMessage: "Low quality signal rejected" 
      };
    }
    
    // Basic range validation
    if (isNaN(ppgValue) || !isFinite(ppgValue) || ppgValue < 0 || Math.abs(ppgValue) > 300) {
      this.validSampleCounter = 0;
      this.signalQualityHistory = [];
      this.amplitudeHistory = [];
      return { 
        isValid: false, 
        validSampleCounter: 0,
        validationMessage: "Invalid PPG value rejected" 
      };
    }
    
    // Noise analysis
    this.noiseBuffer.push(ppgValue);
    if (this.noiseBuffer.length > ValidationConfig.NOISE_BUFFER_SIZE) {
      this.noiseBuffer.shift();
    }
    
    if (this.noiseBuffer.length >= 10) {
      const noiseLevel = this.calculateNoiseLevel(this.noiseBuffer);
      if (noiseLevel > ValidationConfig.MAX_NOISE_RATIO) {
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 2);
        return { 
          isValid: false, 
          validSampleCounter: this.validSampleCounter,
          validationMessage: "Excessive noise detected" 
        };
      }
    }
    
    // Amplitude analysis
    this.amplitudeHistory.push(Math.abs(ppgValue));
    if (this.amplitudeHistory.length > ValidationConfig.AMPLITUDE_HISTORY_SIZE) {
      this.amplitudeHistory.shift();
    }
    
    if (this.amplitudeHistory.length >= 10) {
      const amplitudeStats = this.calculateAmplitudeStats(this.amplitudeHistory);
      
      if (amplitudeStats.max - amplitudeStats.min < ValidationConfig.MIN_AMPLITUDE_VARIATION || 
          amplitudeStats.max < ValidationConfig.MIN_AMPLITUDE_THRESHOLD) {
        this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
        return { 
          isValid: false, 
          validSampleCounter: this.validSampleCounter,
          validationMessage: "Insufficient signal amplitude variation" 
        };
      }
    }
    
    // Check refractory period
    const now = Date.now();
    if (now - this.lastValidTime < ValidationConfig.REFRACTORY_PERIOD_MS) {
      return { 
        isValid: false, 
        validSampleCounter: this.validSampleCounter,
        validationMessage: "In refractory period" 
      };
    }
    
    // Increment valid sample counter
    this.validSampleCounter++;
    
    // Ensure we have sufficient consecutive valid samples
    const isFullyValid = this.validSampleCounter >= ValidationConfig.CONSECUTIVE_VALID_SAMPLES;
    
    if (isFullyValid) {
      this.lastValidTime = now;
    }
    
    return { 
      isValid: isFullyValid, 
      validSampleCounter: this.validSampleCounter,
      validationMessage: isFullyValid ? "Valid signal" : "Building confidence" 
    };
  }
  
  /**
   * Validate RR interval data for arrhythmia analysis
   */
  public validateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    if (!rrData) return false;
    
    // Verify that we have sufficient intervals
    if (rrData.intervals.length < 8) {
      return false;
    }
    
    // Verify physiological plausibility of intervals
    const hasInvalidIntervals = rrData.intervals.some(interval => 
      isNaN(interval) || !isFinite(interval) || interval <= 300 || interval > 1800);
    
    if (hasInvalidIntervals) {
      return false;
    }
    
    // Verify plausible heart rate
    if (rrData.intervals.length > 0) {
      const averageRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
      const approximateBPM = 60000 / averageRR;
      
      if (approximateBPM < 40 || approximateBPM > 180) {
        return false;
      }
    }
    
    // Verify reasonable interval variability
    if (rrData.intervals.length >= 3) {
      const variations = [];
      for (let i = 1; i < rrData.intervals.length; i++) {
        variations.push(Math.abs(rrData.intervals[i] - rrData.intervals[i-1]));
      }
      
      const maxVariation = Math.max(...variations);
      const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
      
      // Reject extreme variations
      if (maxVariation > 5 * avgVariation) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculate amplitude statistics for signal validation
   */
  private calculateAmplitudeStats(values: number[]): { min: number, max: number, avg: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return { min, max, avg };
  }
  
  /**
   * Calculate noise level as ratio between standard deviation and mean
   */
  private calculateNoiseLevel(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Noise-to-signal ratio
    return stdDev / (mean + 0.001); // Avoid division by zero
  }
  
  /**
   * Reset all validation state
   */
  public reset(): void {
    this.validSampleCounter = 0;
    this.lastValidTime = 0;
    this.signalQualityHistory = [];
    this.amplitudeHistory = [];
    this.noiseBuffer = [];
  }
}
