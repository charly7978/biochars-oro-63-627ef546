
import { SignalAnalyzer } from './SignalAnalyzer';
import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';

export interface GlucoseEstimationResult {
  value: number;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
}

/**
 * GlucoseEstimator - Estimates blood glucose levels based on PPG waveform characteristics
 */
export class GlucoseEstimator extends SignalAnalyzer {
  private readonly DEFAULT_CALIBRATION_FACTOR = 1.0;
  private glucoseBuffer: number[] = [];
  private readonly bufferSize: number;
  private lastEstimation: GlucoseEstimationResult | null = null;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
    
    // Initialize with settings or defaults
    this.calibrationFactor = settings?.glucoseCalibrationFactor || this.DEFAULT_CALIBRATION_FACTOR;
    this.bufferSize = settings?.bufferSize || 10;
  }
  
  /**
   * Estimate glucose level from PPG characteristics
   */
  public estimateGlucose(ppgValues: number[]): GlucoseEstimationResult {
    if (ppgValues.length < 30) {
      return this.getLastValidEstimation();
    }
    
    // Extract signal features
    const { amplitude, baseline, riseFallRatio } = this.extractSignalFeatures(ppgValues);
    
    // Calculate initial glucose estimation from signal characteristics
    let glucoseValue = this.calculateGlucoseFromSignal(amplitude, baseline, riseFallRatio);
    
    // Apply calibration factor
    glucoseValue *= this.calibrationFactor;
    
    // Add to buffer for smoothing
    this.glucoseBuffer.push(glucoseValue);
    if (this.glucoseBuffer.length > this.bufferSize) {
      this.glucoseBuffer.shift();
    }
    
    // Calculate average for stability
    const avg = this.glucoseBuffer.reduce((sum, val) => sum + val, 0) / this.glucoseBuffer.length;
    
    // Calculate trend
    const trend = this.calculateTrend();
    
    // Calculate confidence based on signal quality and consistency
    const confidence = this.calculateConfidence(ppgValues);
    
    // Store result
    this.lastEstimation = {
      value: Math.round(avg),
      confidence,
      trend
    };
    
    return this.lastEstimation;
  }
  
  /**
   * Extract relevant features from PPG signal
   */
  private extractSignalFeatures(ppgValues: number[]): { amplitude: number, baseline: number, riseFallRatio: number } {
    // Calculate min, max and baseline
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    const amplitude = max - min;
    const baseline = (min + max) / 2;
    
    // Calculate rise/fall ratio
    let riseTimes = 0;
    let fallTimes = 0;
    
    for (let i = 1; i < ppgValues.length; i++) {
      if (ppgValues[i] > ppgValues[i-1]) {
        riseTimes++;
      } else if (ppgValues[i] < ppgValues[i-1]) {
        fallTimes++;
      }
    }
    
    const riseFallRatio = riseTimes / (fallTimes || 1);
    
    return { amplitude, baseline, riseFallRatio };
  }
  
  /**
   * Calculate glucose based on PPG signal characteristics
   */
  private calculateGlucoseFromSignal(amplitude: number, baseline: number, riseFallRatio: number): number {
    // Base calculation - these parameters would be determined through calibration
    const baseValue = 90; // mg/dL
    
    // Higher amplitude correlates with higher glucose in some studies
    const amplitudeFactor = amplitude * 10;
    
    // Rise/fall ratio can indicate vascular resistance
    const rfrFactor = (riseFallRatio - 1) * 5;
    
    // Combined estimation
    let glucose = baseValue + amplitudeFactor + rfrFactor;
    
    // Bound to physiological range
    glucose = Math.max(70, Math.min(180, glucose));
    
    return glucose;
  }
  
  /**
   * Calculate trend based on recent values
   */
  private calculateTrend(): 'rising' | 'falling' | 'stable' {
    if (this.glucoseBuffer.length < 3) {
      return 'stable';
    }
    
    const recent = this.glucoseBuffer.slice(-3);
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const latest = recent[recent.length - 1];
    
    const difference = latest - avg;
    
    if (difference > 5) {
      return 'rising';
    } else if (difference < -5) {
      return 'falling';
    } else {
      return 'stable';
    }
  }
  
  /**
   * Calculate confidence level based on signal quality
   */
  private calculateConfidence(ppgValues: number[]): number {
    if (ppgValues.length < 30) {
      return 0.3;
    }
    
    // Calculate signal-to-noise ratio estimate
    const recentValues = ppgValues.slice(-30);
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate variance
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length;
    
    // Calculate standard deviation
    const stdDev = Math.sqrt(variance);
    
    // Calculate signal to noise ratio
    const snr = avg / (stdDev || 0.001);
    
    // Map SNR to confidence (0-1)
    let confidence = Math.min(1, Math.max(0, snr / 10));
    
    // Adjust based on buffer size (more samples = higher confidence)
    confidence *= Math.min(1, this.glucoseBuffer.length / this.bufferSize);
    
    return confidence;
  }
  
  /**
   * Get last valid estimation or default values
   */
  private getLastValidEstimation(): GlucoseEstimationResult {
    if (this.lastEstimation) {
      const decayedConfidence = this.lastEstimation.confidence * 0.8;
      return {
        ...this.lastEstimation,
        confidence: decayedConfidence
      };
    }
    
    return {
      value: 0,
      confidence: 0,
      trend: 'stable'
    };
  }
  
  /**
   * Reset the estimator
   */
  public reset(): void {
    this.glucoseBuffer = [];
    this.lastEstimation = null;
    console.log("GlucoseEstimator reset");
  }
}
