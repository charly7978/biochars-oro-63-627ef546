
import { SignalAnalyzer } from './SignalAnalyzer';
import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';

export interface HemoglobinResult {
  value: number;
  confidence: number;
}

export class HemoglobinEstimator extends SignalAnalyzer {
  private readonly DEFAULT_CALIBRATION_FACTOR = 1.0;
  private readonly bufferSize: number;
  private hemoglobinBuffer: number[] = [];
  private lastEstimation: HemoglobinResult | null = null;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
    
    // Initialize with settings or defaults
    this.calibrationFactor = settings?.hemoglobinCalibrationFactor || this.DEFAULT_CALIBRATION_FACTOR;
    this.bufferSize = settings?.bufferSize || 10;
  }
  
  /**
   * Estimate hemoglobin levels from PPG signal
   */
  public estimateHemoglobin(ppgValues: number[]): HemoglobinResult {
    if (ppgValues.length < 30) {
      return this.getLastValidEstimation();
    }
    
    // Extract signal features
    const { acComponent, dcComponent, perfusionIndex } = this.extractSignalFeatures(ppgValues);
    
    // Calculate initial hemoglobin from features
    let hemoglobinValue = this.calculateHemoglobinFromSignal(acComponent, dcComponent, perfusionIndex);
    
    // Apply calibration
    hemoglobinValue *= this.calibrationFactor;
    
    // Add to buffer
    this.hemoglobinBuffer.push(hemoglobinValue);
    if (this.hemoglobinBuffer.length > this.bufferSize) {
      this.hemoglobinBuffer.shift();
    }
    
    // Calculate average for stability
    const avg = this.hemoglobinBuffer.reduce((sum, val) => sum + val, 0) / this.hemoglobinBuffer.length;
    
    // Calculate confidence
    const confidence = this.calculateConfidence(ppgValues);
    
    // Store result
    this.lastEstimation = {
      value: Math.round(avg * 10) / 10, // Round to one decimal
      confidence
    };
    
    return this.lastEstimation;
  }
  
  /**
   * Extract relevant features from PPG signal
   */
  private extractSignalFeatures(ppgValues: number[]): { acComponent: number, dcComponent: number, perfusionIndex: number } {
    // Get recent samples
    const recentValues = ppgValues.slice(-30);
    
    // Calculate AC component (peak-to-peak amplitude)
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const acComponent = max - min;
    
    // Calculate DC component (baseline)
    const dcComponent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate perfusion index
    const perfusionIndex = dcComponent !== 0 ? (acComponent / dcComponent) : 0;
    
    return { acComponent, dcComponent, perfusionIndex };
  }
  
  /**
   * Calculate hemoglobin based on signal features
   */
  private calculateHemoglobinFromSignal(acComponent: number, dcComponent: number, perfusionIndex: number): number {
    // Base calculation
    const baseValue = 12.0; // g/dL
    
    // Perfusion index correlates with hemoglobin in some studies
    const piFactor = perfusionIndex * 2;
    
    // AC/DC ratio can correlate with oxygen carrying capacity
    const acDcFactor = acComponent / (dcComponent || 0.001) * 5;
    
    // Combined estimation
    let hemoglobin = baseValue + piFactor + acDcFactor;
    
    // Bound to physiological range
    hemoglobin = Math.max(7.0, Math.min(18.0, hemoglobin));
    
    return hemoglobin;
  }
  
  /**
   * Calculate confidence level
   */
  private calculateConfidence(ppgValues: number[]): number {
    if (ppgValues.length < 30) {
      return 0.3;
    }
    
    // Calculate signal-to-noise ratio estimate
    const recentValues = ppgValues.slice(-30);
    const diffs = [];
    
    for (let i = 1; i < recentValues.length; i++) {
      diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    // Calculate average difference (noise estimate)
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    
    // Calculate signal amplitude
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calculate signal to noise ratio
    const snr = amplitude / (avgDiff || 0.001);
    
    // Map SNR to confidence (0-1)
    let confidence = Math.min(1, Math.max(0, snr / 15));
    
    // Adjust based on buffer size (more samples = higher confidence)
    confidence *= Math.min(1, this.hemoglobinBuffer.length / this.bufferSize);
    
    return confidence;
  }
  
  /**
   * Get last valid estimation or default
   */
  private getLastValidEstimation(): HemoglobinResult {
    if (this.lastEstimation) {
      const decayedConfidence = this.lastEstimation.confidence * 0.8;
      return {
        ...this.lastEstimation,
        confidence: decayedConfidence
      };
    }
    
    return {
      value: 0,
      confidence: 0
    };
  }
  
  /**
   * Reset the estimator
   */
  public reset(): void {
    this.hemoglobinBuffer = [];
    this.lastEstimation = null;
    console.log("HemoglobinEstimator reset");
  }
}
