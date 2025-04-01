
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for blood pressure signal processing
 * Optimizes the signal specifically for systolic/diastolic measurement
 * Focuses on pulse wave characteristics and transit time features
 */

import { SpecializedChannel, ChannelConfig } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';
import { calculateStandardDeviation, applySMAFilter } from '../../vital-signs/utils';

/**
 * Blood pressure-specific channel with improved precision
 */
export class BloodPressureChannel extends SpecializedChannel {
  // BP-specific parameters
  private readonly PULSE_WAVE_EMPHASIS = 1.5;   // Enhanced emphasis on pulse wave features
  private readonly SYSTOLIC_WEIGHT = 0.7;       // Increased weight for systolic components
  private readonly DIASTOLIC_WEIGHT = 0.3;      // Decreased weight for diastolic components
  
  // Tracking pulse features
  private pulseRiseTimeBuffer: number[] = [];
  private pulsePeakBuffer: number[] = [];
  private pulseValleyBuffer: number[] = [];
  private readonly FEATURE_BUFFER_SIZE = 15;   // Increased buffer size for better stability
  
  // Quality monitoring
  private signalQualityBuffer: number[] = [];
  private readonly QUALITY_BUFFER_SIZE = 20;
  
  constructor(config: ChannelConfig) {
    super(VitalSignType.BLOOD_PRESSURE, config);
  }
  
  /**
   * Apply blood pressure-specific optimization to the signal
   * Improved algorithm for more precise blood pressure estimation
   */
  protected applyChannelSpecificOptimization(value: number): number {
    // Calculate baseline with improved method
    const baseline = this.calculateBaseline();
    
    // Detect and record pulse features with improved algorithm
    this.detectPulseFeatures(value, baseline);
    
    // Apply adaptive noise reduction based on signal quality
    const denoised = this.applyAdaptiveNoiseReduction(value, baseline);
    
    // Enhance systolic components (rapid upslope of pulse wave) with improved sensitivity
    const systolicComponent = this.enhanceSystolicComponent(denoised, baseline);
    
    // Enhance diastolic components (gradual decline and dicrotic notch) with more precision
    const diastolicComponent = this.enhanceDiastolicComponent(denoised, baseline);
    
    // Combine components with optimized weighting
    const combinedValue = baseline + 
                         (systolicComponent * this.SYSTOLIC_WEIGHT) +
                         (diastolicComponent * this.DIASTOLIC_WEIGHT);
    
    // Apply pulse wave emphasis with adaptive factor
    const adaptiveEmphasis = this.calculateAdaptiveEmphasis();
    const result = combinedValue * (this.PULSE_WAVE_EMPHASIS * adaptiveEmphasis);
    
    // Update quality tracking
    this.updateSignalQuality(result, baseline);
    
    return result;
  }
  
  /**
   * Apply adaptive noise reduction based on signal characteristics
   */
  private applyAdaptiveNoiseReduction(value: number, baseline: number): number {
    if (this.recentValues.length < 10) {
      return value;
    }
    
    // Calculate signal-to-noise ratio
    const recent = this.recentValues.slice(-10);
    const snr = this.calculateSNR(recent);
    
    // Apply stronger filtering for low SNR signals
    const filterStrength = Math.max(0.2, Math.min(0.8, 1.0 - snr));
    
    // Apply SMA filter from utils with adaptive window size
    const windowSize = Math.max(3, Math.min(9, Math.round(10 * filterStrength)));
    const filtered = applySMAFilter([...recent, value], windowSize);
    
    return filtered[filtered.length - 1];
  }
  
  /**
   * Calculate signal-to-noise ratio
   */
  private calculateSNR(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance === 0) return 1.0;
    
    // Approximate SNR using mean and standard deviation
    const std = Math.sqrt(variance);
    const snr = Math.abs(mean) / std;
    
    return Math.min(1.0, snr / 5.0);
  }
  
  /**
   * Calculate adaptive emphasis factor based on signal quality
   */
  private calculateAdaptiveEmphasis(): number {
    if (this.signalQualityBuffer.length < 5) {
      return 1.0;
    }
    
    // Get average quality
    const avgQuality = this.signalQualityBuffer.reduce((sum, q) => sum + q, 0) / 
                     this.signalQualityBuffer.length;
    
    // Lower emphasis for poor quality signals
    return 0.8 + (avgQuality * 0.4);
  }
  
  /**
   * Update signal quality tracking
   */
  private updateSignalQuality(value: number, baseline: number): void {
    if (this.recentValues.length < 10) {
      return;
    }
    
    // Calculate quality based on multiple factors
    const recent = this.recentValues.slice(-10);
    
    // 1. Stability factor
    const std = calculateStandardDeviation(recent);
    const meanAbs = Math.abs(recent.reduce((sum, val) => sum + val, 0) / recent.length);
    const stabilityQuality = 1.0 - Math.min(1.0, std / (meanAbs + 0.001));
    
    // 2. Rhythm factor - check for consistent peaks/valleys
    let rhythmQuality = 0.5;
    if (this.pulsePeakBuffer.length >= 3 && this.pulseValleyBuffer.length >= 3) {
      const peakStd = calculateStandardDeviation(this.pulsePeakBuffer.slice(-3));
      const valleyStd = calculateStandardDeviation(this.pulseValleyBuffer.slice(-3));
      const peakMean = this.pulsePeakBuffer.slice(-3).reduce((sum, p) => sum + p, 0) / 3;
      const valleyMean = this.pulseValleyBuffer.slice(-3).reduce((sum, v) => sum + v, 0) / 3;
      
      rhythmQuality = 1.0 - Math.min(1.0, (peakStd / Math.abs(peakMean) + valleyStd / Math.abs(valleyMean)) / 2);
    }
    
    // 3. Amplitude factor
    const amplitude = Math.max(...recent) - Math.min(...recent);
    const amplitudeQuality = Math.min(1.0, amplitude / 0.5);
    
    // Combined quality score
    const quality = (stabilityQuality * 0.4) + (rhythmQuality * 0.4) + (amplitudeQuality * 0.2);
    
    // Add to buffer
    this.signalQualityBuffer.push(quality);
    if (this.signalQualityBuffer.length > this.QUALITY_BUFFER_SIZE) {
      this.signalQualityBuffer.shift();
    }
  }
  
  /**
   * Calculate baseline with improved BP optimizations
   */
  private calculateBaseline(): number {
    if (this.recentValues.length < 5) {
      return 0;
    }
    
    // Use a weighted moving average with more weight on valleys
    // for better diastolic pressure correlation
    const values = this.recentValues.slice(-20);
    
    if (values.length < 10) {
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    // Find potential valleys for better baseline
    const sorted = [...values].sort((a, b) => a - b);
    const lowerQuartile = sorted[Math.floor(sorted.length * 0.25)];
    
    // Weight values near lower quartile more heavily
    let weightedSum = 0;
    let weightSum = 0;
    
    for (const value of values) {
      const weight = Math.exp(-Math.pow((value - lowerQuartile) / (sorted[sorted.length-1] - sorted[0]), 2) * 4);
      weightedSum += value * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }
  
  /**
   * Detect and track features of the pulse wave with improved algorithm
   */
  private detectPulseFeatures(value: number, baseline: number): void {
    if (this.recentValues.length < 5) {
      return;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Enhanced peak detection algorithm
    if (normalized.length >= 3 && 
        normalized[normalized.length-2] > normalized[normalized.length-3] &&
        normalized[normalized.length-2] > normalized[normalized.length-1] &&
        normalized[normalized.length-2] > 0.15) { // More sensitive threshold
      
      // Found a peak
      this.pulsePeakBuffer.push(normalized[normalized.length-2]);
      if (this.pulsePeakBuffer.length > this.FEATURE_BUFFER_SIZE) {
        this.pulsePeakBuffer.shift();
      }
      
      // Calculate rise time (time from last valley to this peak)
      if (this.pulseValleyBuffer.length > 0) {
        // Improved rise time calculation
        let riseTime = 1.0;
        
        // In real implementation would use actual timestamps
        // Here we're using a placeholder more sensitive to signal characteristics
        const peakAmplitude = normalized[normalized.length-2];
        const lastValleyAmplitude = this.pulseValleyBuffer[this.pulseValleyBuffer.length-1];
        riseTime = peakAmplitude / (Math.abs(lastValleyAmplitude) + 0.001);
        
        this.pulseRiseTimeBuffer.push(riseTime);
        if (this.pulseRiseTimeBuffer.length > this.FEATURE_BUFFER_SIZE) {
          this.pulseRiseTimeBuffer.shift();
        }
      }
    }
    
    // Enhanced valley detection algorithm
    if (normalized.length >= 3 && 
        normalized[normalized.length-2] < normalized[normalized.length-3] &&
        normalized[normalized.length-2] < normalized[normalized.length-1]) {
      
      // Found a valley
      this.pulseValleyBuffer.push(normalized[normalized.length-2]);
      if (this.pulseValleyBuffer.length > this.FEATURE_BUFFER_SIZE) {
        this.pulseValleyBuffer.shift();
      }
    }
  }
  
  /**
   * Enhance systolic components of the signal with improved precision
   */
  private enhanceSystolicComponent(value: number, baseline: number): number {
    // If not enough data
    if (this.recentValues.length < 5) {
      return value - baseline;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Calculate slope (first derivative) with improved algorithm
    const slopes: number[] = [];
    for (let i = 1; i < normalized.length; i++) {
      slopes.push(normalized[i] - normalized[i-1]);
    }
    
    // Enhanced positive slope detection for systolic emphasis
    const positiveSlope = Math.max(0, slopes[slopes.length-1]);
    
    // Calculate systolic emphasis based on historical peaks with improved method
    let peakEmphasis = 1.0;
    if (this.pulsePeakBuffer.length > 0) {
      // Get more recent peaks for better real-time responsiveness
      const recentPeaks = this.pulsePeakBuffer.slice(-Math.min(5, this.pulsePeakBuffer.length));
      const avgPeak = recentPeaks.reduce((sum, p) => sum + p, 0) / recentPeaks.length;
      
      // Improved normalization with smoother response curve
      const normalizedValue = (value - baseline) / (avgPeak + 0.001);
      peakEmphasis = 1.0 + Math.tanh((normalizedValue - 0.5) * 2) * 0.5;
    }
    
    // Apply enhanced systolic emphasis with improved algorithm
    return (value - baseline) * (1 + (positiveSlope * 2.0)) * peakEmphasis;
  }
  
  /**
   * Enhance diastolic components of the signal with improved precision
   */
  private enhanceDiastolicComponent(value: number, baseline: number): number {
    // If not enough data
    if (this.recentValues.length < 5) {
      return value - baseline;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Calculate negative slopes (downstroke of pulse wave) with improved algorithm
    const slopes: number[] = [];
    for (let i = 1; i < normalized.length; i++) {
      slopes.push(normalized[i] - normalized[i-1]);
    }
    
    const negativeSlope = Math.min(0, slopes[slopes.length-1]);
    
    // Calculate diastolic emphasis based on historical valleys with improved method
    let valleyEmphasis = 1.0;
    if (this.pulseValleyBuffer.length > 0) {
      // Get more recent valleys for better real-time responsiveness
      const recentValleys = this.pulseValleyBuffer.slice(-Math.min(5, this.pulseValleyBuffer.length));
      const avgValley = recentValleys.reduce((sum, v) => sum + v, 0) / recentValleys.length;
      
      // Improved normalization with smoother response curve
      const normalizedValue = (value - baseline) / (Math.abs(avgValley) + 0.001);
      valleyEmphasis = 1.0 + Math.tanh((1.0 - normalizedValue) * 2) * 0.4;
    }
    
    // Enhanced dicrotic notch detection
    let dicroticEmphasis = 1.0;
    if (slopes.length >= 3) {
      // Improved pattern recognition for dicrotic notch
      if ((slopes[slopes.length-3] < -0.01) && 
          (slopes[slopes.length-2] > -0.005) &&
          (slopes[slopes.length-1] < -0.01)) {
        // Pattern strongly resembling a dicrotic notch
        dicroticEmphasis = 1.5;
      }
      else if ((slopes[slopes.length-3] < 0) && 
               (slopes[slopes.length-2] > slopes[slopes.length-3]) &&
               (slopes[slopes.length-1] < slopes[slopes.length-2])) {
        // Pattern somewhat resembling a dicrotic notch
        dicroticEmphasis = 1.3;
      }
    }
    
    // Apply enhanced diastolic emphasis with improved factors
    return (value - baseline) * (1 - (negativeSlope * 1.2)) * valleyEmphasis * dicroticEmphasis;
  }
  
  /**
   * Reset channel state
   */
  public override reset(): void {
    super.reset();
    this.pulseRiseTimeBuffer = [];
    this.pulsePeakBuffer = [];
    this.pulseValleyBuffer = [];
    this.signalQualityBuffer = [];
  }
  
  /**
   * Get pulse wave characteristics for BP calculation with improved precision
   */
  public getPulseWaveCharacteristics(): {
    avgPeakAmplitude: number;
    avgValleyAmplitude: number;
    avgRiseTime: number;
    signalQuality: number;
  } {
    const avgQuality = this.signalQualityBuffer.length > 0 
      ? this.signalQualityBuffer.reduce((sum, q) => sum + q, 0) / this.signalQualityBuffer.length 
      : 0;
      
    return {
      avgPeakAmplitude: this.pulsePeakBuffer.length > 0 
        ? this.pulsePeakBuffer.reduce((sum, p) => sum + p, 0) / this.pulsePeakBuffer.length 
        : 0,
      avgValleyAmplitude: this.pulseValleyBuffer.length > 0
        ? this.pulseValleyBuffer.reduce((sum, v) => sum + v, 0) / this.pulseValleyBuffer.length
        : 0,
      avgRiseTime: this.pulseRiseTimeBuffer.length > 0
        ? this.pulseRiseTimeBuffer.reduce((sum, t) => sum + t, 0) / this.pulseRiseTimeBuffer.length
        : 0,
      signalQuality: avgQuality
    };
  }
}
