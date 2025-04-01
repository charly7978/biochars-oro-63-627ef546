
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized processor for cardiac measurements
 * Uses optimized cardiac signal for heart rate and arrhythmia detection
 * Enhanced with advanced detection algorithms
 */

import { BaseVitalSignProcessor } from './BaseVitalSignProcessor';
import { VitalSignType, ChannelFeedback } from '../../../types/signal';
import { AdaptiveThresholdCalculator } from '../enhanced-detection/adaptive-threshold';
import { performSpectralAnalysis } from '../enhanced-detection/spectral-analyzer';

/**
 * Result interface for cardiac measurements
 */
export interface CardiacResult {
  heartRate: number;
  arrhythmiaDetected: boolean;
  rhythmRegularity: number;
  signalQuality: number;  // Added signal quality metric
  confidenceScore: number; // Added confidence metric
}

/**
 * Cardiac processor implementation with enhanced detection algorithms
 */
export class CardiacProcessor extends BaseVitalSignProcessor<CardiacResult> {
  // Cardiac measurement parameters
  private readonly MAX_HEART_RATE = 180;  // bpm
  private readonly MIN_HEART_RATE = 40;   // bpm
  
  // Enhanced peak detection state
  private lastPeakTime: number = 0;
  private peakBuffer: number[] = [];
  private intervalBuffer: number[] = [];
  private readonly MAX_PEAK_BUFFER = 20;
  
  // Signal buffer for advanced analysis
  private signalBuffer: number[] = [];
  private readonly MAX_SIGNAL_BUFFER = 150; // 5 seconds at 30Hz
  
  // Advanced detection components
  private adaptiveThreshold: AdaptiveThresholdCalculator;
  private lastSignalQuality: number = 0;
  private useEnhancedDetection: boolean = true;
  private useSpectralAnalysis: boolean = true;
  
  constructor() {
    super(VitalSignType.CARDIAC);
    this.adaptiveThreshold = new AdaptiveThresholdCalculator();
  }
  
  /**
   * Process a value from the cardiac-optimized channel
   * @param value Optimized cardiac signal value
   * @returns Cardiac measurement results
   */
  protected processValueImpl(value: number): CardiacResult {
    // Store signal for analysis
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.MAX_SIGNAL_BUFFER) {
      this.signalBuffer.shift();
    }
    
    // Skip processing if the value is too small
    if (Math.abs(value) < 0.01) {
      return {
        heartRate: 0,
        arrhythmiaDetected: false,
        rhythmRegularity: 0,
        signalQuality: 0,
        confidenceScore: 0
      };
    }
    
    // Analyze signal quality using spectral analysis when we have enough data
    let signalQuality = this.lastSignalQuality;
    let useFrequencyDetection = false;
    
    if (this.useSpectralAnalysis && this.signalBuffer.length >= 90) { // 3 seconds at 30Hz
      const spectralResult = performSpectralAnalysis(this.signalBuffer.slice(-90));
      signalQuality = Math.min(1, Math.max(0, 
        spectralResult.signalToNoiseRatio * 0.2 + spectralResult.consistencyMetric * 0.8
      ));
      this.lastSignalQuality = signalQuality;
      
      // Use frequency-based detection if signal quality is poor but spectral analysis is good
      useFrequencyDetection = signalQuality > 0.6 && spectralResult.isValidSignal;
    }
    
    // Update adaptive threshold
    this.adaptiveThreshold.update(value, false, signalQuality);
    const threshold = this.adaptiveThreshold.getThreshold();
    
    // Choose detection method based on signal characteristics
    let isPeak = false;
    let peakConfidence = 0;
    
    if (this.useEnhancedDetection) {
      if (useFrequencyDetection) {
        // Use frequency domain detection for noisy signals
        const result = this.detectPeakFrequencyDomain(value);
        isPeak = result.isPeak;
        peakConfidence = result.confidence;
      } else {
        // Use enhanced time domain detection with adaptive threshold
        const result = this.detectPeakTimeDomain(value, threshold);
        isPeak = result.isPeak;
        peakConfidence = result.confidence;
      }
    } else {
      // Fallback to simple peak detection if needed
      isPeak = this.detectPeakSimple(value, threshold);
      peakConfidence = isPeak ? 0.7 : 0;
    }
    
    // Process the peak if detected
    if (isPeak) {
      this.processPeak(value, peakConfidence);
    }
    
    // Calculate heart rate from peaks
    const heartRate = this.calculateHeartRate();
    
    // Check for arrhythmia with enhanced detection
    const { arrhythmiaDetected, rhythmRegularity } = this.detectArrhythmia();
    
    // Calculate overall confidence score
    const confidenceScore = this.calculateConfidenceScore(heartRate, rhythmRegularity, signalQuality);
    
    return {
      heartRate: Math.round(heartRate),
      arrhythmiaDetected,
      rhythmRegularity,
      signalQuality,
      confidenceScore
    };
  }
  
  /**
   * Detect peaks using enhanced time domain analysis
   */
  private detectPeakTimeDomain(value: number, threshold: number): { isPeak: boolean, confidence: number } {
    // Need at least 3 values for peak detection
    if (this.signalBuffer.length < 3) {
      return { isPeak: false, confidence: 0 };
    }
    
    const len = this.signalBuffer.length;
    const now = Date.now();
    
    // Check time constraint - prevent too rapid detection
    if (this.lastPeakTime > 0 && now - this.lastPeakTime < 300) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Check if middle value is a peak with sufficient prominence
    const isPeak = this.signalBuffer[len-2] > this.signalBuffer[len-3] && 
                  this.signalBuffer[len-2] > this.signalBuffer[len-1] &&
                  this.signalBuffer[len-2] > threshold;
    
    if (!isPeak) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Calculate peak prominence (how much it stands out)
    const peakValue = this.signalBuffer[len-2];
    const baseline = (this.signalBuffer[len-3] + this.signalBuffer[len-1]) / 2;
    const prominence = peakValue - baseline;
    
    // Calculate confidence based on prominence and threshold
    const prominenceRatio = prominence / threshold;
    const confidence = Math.min(1, Math.max(0, prominenceRatio - 0.2));
    
    return { isPeak, confidence };
  }
  
  /**
   * Detect peaks using frequency domain analysis
   * Better for noisy signals
   */
  private detectPeakFrequencyDomain(value: number): { isPeak: boolean, confidence: number } {
    // Need enough data for frequency analysis
    if (this.signalBuffer.length < 90) { // 3 seconds at 30Hz
      return { isPeak: false, confidence: 0 };
    }
    
    const now = Date.now();
    
    // Check time constraint
    if (this.lastPeakTime > 0 && now - this.lastPeakTime < 300) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Check if the current point is a local maximum
    const len = this.signalBuffer.length;
    const isPeak = this.signalBuffer[len-2] > this.signalBuffer[len-3] && 
                  this.signalBuffer[len-2] > this.signalBuffer[len-1];
    
    if (!isPeak) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Use spectral analysis to validate this peak in the context of cardiac rhythm
    const spectral = performSpectralAnalysis(this.signalBuffer.slice(-90));
    
    // Check if peak matches expected frequency
    if (!spectral.isValidSignal || spectral.heartRateEstimate === 0) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Calculate expected interval between peaks based on dominant frequency
    const expectedInterval = 60000 / spectral.heartRateEstimate; // ms
    
    // If we have a previous peak, check if this one occurs at the expected time
    let timingConfidence = 0.5; // Default moderate confidence
    
    if (this.lastPeakTime > 0) {
      const actualInterval = now - this.lastPeakTime;
      const intervalDifference = Math.abs(actualInterval - expectedInterval);
      const intervalTolerance = expectedInterval * 0.2; // 20% tolerance
      
      // Higher confidence if timing matches expected frequency
      timingConfidence = intervalDifference < intervalTolerance ?
        1 - (intervalDifference / intervalTolerance) : 0.2;
    }
    
    // Calculate overall confidence
    const confidence = Math.min(1, Math.max(0.2, 
      timingConfidence * 0.6 + spectral.consistencyMetric * 0.4
    ));
    
    return { isPeak, confidence };
  }
  
  /**
   * Simple peak detection as fallback
   */
  private detectPeakSimple(value: number, threshold: number): boolean {
    if (this.signalBuffer.length < 3) return false;
    
    const len = this.signalBuffer.length;
    const now = Date.now();
    
    // Check minimum time between peaks
    if (this.lastPeakTime > 0 && now - this.lastPeakTime < 300) {
      return false;
    }
    
    // Check if middle value is a peak
    return this.signalBuffer[len-2] > this.signalBuffer[len-3] && 
           this.signalBuffer[len-2] > this.signalBuffer[len-1] &&
           this.signalBuffer[len-2] > threshold;
  }
  
  /**
   * Process a detected peak
   */
  private processPeak(value: number, confidence: number): void {
    const now = Date.now();
    
    // Calculate interval if we have a previous peak
    if (this.lastPeakTime > 0) {
      const interval = now - this.lastPeakTime;
      
      // Only accept physiologically plausible intervals
      if (interval > 300 && interval < 2000) {
        this.intervalBuffer.push(interval);
        if (this.intervalBuffer.length > 10) {
          this.intervalBuffer.shift();
        }
      }
    }
    
    // Update last peak time
    this.lastPeakTime = now;
    
    // Update peak buffer
    this.peakBuffer.push(value);
    if (this.peakBuffer.length > this.MAX_PEAK_BUFFER) {
      this.peakBuffer.shift();
    }
    
    // Update adaptive threshold with confirmed peak
    this.adaptiveThreshold.update(value, true, this.lastSignalQuality);
  }
  
  /**
   * Calculate heart rate from detected peaks
   */
  private calculateHeartRate(): number {
    if (this.intervalBuffer.length < 2) {
      return 0;
    }
    
    // Enhanced calculation with outlier rejection
    const sortedIntervals = [...this.intervalBuffer].sort((a, b) => a - b);
    
    // Remove potential outliers (outside 10th-90th percentile)
    const lowerIdx = Math.floor(sortedIntervals.length * 0.1);
    const upperIdx = Math.ceil(sortedIntervals.length * 0.9) - 1;
    
    const filteredIntervals = sortedIntervals.slice(lowerIdx, upperIdx + 1);
    
    // Calculate average interval from filtered data
    const avgInterval = filteredIntervals.reduce((sum, interval) => sum + interval, 0) / 
                       filteredIntervals.length;
    
    // Convert to BPM
    const heartRate = 60000 / avgInterval;
    
    // Ensure result is within physiological range
    return Math.min(this.MAX_HEART_RATE, Math.max(this.MIN_HEART_RATE, heartRate));
  }
  
  /**
   * Enhanced arrhythmia detection from interval pattern
   */
  private detectArrhythmia(): { arrhythmiaDetected: boolean, rhythmRegularity: number } {
    if (this.intervalBuffer.length < 3) {
      return {
        arrhythmiaDetected: false,
        rhythmRegularity: 0
      };
    }
    
    // Calculate interval variation and trend
    const avgInterval = this.intervalBuffer.reduce((sum, interval) => sum + interval, 0) / 
                       this.intervalBuffer.length;
    
    const variance = this.intervalBuffer.reduce(
      (sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0
    ) / this.intervalBuffer.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;
    
    // Calculate trend (are intervals getting shorter or longer?)
    let trendScore = 0;
    for (let i = 1; i < this.intervalBuffer.length; i++) {
      const diff = this.intervalBuffer[i] - this.intervalBuffer[i-1];
      trendScore += Math.sign(diff);
    }
    const normalizedTrendScore = Math.abs(trendScore) / (this.intervalBuffer.length - 1);
    
    // Calculate rhythm regularity (1 = perfectly regular, 0 = chaotic)
    // Penalize both high variation and strong trends
    const variationComponent = Math.max(0, 1 - coefficientOfVariation * 3);
    const trendComponent = Math.max(0, 1 - normalizedTrendScore);
    
    const rhythmRegularity = variationComponent * 0.8 + trendComponent * 0.2;
    
    // Enhanced arrhythmia detection with multiple criteria
    // 1. High coefficient of variation (irregular intervals)
    // 2. Presence of very short or very long intervals
    // 3. Strong accelerating or decelerating trend
    
    const hasExtremeIntervals = this.intervalBuffer.some(interval => 
      interval < avgInterval * 0.7 || interval > avgInterval * 1.4
    );
    
    const arrhythmiaDetected = rhythmRegularity < 0.7 || 
                              (hasExtremeIntervals && rhythmRegularity < 0.8) ||
                              (normalizedTrendScore > 0.7 && this.intervalBuffer.length >= 5);
    
    return {
      arrhythmiaDetected,
      rhythmRegularity
    };
  }
  
  /**
   * Calculate overall confidence score for the results
   */
  private calculateConfidenceScore(
    heartRate: number, 
    rhythmRegularity: number, 
    signalQuality: number
  ): number {
    if (heartRate === 0 || signalQuality < 0.2) {
      return 0;
    }
    
    // Physiological plausibility component
    let physiologicalScore = 1.0;
    if (heartRate < 50 || heartRate > 150) {
      physiologicalScore = 0.7; // Less common heart rates
    }
    
    // Combine factors for overall confidence
    return Math.min(1, Math.max(0,
      signalQuality * 0.4 +
      rhythmRegularity * 0.4 +
      physiologicalScore * 0.2
    ));
  }
  
  /**
   * Reset processor
   */
  public override reset(): void {
    super.reset();
    this.lastPeakTime = 0;
    this.peakBuffer = [];
    this.intervalBuffer = [];
    this.signalBuffer = [];
    this.adaptiveThreshold.reset();
    this.lastSignalQuality = 0;
  }
  
  /**
   * Configure processor settings
   */
  public configure(config: {
    useEnhancedDetection?: boolean;
    useSpectralAnalysis?: boolean;
  }): void {
    if (config.useEnhancedDetection !== undefined) {
      this.useEnhancedDetection = config.useEnhancedDetection;
    }
    
    if (config.useSpectralAnalysis !== undefined) {
      this.useSpectralAnalysis = config.useSpectralAnalysis;
    }
  }
}
