
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Enhanced Signal quality assessment with frequency domain analysis
 * All methods work with real data only, no simulation
 * Improved to reduce false positives and increase reliability
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 5;  // Increased from 3
  
  // Enhanced signal quality metrics
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 50;  // Larger history for better frequency analysis
  private readonly SAMPLE_RATE = 30;   // Assumed sample rate in Hz
  
  // Frequency domain analysis buffers
  private peakFrequencies: number[] = [];
  private lastQualityScores: number[] = [];
  private lastPeriodicityScores: number[] = [];
  
  /**
   * Enhanced noise level update with exponential forgetting
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    // Slower adaptation to reduce impact of transient noise
    this.noiseLevel = 0.05 * instantNoise + 0.95 * this.noiseLevel;
    
    // Store signal for frequency domain analysis
    this.signalHistory.push(filteredValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Get current noise level
   */
  public getNoiseLevel(): number {
    return this.noiseLevel;
  }
  
  /**
   * Calculate signal quality - using only real data with improved validation
   * Adds validation to reduce false positives
   */
  public calculateSignalQuality(ppgValues: number[]): number {
    if (ppgValues.length < 5) return 0;
    
    // Calculate amplitude and standard deviation
    const min = Math.min(...ppgValues.slice(-10));
    const max = Math.max(...ppgValues.slice(-10));
    const amplitude = max - min;
    
    // Only consider valid signals with sufficient amplitude
    if (amplitude < 0.03) {   // Increased from 0.02 for more reliability
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MIN_STRONG_SIGNALS_REQUIRED + 2, 
        this.consecutiveStrongSignals + 1
      );
    }
    
    // Only return positive quality after we've seen enough strong signals
    if (this.consecutiveStrongSignals < this.MIN_STRONG_SIGNALS_REQUIRED) {
      return 0;
    }
    
    // Calculate quality based on real signal properties with improved metrics
    const weightedQuality = this.calculateWeightedQuality(ppgValues);
    const periodicityQuality = this.calculatePeriodicityQuality();
    
    // Combine time and frequency domain quality metrics
    const combinedQuality = 0.6 * weightedQuality + 0.4 * periodicityQuality;
    
    // Store quality score for trend analysis
    this.lastQualityScores.push(combinedQuality);
    if (this.lastQualityScores.length > 5) {
      this.lastQualityScores.shift();
    }
    
    // Average recent quality scores for stability
    return this.lastQualityScores.reduce((sum, q) => sum + q, 0) / this.lastQualityScores.length;
  }
  
  /**
   * Calculate weighted quality score based on real signal properties only
   * No simulation or manipulation, only direct measurement analysis
   */
  private calculateWeightedQuality(ppgValues: number[]): number {
    if (ppgValues.length < 10) return 0;
    
    // Get recent values for analysis
    const recentValues = ppgValues.slice(-15);  // Increased window from 10 to 15
    
    // Calculate signal amplitude (min to max) - real data only
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calculate average and standard deviation - real data only
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    // Calculate noise to signal ratio - real data only
    const noiseToSignalRatio = this.noiseLevel / (amplitude + 0.001);
    
    // Calculate consistency of peak spacing - real data only
    let peakConsistency = this.calculatePeakConsistency(recentValues);
    
    // Calculate signal rate of change - smoother signals are better
    const derivatives = recentValues.slice(1).map((val, i) => Math.abs(val - recentValues[i]));
    const avgDerivative = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
    const normalizedDerivative = Math.min(1, Math.max(0, 1 - avgDerivative * 10));
    
    // Calculate overall quality score with weighted components - real data only
    const amplitudeScore = Math.min(1, amplitude / 0.3);  // Normalize amplitude with lower threshold
    const stdDevScore = Math.min(1, Math.max(0, 1 - noiseToSignalRatio * 2));  // More strict noise requirement
    const derivativeScore = normalizedDerivative;  // Smooth signals get higher scores
    
    // Weight the factors to get overall quality
    const weightedScore = (
      amplitudeScore * 0.35 +          // 35% amplitude
      stdDevScore * 0.35 +             // 35% signal-to-noise
      peakConsistency * 0.15 +         // 15% peak consistency
      derivativeScore * 0.15           // 15% signal smoothness
    );
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, weightedScore));
  }
  
  /**
   * Calculate peak consistency based on real data
   */
  private calculatePeakConsistency(values: number[]): number {
    let peakConsistency = 0;
    let lastPeakIndex = -1;
    let peakSpacings: number[] = [];
    
    // Find peaks
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        if (lastPeakIndex !== -1) {
          peakSpacings.push(i - lastPeakIndex);
        }
        lastPeakIndex = i;
      }
    }
    
    if (peakSpacings.length >= 2) {
      const avgSpacing = peakSpacings.reduce((sum, val) => sum + val, 0) / peakSpacings.length;
      const spacingVariance = peakSpacings.reduce((sum, val) => sum + Math.pow(val - avgSpacing, 2), 0) / peakSpacings.length;
      const spacingCoeffOfVar = Math.sqrt(spacingVariance) / avgSpacing;
      peakConsistency = Math.max(0, 1 - spacingCoeffOfVar);
      
      // Store detected heart rate frequency for trend analysis
      if (avgSpacing > 0) {
        const estimatedFrequency = this.SAMPLE_RATE / avgSpacing;
        this.peakFrequencies.push(estimatedFrequency);
        if (this.peakFrequencies.length > 4) {
          this.peakFrequencies.shift();
        }
      }
    }
    
    return peakConsistency;
  }
  
  /**
   * Calculate periodicity quality using frequency domain analysis
   * Higher scores for signals with clear periodicity in expected heart rate range
   */
  private calculatePeriodicityQuality(): number {
    if (this.signalHistory.length < 30) return 0.5;  // Need enough samples
    
    // Simplified frequency analysis using autocorrelation
    const signalSegment = this.signalHistory.slice(-30);
    const normalizedSegment = this.normalizeSignal(signalSegment);
    
    // Calculate autocorrelation at different lags to find periodicity
    const maxLag = Math.floor(signalSegment.length / 2);
    const correlations: number[] = [];
    
    for (let lag = 2; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < signalSegment.length - lag; i++) {
        sum += normalizedSegment[i] * normalizedSegment[i + lag];
      }
      correlations.push(sum / (signalSegment.length - lag));
    }
    
    // Find the peak correlation (excluding the zero lag)
    let maxCorrelation = -1;
    let bestLag = 0;
    
    for (let i = 0; i < correlations.length; i++) {
      if (correlations[i] > maxCorrelation) {
        maxCorrelation = correlations[i];
        bestLag = i + 2;  // +2 because we started from lag 2
      }
    }
    
    // Convert best lag to frequency and check if it's in valid heart rate range
    const detectedFrequency = this.SAMPLE_RATE / bestLag;
    const isValidHeartRateFreq = detectedFrequency >= 0.5 && detectedFrequency <= 3.0;  // 30-180 BPM
    
    // Score based on correlation strength and physiological plausibility
    let periodicityScore = maxCorrelation * (isValidHeartRateFreq ? 1.0 : 0.3);
    
    // Add bonus for stable frequency over time
    if (this.peakFrequencies.length >= 3 && isValidHeartRateFreq) {
      // Check if detected frequency is consistent with recent peak frequency history
      const avgPeakFreq = this.peakFrequencies.reduce((sum, f) => sum + f, 0) / this.peakFrequencies.length;
      const freqDifference = Math.abs(detectedFrequency - avgPeakFreq) / avgPeakFreq;
      
      // If frequencies are close (within 15%), add consistency bonus
      if (freqDifference < 0.15) {
        periodicityScore = Math.min(1, periodicityScore * 1.2);
      }
    }
    
    // Store for trend analysis
    this.lastPeriodicityScores.push(periodicityScore);
    if (this.lastPeriodicityScores.length > 3) {
      this.lastPeriodicityScores.shift();
    }
    
    // Smooth periodicity scores
    return this.lastPeriodicityScores.reduce((sum, score) => sum + score, 0) / 
           this.lastPeriodicityScores.length;
  }
  
  /**
   * Normalize signal to zero mean and unit variance
   */
  private normalizeSignal(signal: number[]): number[] {
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return signal.map(() => 0);
    return signal.map(val => (val - mean) / stdDev);
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
    this.signalHistory = [];
    this.peakFrequencies = [];
    this.lastQualityScores = [];
    this.lastPeriodicityScores = [];
  }
}
