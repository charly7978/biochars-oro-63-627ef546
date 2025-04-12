import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';
import { SignalAnalyzer } from './SignalAnalyzer';

interface PPGFeatures {
  amplitude: number;
  peakToPeakTime: number;
  augmentationIndex: number;
  reflectionIndex: number;
  velocityRatio: number;
  quality: number;
}

/**
 * Analyzer for blood pressure estimation from PPG signal
 */
export class BloodPressureAnalyzer extends SignalAnalyzer {
  private readonly MEASUREMENT_DURATION = 30; // seconds
  private readonly SAMPLE_RATE = 30; // Hz
  private readonly MIN_SAMPLES = this.MEASUREMENT_DURATION * this.SAMPLE_RATE;
  private readonly MIN_QUALITY_THRESHOLD = 0.5;
  
  private measurementStartTime: number = 0;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private qualityBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
    this.reset();
  }
  
  /**
   * Start a new blood pressure measurement
   */
  public startMeasurement(): void {
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.qualityBuffer = [];
  }
  
  /**
   * Analyze blood pressure from PPG signal
   */
  public analyze(ppgValues: number[]): { systolic: number; diastolic: number; quality: number } | null {
    if (ppgValues.length < 30) {
      return this.lastValidMeasurement ? { ...this.lastValidMeasurement, quality: 0 } : null;
    }
    
    // Extract features from the PPG signal
    const features = this.extractPPGFeatures(ppgValues);
    if (!features || features.quality < this.MIN_QUALITY_THRESHOLD) {
      return this.lastValidMeasurement ? { ...this.lastValidMeasurement, quality: 0 } : null;
    }
    
    // Calculate instantaneous blood pressure estimates
    const { systolic, diastolic } = this.calculatePressureFromFeatures(features);
    
    // Add to buffers
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    this.qualityBuffer.push(features.quality);
    
    // Check if measurement duration has elapsed
    const elapsedTime = (Date.now() - this.measurementStartTime) / 1000;
    if (elapsedTime >= this.MEASUREMENT_DURATION) {
      return this.calculateFinalResult();
    }
    
    // Return intermediate result
    return {
      systolic,
      diastolic,
      quality: features.quality
    };
  }
  
  /**
   * Extract features from PPG signal
   */
  private extractPPGFeatures(ppgValues: number[]): PPGFeatures | null {
    const recentValues = ppgValues.slice(-30);
    
    // Find peaks and valleys
    const { peaks, valleys } = this.findPeaksAndValleys(recentValues);
    if (peaks.length < 2 || valleys.length < 2) {
      return null;
    }
    
    // Calculate basic features
    const amplitude = this.calculateMean(peaks.map((p, i) => peaks[i] - valleys[i]));
    const peakToPeakTime = this.calculateMean(peaks.slice(1).map((p, i) => p - peaks[i])) / this.SAMPLE_RATE;
    
    // Calculate advanced features
    const { augmentationIndex, reflectionIndex } = this.calculateWaveformIndices(recentValues, peaks, valleys);
    const velocityRatio = this.calculateVelocityRatio(recentValues, peaks);
    
    // Calculate signal quality
    const quality = this.calculateSignalQuality(recentValues, amplitude, peakToPeakTime);
    
    return {
      amplitude,
      peakToPeakTime,
      augmentationIndex,
      reflectionIndex,
      velocityRatio,
      quality
    };
  }
  
  /**
   * Find peaks and valleys in the PPG signal
   */
  private findPeaksAndValleys(values: number[]): { peaks: number[]; valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(values[i]);
      } else if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(values[i]);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Calculate waveform indices from PPG signal
   */
  private calculateWaveformIndices(values: number[], peaks: number[], valleys: number[]): { 
    augmentationIndex: number; 
    reflectionIndex: number; 
  } {
    // Calculate second derivative
    const secondDerivative = this.calculateSecondDerivative(values);
    
    // Find inflection points
    const inflectionPoints = this.findInflectionPoints(secondDerivative);
    
    // Calculate indices
    const augmentationIndex = this.calculateAugmentationIndex(values, inflectionPoints);
    const reflectionIndex = this.calculateReflectionIndex(values, peaks, valleys);
    
    return { augmentationIndex, reflectionIndex };
  }
  
  /**
   * Calculate blood pressure from PPG features
   */
  private calculatePressureFromFeatures(features: PPGFeatures): { systolic: number; diastolic: number } {
    // Base estimates
    let systolic = 120;
    let diastolic = 80;
    
    // Adjust based on amplitude
    const amplitudeEffect = 20 * (features.amplitude - 0.5);
    systolic += amplitudeEffect;
    diastolic += amplitudeEffect * 0.5;
    
    // Adjust based on timing
    const timeEffect = -30 * (features.peakToPeakTime - 0.8);
    systolic += timeEffect;
    diastolic += timeEffect * 0.5;
    
    // Adjust based on waveform indices
    systolic += 10 * (features.augmentationIndex - 0.3);
    diastolic += 5 * (features.reflectionIndex - 0.4);
    
    // Apply velocity ratio effect
    const velocityEffect = 15 * (features.velocityRatio - 0.6);
    systolic += velocityEffect;
    diastolic += velocityEffect * 0.5;
    
    // Apply user profile adjustments if available
    if (this.userProfile?.age) {
      const ageEffect = (this.userProfile.age - 50) * 0.3;
      systolic += ageEffect;
      diastolic += ageEffect * 0.5;
    }
    
    // Ensure physiological ranges
    systolic = Math.max(90, Math.min(180, systolic));
    diastolic = Math.max(50, Math.min(110, diastolic));
    
    return { systolic: Math.round(systolic), diastolic: Math.round(diastolic) };
  }
  
  /**
   * Calculate final result from measurement buffers
   */
  private calculateFinalResult(): { systolic: number; diastolic: number; quality: number } | null {
    if (this.systolicBuffer.length < this.MIN_SAMPLES * 0.8) {
      return null;
    }
    
    // Calculate median values
    const systolic = Math.round(this.calculateMedian(this.systolicBuffer));
    const diastolic = Math.round(this.calculateMedian(this.diastolicBuffer));
    const quality = this.calculateMean(this.qualityBuffer);
    
    this.lastValidMeasurement = { systolic, diastolic };
    
    return {
      systolic,
      diastolic,
      quality
    };
  }
  
  /**
   * Calculate median of an array
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
  
  /**
   * Reset the analyzer
   */
  public reset(): void {
    super.reset();
    this.startMeasurement();
    this.lastValidMeasurement = null;
  }
  
  // Helper methods for signal processing
  private calculateSecondDerivative(values: number[]): number[] {
    const result = [];
    for (let i = 2; i < values.length - 2; i++) {
      result.push(values[i+2] - 2*values[i] + values[i-2]);
    }
    return result;
  }
  
  private findInflectionPoints(derivative: number[]): number[] {
    const points = [];
    for (let i = 1; i < derivative.length - 1; i++) {
      if ((derivative[i] > 0 && derivative[i+1] < 0) || 
          (derivative[i] < 0 && derivative[i+1] > 0)) {
        points.push(i);
      }
    }
    return points;
  }
  
  private calculateAugmentationIndex(values: number[], inflectionPoints: number[]): number {
    if (inflectionPoints.length < 2) return 0;
    const firstPeak = Math.max(...values.slice(0, inflectionPoints[1]));
    const secondPeak = Math.max(...values.slice(inflectionPoints[1]));
    return secondPeak / firstPeak;
  }
  
  private calculateReflectionIndex(values: number[], peaks: number[], valleys: number[]): number {
    if (peaks.length < 2 || valleys.length < 2) return 0;
    const firstPeakHeight = peaks[0] - valleys[0];
    const secondPeakHeight = peaks[1] - valleys[1];
    return secondPeakHeight / firstPeakHeight;
  }
  
  private calculateVelocityRatio(values: number[], peaks: number[]): number {
    if (peaks.length < 2) return 0;
    const upstroke = peaks[1] - values[0];
    const downstroke = values[values.length-1] - peaks[0];
    return Math.abs(upstroke / downstroke);
  }
  
  private calculateSignalQuality(values: number[], amplitude: number, peakToPeakTime: number): number {
    // Check amplitude stability
    const amplitudeQuality = Math.min(1, amplitude / 0.5);
    
    // Check timing stability
    const timingQuality = Math.exp(-Math.abs(peakToPeakTime - 0.8));
    
    // Check signal noise
    const noise = this.calculateSignalNoise(values);
    const noiseQuality = Math.exp(-noise);
    
    return (amplitudeQuality + timingQuality + noiseQuality) / 3;
  }
  
  private calculateSignalNoise(values: number[]): number {
    let noise = 0;
    for (let i = 1; i < values.length; i++) {
      noise += Math.abs(values[i] - values[i-1]);
    }
    return noise / values.length;
  }
  
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}
