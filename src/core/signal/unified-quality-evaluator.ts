
import { ProcessorConfig } from '../config/ProcessorConfig';
import { FeedbackSystem } from '../feedback/feedback-system';

/**
 * Quality metrics for vital sign signal evaluation
 */
export interface QualityMetrics {
  amplitude: number;
  stability: number;
  periodicity: number;
  snr: number;
  physiological: number;
}

/**
 * Quality evaluation result
 */
export interface QualityResult {
  metrics: QualityMetrics;
  score: number;
  confidence: number;
  isValid: boolean;
  feedback?: {
    message: string;
    level: 'info' | 'warning' | 'error';
  };
}

/**
 * Signal quality levels
 */
export enum SignalQualityLevel {
  INVALID = 'invalid',
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent'
}

/**
 * Unified signal quality evaluator
 * Provides consistent quality assessment across all vital sign processors
 */
export class UnifiedQualityEvaluator {
  private config: ProcessorConfig;
  private feedbackSystem: FeedbackSystem;
  private lastResult: QualityResult | null = null;
  private signalHistory: number[][] = [];
  private readonly MAX_HISTORY_LENGTH = 10;
  
  constructor(config: ProcessorConfig, feedbackSystem: FeedbackSystem) {
    this.config = config;
    this.feedbackSystem = feedbackSystem;
  }
  
  /**
   * Evaluate signal quality with multiple metrics
   */
  public evaluateQuality(
    signal: number[], 
    sourceProcessor: string = 'unknown'
  ): QualityResult {
    // Update signal history
    this.updateSignalHistory(signal);
    
    // Calculate quality metrics
    const metrics = this.calculateQualityMetrics(signal);
    
    // Calculate overall score
    const score = this.calculateQualityScore(metrics);
    
    // Determine validity threshold
    const isValid = score > 0.3;
    
    // Calculate confidence based on metrics consistency
    const confidence = this.calculateConfidence(metrics);
    
    // Generate feedback if quality is poor
    let feedback;
    if (score < 0.3) {
      feedback = {
        message: 'Signal quality is poor, please adjust sensor',
        level: 'warning' as const
      };
      
      this.feedbackSystem.addFeedback(
        feedback.message,
        feedback.level,
        { sourceProcessor, quality: score }
      );
    }
    
    // Store result
    const result: QualityResult = {
      metrics,
      score,
      confidence,
      isValid,
      feedback
    };
    
    this.lastResult = result;
    return result;
  }
  
  /**
   * Update signal history for trend analysis
   */
  private updateSignalHistory(signal: number[]): void {
    // Only store recent values
    const recentSignal = signal.slice(-30);
    
    // Add to history
    this.signalHistory.push(recentSignal);
    
    // Limit history size
    if (this.signalHistory.length > this.MAX_HISTORY_LENGTH) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Calculate all quality metrics
   */
  private calculateQualityMetrics(signal: number[]): QualityMetrics {
    if (signal.length < 10) {
      return {
        amplitude: 0,
        stability: 0,
        periodicity: 0,
        snr: 0,
        physiological: 0
      };
    }
    
    // Use recent signal for calculations
    const recentSignal = signal.slice(-30);
    
    // Calculate amplitude
    const min = Math.min(...recentSignal);
    const max = Math.max(...recentSignal);
    const amplitude = Math.min(1, (max - min) / 0.5);
    
    // Calculate stability
    const stability = this.calculateStability(recentSignal);
    
    // Calculate periodicity
    const periodicity = this.calculatePeriodicity(recentSignal);
    
    // Calculate signal-to-noise ratio
    const snr = this.calculateSNR(recentSignal);
    
    // Calculate physiological plausibility
    const physiological = this.calculatePhysiologicalPlausibility(recentSignal);
    
    return {
      amplitude,
      stability,
      periodicity,
      snr,
      physiological
    };
  }
  
  /**
   * Calculate signal stability (0-1)
   */
  private calculateStability(signal: number[]): number {
    if (signal.length < 10) return 0;
    
    // Calculate differences between adjacent samples
    const diffs = [];
    for (let i = 1; i < signal.length; i++) {
      diffs.push(Math.abs(signal[i] - signal[i-1]));
    }
    
    // Calculate average and standard deviation of differences
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const varDiff = diffs.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diffs.length;
    const stdDiff = Math.sqrt(varDiff);
    
    // Normalize to 0-1 (lower is better)
    const normalizedStdDiff = Math.min(1, stdDiff / 0.1);
    
    // Convert to stability score (higher is better)
    return Math.max(0, 1 - normalizedStdDiff);
  }
  
  /**
   * Calculate signal periodicity (0-1)
   */
  private calculatePeriodicity(signal: number[]): number {
    if (signal.length < 20) return 0;
    
    // Find peaks
    const peaks = this.findPeaks(signal);
    if (peaks.length < 3) return 0;
    
    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate average and standard deviation
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // More consistent intervals = higher periodicity score
    // Normalized coefficient of variation (lower is better)
    const cv = avg > 0 ? stdDev / avg : 1;
    
    // Convert to score (0-1)
    return Math.max(0, Math.min(1, 1 - cv));
  }
  
  /**
   * Find peaks in signal
   */
  private findPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const threshold = 0.1;
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1] && signal[i] > threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calculate signal-to-noise ratio (0-1)
   */
  private calculateSNR(signal: number[]): number {
    if (signal.length < 10) return 0;
    
    // Use recent signal for calculations
    const recentSignal = signal.slice(-30);
    
    // Calculate moving average as signal estimate
    const windowSize = 5;
    const smoothed = [];
    
    for (let i = 0; i < recentSignal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(recentSignal.length - 1, i + windowSize); j++) {
        sum += recentSignal[j];
        count++;
      }
      
      smoothed.push(sum / count);
    }
    
    // Calculate signal power
    let signalPower = 0;
    for (let i = 0; i < smoothed.length; i++) {
      signalPower += smoothed[i] * smoothed[i];
    }
    signalPower /= smoothed.length;
    
    // Calculate noise (residual)
    let noisePower = 0;
    for (let i = 0; i < recentSignal.length; i++) {
      const noise = recentSignal[i] - smoothed[i];
      noisePower += noise * noise;
    }
    noisePower /= recentSignal.length;
    
    // Avoid division by zero
    if (noisePower < 0.0001) return 1;
    
    // Calculate SNR
    const snr = signalPower / noisePower;
    
    // Normalize to 0-1
    return Math.min(1, snr / 10);
  }
  
  /**
   * Calculate physiological plausibility (0-1)
   */
  private calculatePhysiologicalPlausibility(signal: number[]): number {
    if (signal.length < 10) return 0;
    
    // Find peaks
    const peaks = this.findPeaks(signal);
    if (peaks.length < 2) return 0;
    
    // Calculate time between peaks (in samples)
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate implied heart rate (assuming 30Hz sampling)
    // BPM = 60 * (sampling rate / average interval)
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const impliedBPM = avgInterval > 0 ? 60 * (30 / avgInterval) : 0;
    
    // Check if heart rate is in physiological range (40-200 BPM)
    if (impliedBPM < 40 || impliedBPM > 200) return 0;
    
    // Higher score for rates closer to normal range (60-100 BPM)
    let normalcy = 0;
    if (impliedBPM >= 60 && impliedBPM <= 100) {
      normalcy = 1;
    } else if (impliedBPM < 60) {
      normalcy = 1 - (60 - impliedBPM) / 20; // Linear decrease from 60 to 40 BPM
    } else {
      normalcy = 1 - (impliedBPM - 100) / 100; // Linear decrease from 100 to 200 BPM
    }
    
    return Math.max(0, normalcy);
  }
  
  /**
   * Calculate overall quality score (0-1)
   */
  private calculateQualityScore(metrics: QualityMetrics): number {
    // Weighted average of all metrics
    return (
      metrics.amplitude * 0.2 +
      metrics.stability * 0.25 +
      metrics.periodicity * 0.25 +
      metrics.snr * 0.2 +
      metrics.physiological * 0.1
    );
  }
  
  /**
   * Calculate confidence in quality assessment (0-1)
   */
  private calculateConfidence(metrics: QualityMetrics): number {
    // More history = higher confidence
    const historyFactor = Math.min(1, this.signalHistory.length / this.MAX_HISTORY_LENGTH);
    
    // Higher metrics = higher confidence
    const metricsAvg = (
      metrics.amplitude +
      metrics.stability +
      metrics.periodicity +
      metrics.snr +
      metrics.physiological
    ) / 5;
    
    return Math.min(1, historyFactor * 0.3 + metricsAvg * 0.7);
  }
  
  /**
   * Get quality level from score
   */
  public getQualityLevel(score: number): SignalQualityLevel {
    if (score < 0.3) return SignalQualityLevel.INVALID;
    if (score < 0.5) return SignalQualityLevel.POOR;
    if (score < 0.7) return SignalQualityLevel.FAIR;
    if (score < 0.9) return SignalQualityLevel.GOOD;
    return SignalQualityLevel.EXCELLENT;
  }
  
  /**
   * Get last quality result
   */
  public getLastResult(): QualityResult | null {
    return this.lastResult;
  }
  
  /**
   * Reset evaluator state
   */
  public reset(): void {
    this.signalHistory = [];
    this.lastResult = null;
  }
}
