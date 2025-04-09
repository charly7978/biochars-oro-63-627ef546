
/**
 * Unified Signal Quality Evaluation System
 * Provides standardized quality assessment across all vital sign processors
 */

import { SignalQuality } from '../../modules/vital-signs/processors/signal-quality';
import { AdaptiveOptimizer } from './AdaptiveOptimizer';
import { ProcessorConfig } from '../config/ProcessorConfig';
import { FeedbackSystem, FeedbackLevel } from '../feedback/feedback-system';

export interface QualityResult {
  score: number;         // 0-1 score of overall quality
  confidence: number;    // 0-1 confidence in the measurement
  isValid: boolean;      // Whether the signal is valid enough for processing
  metrics: {
    amplitude: number;   // Signal amplitude
    stability: number;   // Signal stability
    periodicity: number; // Signal periodicity
    snr: number;         // Signal-to-noise ratio
    physiological: number; // Whether the signal matches physiological patterns
  };
  feedback?: {
    message: string;
    level: FeedbackLevel;
  };
}

/**
 * Unified system for evaluating signal quality across all vital signs processors
 * Integrates with feedback system and adaptive optimization
 */
export class UnifiedQualityEvaluator {
  private signalQuality: SignalQuality;
  private adaptiveOptimizer: AdaptiveOptimizer;
  private feedbackSystem?: FeedbackSystem;
  private signalHistory: number[] = [];
  private qualityHistory: QualityResult[] = [];
  private readonly MAX_HISTORY = 30;
  
  // Sharing state between processors
  private static sharedQualityState: Map<string, number> = new Map();
  
  constructor(config: ProcessorConfig, feedbackSystem?: FeedbackSystem) {
    this.signalQuality = new SignalQuality();
    this.adaptiveOptimizer = new AdaptiveOptimizer({
      learningRate: 0.05,
      adaptationWindow: 50,
      thresholds: {
        signalQuality: config.nonInvasiveSettings.confidenceThreshold,
        signalAmplitude: 0.05,
        signalStability: 0.1
      }
    });
    this.feedbackSystem = feedbackSystem;
  }
  
  /**
   * Evaluate signal quality with enhanced metrics
   */
  public evaluateQuality(signal: number[], type: string): QualityResult {
    if (signal.length < 5) {
      return this.createLowQualityResult('Insufficient signal data');
    }
    
    // Store current signal value
    if (signal.length > 0) {
      this.signalHistory.push(signal[signal.length - 1]);
      if (this.signalHistory.length > this.MAX_HISTORY) {
        this.signalHistory.shift();
      }
    }
    
    // Calculate quality metrics
    const amplitude = this.calculateAmplitude(signal);
    const stability = this.calculateStability(signal);
    const periodicity = this.signalQuality.calculatePeriodicityQuality();
    const snr = this.calculateSNR(signal);
    const physiological = this.isPhysiologicallyValid(signal, type);
    
    // Update the adaptive optimizer
    this.adaptiveOptimizer.updateParameters({
      signalQuality: physiological,
      signalAmplitude: amplitude / 0.3, // Normalize to 0-1 range
      signalStability: stability
    });
    
    // Calculate combined quality score using adaptive weighting
    const weights = this.adaptiveOptimizer.getOptimizedWeights();
    const weightedScore = (
      amplitude * weights.signalAmplitude +
      stability * weights.signalStability +
      periodicity * 0.2 +
      snr * 0.15 +
      physiological * 0.25
    );
    
    // Share quality metrics across processors
    UnifiedQualityEvaluator.sharedQualityState.set(`${type}_quality`, weightedScore);
    UnifiedQualityEvaluator.sharedQualityState.set(`${type}_amplitude`, amplitude);
    UnifiedQualityEvaluator.sharedQualityState.set(`${type}_snr`, snr);
    
    // Determine confidence and validity
    const confidence = this.calculateConfidence(weightedScore, type);
    const isValid = confidence > 0.5 && amplitude > 0.03 && physiological > 0.4;
    
    // Generate quality result
    const result: QualityResult = {
      score: Math.min(1, Math.max(0, weightedScore)),
      confidence,
      isValid,
      metrics: {
        amplitude,
        stability,
        periodicity,
        snr,
        physiological
      }
    };
    
    // Generate feedback based on quality
    result.feedback = this.generateFeedback(result);
    
    // Store quality history
    this.qualityHistory.push(result);
    if (this.qualityHistory.length > this.MAX_HISTORY) {
      this.qualityHistory.shift();
    }
    
    return result;
  }
  
  /**
   * Check if signal is physiologically valid based on type
   */
  private isPhysiologicallyValid(signal: number[], type: string): number {
    // Retrieve prior signal quality from other processors if available
    const priorQualities = Array.from(UnifiedQualityEvaluator.sharedQualityState.entries())
      .filter(([key]) => key.endsWith('_quality') && !key.startsWith(type))
      .map(([, value]) => value);
    
    // Use shared information to improve validation
    let priorQualityFactor = 1.0;
    if (priorQualities.length > 0) {
      const avgPriorQuality = priorQualities.reduce((sum, val) => sum + val, 0) / priorQualities.length;
      priorQualityFactor = 0.7 + (0.3 * avgPriorQuality); // Blend with prior quality (70% current, 30% prior)
    }
    
    // Use the signal quality class for physiological validation
    const physiologicalScore = this.signalQuality.calculateSignalQuality(signal) * priorQualityFactor;
    
    return Math.min(1, Math.max(0, physiologicalScore));
  }
  
  /**
   * Calculate signal amplitude
   */
  private calculateAmplitude(signal: number[]): number {
    if (signal.length < 2) return 0;
    const recentValues = signal.slice(-15);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    return max - min;
  }
  
  /**
   * Calculate signal stability
   */
  private calculateStability(signal: number[]): number {
    if (signal.length < 5) return 0;
    
    const recentValues = signal.slice(-10);
    const diffs = [];
    
    for (let i = 1; i < recentValues.length; i++) {
      diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const normalizedStability = Math.max(0, 1 - (avgDiff * 10)); // Lower diffs = higher stability
    
    return Math.min(1, normalizedStability);
  }
  
  /**
   * Calculate signal-to-noise ratio
   */
  private calculateSNR(signal: number[]): number {
    if (signal.length < 10) return 0;
    
    // Get signal power
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    
    // Estimate noise from signal quality class
    const noiseLevel = this.signalQuality.getNoiseLevel();
    
    // Calculate SNR
    if (noiseLevel === 0) return 1; // Avoid division by zero
    const snr = variance / (noiseLevel * noiseLevel);
    
    // Normalize to 0-1 range
    return Math.min(1, snr / 10);
  }
  
  /**
   * Calculate confidence in measurement based on quality history
   */
  private calculateConfidence(currentQuality: number, type: string): number {
    if (this.qualityHistory.length < 3) return currentQuality;
    
    // Get recent quality scores
    const recentScores = this.qualityHistory.slice(-5).map(q => q.score);
    
    // Check for stability in measurements
    const avgScore = recentScores.reduce((sum, val) => sum + val, 0) / recentScores.length;
    const scoreVariation = recentScores.reduce((sum, val) => sum + Math.pow(val - avgScore, 2), 0) / recentScores.length;
    const stabilityFactor = Math.max(0, 1 - (scoreVariation * 5)); // Lower variation = higher stability
    
    // Incorporate other signal types if available
    let crossSignalConfidence = 1.0;
    if (type !== 'heartRate') {
      const hrQuality = UnifiedQualityEvaluator.sharedQualityState.get('heartRate_quality') || 0;
      crossSignalConfidence = 0.7 + (0.3 * hrQuality); // Heart rate quality affects other vital signs
    }
    
    // Calculate weighted confidence
    const confidence = currentQuality * 0.6 + stabilityFactor * 0.2 + crossSignalConfidence * 0.2;
    
    return Math.min(1, Math.max(0, confidence));
  }
  
  /**
   * Generate feedback based on quality assessment
   */
  private generateFeedback(quality: QualityResult): { message: string; level: FeedbackLevel } | undefined {
    if (!this.feedbackSystem) return undefined;
    
    let message = '';
    let level: FeedbackLevel = 'info';
    
    if (quality.score < 0.3) {
      message = 'Signal quality is too low. Please adjust your finger position.';
      level = 'error';
    } else if (quality.score < 0.5) {
      message = 'Signal quality could be improved. Keep your finger steady.';
      level = 'warning';
    } else if (quality.metrics.stability < 0.4) {
      message = 'Try to keep your finger more stable for better readings.';
      level = 'info';
    } else if (quality.score > 0.8) {
      message = 'Excellent signal quality, measurements are highly reliable.';
      level = 'success';
    }
    
    if (message && this.feedbackSystem) {
      this.feedbackSystem.addFeedback(message, level, { qualityScore: quality.score });
    }
    
    return message ? { message, level } : undefined;
  }
  
  /**
   * Create a low quality result with feedback
   */
  private createLowQualityResult(reason: string): QualityResult {
    return {
      score: 0,
      confidence: 0,
      isValid: false,
      metrics: {
        amplitude: 0,
        stability: 0,
        periodicity: 0,
        snr: 0,
        physiological: 0
      },
      feedback: {
        message: reason,
        level: 'error'
      }
    };
  }
  
  /**
   * Get quality history
   */
  public getQualityHistory(): QualityResult[] {
    return [...this.qualityHistory];
  }
  
  /**
   * Get current noise level
   */
  public getNoiseLevel(): number {
    return this.signalQuality.getNoiseLevel();
  }
  
  /**
   * Update noise level
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    this.signalQuality.updateNoiseLevel(rawValue, filteredValue);
  }
  
  /**
   * Reset the evaluator
   */
  public reset(): void {
    this.signalHistory = [];
    this.qualityHistory = [];
    this.signalQuality.reset();
    this.adaptiveOptimizer.reset();
  }
  
  /**
   * Get optimized parameters from adaptive optimizer
   */
  public getOptimizedParameters(): any {
    return this.adaptiveOptimizer.getOptimizedParameters();
  }
  
  /**
   * Statically clear shared quality state
   */
  public static clearSharedState(): void {
    UnifiedQualityEvaluator.sharedQualityState.clear();
  }
}
