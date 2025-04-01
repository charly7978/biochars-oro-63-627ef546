
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { performSTFT } from '../spectral/stft-analyzer';
import { performCWT } from '../spectral/cwt-analyzer';
import { KalmanFilter } from '../filters/kalman-filter';

/**
 * Heart rate detection functions for real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced for natural rhythm detection and clear beats
 * Now with advanced spectral analysis and estimator fusion
 */
export class HeartRateDetector {
  // Store recent peaks for consistent timing analysis
  private peakTimes: number[] = [];
  private lastProcessTime: number = 0;
  
  // Advanced spectral analysis storage
  private spectralEstimates: number[] = [];
  private timeEstimates: number[] = [];
  private fusedHeartRate: number = 0;
  
  // Kalman filter for data fusion
  private kalmanFilter: KalmanFilter;
  
  // Confidence weights for estimator fusion
  private timeWeight: number = 0.6;
  private spectralWeight: number = 0.4;
  
  // Adaptive spectral analysis parameters
  private readonly MIN_SPECTRAL_WINDOW = 4; // seconds
  private readonly MAX_SPECTRAL_WINDOW = 8; // seconds
  private readonly DEFAULT_SAMPLE_RATE = 30; // Hz
  
  constructor() {
    // Initialize Kalman filter for heart rate fusion
    this.kalmanFilter = new KalmanFilter({
      stateSize: 1,
      observationSize: 1,
      processNoise: 0.01,
      observationNoise: 0.1,
      initialState: [75] // Initial heart rate estimate of 75 BPM
    });
  }
  
  /**
   * Calculate heart rate from real PPG values with enhanced fusion approach
   * Combines time-domain and frequency-domain methods
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < sampleRate * 1.0) { // Mínimo 1 segundo de datos
      return 0;
    }
    
    const now = Date.now();
    
    // Track processing time for natural timing
    const timeDiff = now - this.lastProcessTime;
    this.lastProcessTime = now;
    
    // Get recent real data - analizamos más datos para mejor detección
    const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 8)); // Ventana más amplia
    
    // Calculate signal statistics for adaptive thresholding
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    const stdDev = Math.sqrt(
      recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentData.length
    );
    
    // 1. Time-domain method: Find peaks with enhanced peak detector
    const peaks = this.findPeaksEnhanced(recentData, mean, stdDev);
    let timeBasedHeartRate = 0;
    
    if (peaks.length >= 2) {
      // Convert peak indices to timestamps for natural timing
      const sampleDuration = timeDiff / recentData.length;
      const peakTimes = peaks.map(idx => now - (recentData.length - idx) * sampleDuration);
      
      // Update stored peak times
      this.peakTimes = [...this.peakTimes, ...peakTimes].slice(-15);
      
      // Calculate intervals between consecutive peaks
      const intervals: number[] = [];
      for (let i = 1; i < this.peakTimes.length; i++) {
        const interval = this.peakTimes[i] - this.peakTimes[i-1];
        // Only use physiologically plausible intervals (30-240 BPM)
        if (interval >= 250 && interval <= 2000) {
          intervals.push(interval);
        }
      }
      
      if (intervals.length >= 2) {
        // Calculate average interval with outlier rejection - mejora en el filtrado
        intervals.sort((a, b) => a - b);
        const filteredIntervals = intervals.slice(
          Math.floor(intervals.length * 0.1),
          Math.ceil(intervals.length * 0.9)
        );
        
        if (filteredIntervals.length > 0) {
          const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
          // Convert to beats per minute
          timeBasedHeartRate = Math.round(60000 / avgInterval);
        }
      } else {
        // Fall back to sample-based calculation if not enough timestamp-based intervals
        let totalInterval = 0;
        for (let i = 1; i < peaks.length; i++) {
          totalInterval += peaks[i] - peaks[i - 1];
        }
        
        const avgInterval = totalInterval / (peaks.length - 1);
        timeBasedHeartRate = Math.round(60 / (avgInterval / sampleRate));
      }
      
      // Store time-domain estimate
      if (timeBasedHeartRate >= 30 && timeBasedHeartRate <= 240) {
        this.timeEstimates.push(timeBasedHeartRate);
        if (this.timeEstimates.length > 5) this.timeEstimates.shift();
      }
    }
    
    // 2. Frequency-domain method: STFT and CWT for spectral analysis
    let spectralHeartRate = 0;
    
    // Determine optimal window size based on signal quality
    const signalQuality = this.calculateSignalQuality(recentData);
    const windowSize = Math.max(
      this.MIN_SPECTRAL_WINDOW, 
      Math.min(this.MAX_SPECTRAL_WINDOW, 8 - (signalQuality / 25))
    );
    
    // Enough data for spectral analysis?
    if (recentData.length >= sampleRate * windowSize) {
      // Perform STFT analysis
      const stftResult = performSTFT(recentData, sampleRate, windowSize);
      
      // Perform CWT analysis
      const cwtResult = performCWT(recentData, sampleRate, windowSize);
      
      // Weight the spectral estimates based on their confidence
      if (stftResult.confidence > 0.6 && cwtResult.confidence > 0.6) {
        spectralHeartRate = (stftResult.bpm * stftResult.confidence + 
                             cwtResult.bpm * cwtResult.confidence) / 
                            (stftResult.confidence + cwtResult.confidence);
      } else if (stftResult.confidence > 0.6) {
        spectralHeartRate = stftResult.bpm;
      } else if (cwtResult.confidence > 0.6) {
        spectralHeartRate = cwtResult.bpm;
      }
      
      // Store spectral estimate
      if (spectralHeartRate >= 30 && spectralHeartRate <= 240) {
        this.spectralEstimates.push(spectralHeartRate);
        if (this.spectralEstimates.length > 5) this.spectralEstimates.shift();
      }
    }
    
    // 3. Data fusion: Combine time and frequency domain estimates
    let finalHeartRate = 0;
    
    // Adaptive weight adjustment based on signal quality and consistency
    this.updateWeights(timeBasedHeartRate, spectralHeartRate, signalQuality);
    
    // Calculate smoothed estimates
    const smoothedTimeEstimate = this.timeEstimates.length > 0 ? 
      this.timeEstimates.reduce((sum, val) => sum + val, 0) / this.timeEstimates.length : 0;
      
    const smoothedSpectralEstimate = this.spectralEstimates.length > 0 ? 
      this.spectralEstimates.reduce((sum, val) => sum + val, 0) / this.spectralEstimates.length : 0;
    
    // Apply Kalman filter for optimal fusion
    if (smoothedTimeEstimate > 0 && smoothedSpectralEstimate > 0) {
      const weightedEstimate = (smoothedTimeEstimate * this.timeWeight) + 
                               (smoothedSpectralEstimate * this.spectralWeight);
                               
      this.kalmanFilter.predict();
      this.kalmanFilter.update([weightedEstimate]);
      finalHeartRate = Math.round(this.kalmanFilter.getState()[0]);
    } else if (smoothedTimeEstimate > 0) {
      this.kalmanFilter.predict();
      this.kalmanFilter.update([smoothedTimeEstimate]);
      finalHeartRate = Math.round(this.kalmanFilter.getState()[0]);
    } else if (smoothedSpectralEstimate > 0) {
      this.kalmanFilter.predict();
      this.kalmanFilter.update([smoothedSpectralEstimate]);
      finalHeartRate = Math.round(this.kalmanFilter.getState()[0]);
    } else {
      finalHeartRate = 0; // No reliable estimate available
    }
    
    // Store fused estimate
    this.fusedHeartRate = finalHeartRate;
    
    return finalHeartRate;
  }
  
  /**
   * Evaluate signal quality for adaptive processing
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) {
      return 0;
    }
    
    // Calculate signal statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const amplitude = max - min;
    
    // Calculate variance
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Signal to noise ratio (simplified)
    const snr = amplitude / (stdDev + 0.0001);
    
    // Calculate periodicity
    let periodicity = 0;
    if (values.length > 20) {
      const autocorr = this.calculateAutocorrelation(values);
      periodicity = this.evaluatePeriodicity(autocorr);
    }
    
    // Combine metrics
    const quality = Math.min(100, 
      (snr * 10) + (periodicity * 50) + Math.min(30, amplitude * 100)
    );
    
    return Math.max(0, quality);
  }
  
  /**
   * Calculate autocorrelation to detect periodicity
   */
  private calculateAutocorrelation(values: number[]): number[] {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const centered = values.map(v => v - mean);
    
    const autocorr: number[] = [];
    const n = centered.length;
    
    for (let lag = 0; lag < Math.min(n, 100); lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += centered[i] * centered[i + lag];
      }
      autocorr.push(sum / (n - lag));
    }
    
    // Normalize
    const maxVal = autocorr[0];
    return autocorr.map(v => v / maxVal);
  }
  
  /**
   * Evaluate periodicity from autocorrelation
   */
  private evaluatePeriodicity(autocorr: number[]): number {
    if (autocorr.length < 20) return 0;
    
    // Skip the first few lags to avoid self-correlation
    const relevantPart = autocorr.slice(5);
    
    // Find peaks in autocorrelation
    const peaks: number[] = [];
    for (let i = 1; i < relevantPart.length - 1; i++) {
      if (relevantPart[i] > relevantPart[i-1] && relevantPart[i] > relevantPart[i+1] && 
          relevantPart[i] > 0.2) {
        peaks.push(i + 5); // Adjust for slice offset
      }
    }
    
    if (peaks.length < 2) return 0;
    
    // Check if peaks have consistent spacing (indicating periodicity)
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate interval consistency
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const intervalConsistency = Math.max(0, 1 - Math.sqrt(intervalVariance) / avgInterval);
    
    // Peak strength score
    const peakHeights = peaks.map(p => autocorr[p]);
    const avgPeakHeight = peakHeights.reduce((sum, val) => sum + val, 0) / peakHeights.length;
    
    // Combine metrics
    return intervalConsistency * avgPeakHeight;
  }
  
  /**
   * Update estimator weights based on performance
   */
  private updateWeights(timeEstimate: number, spectralEstimate: number, signalQuality: number): void {
    if (timeEstimate === 0 || spectralEstimate === 0) {
      return;
    }
    
    // Calculate time-domain reliability
    let timeReliability = 0.5;
    if (this.timeEstimates.length >= 3) {
      const variance = this.calculateVariance(this.timeEstimates);
      const consistency = Math.max(0, 1 - Math.sqrt(variance) / (this.fusedHeartRate || 75));
      timeReliability = Math.min(1, consistency * 1.2);
    }
    
    // Calculate frequency-domain reliability
    let spectralReliability = 0.5;
    if (this.spectralEstimates.length >= 2) {
      const variance = this.calculateVariance(this.spectralEstimates);
      const consistency = Math.max(0, 1 - Math.sqrt(variance) / (this.fusedHeartRate || 75));
      spectralReliability = Math.min(1, consistency * 1.2);
    }
    
    // Signal quality factors
    const signalFactor = signalQuality / 100;
    
    // Higher signal quality gives more weight to time-domain methods
    // Lower signal quality gives more weight to spectral methods
    this.timeWeight = 0.5 + (signalFactor * 0.3 * timeReliability);
    this.spectralWeight = 1 - this.timeWeight;
    
    // Ensure weights sum to 1
    const sum = this.timeWeight + this.spectralWeight;
    this.timeWeight /= sum;
    this.spectralWeight /= sum;
  }
  
  /**
   * Calculate variance of an array
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Enhanced peak detection with real data and adaptive thresholding
   */
  public findPeaksEnhanced(values: number[], mean: number, stdDev: number): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 5; // Más sensible para detección natural de picos
    
    // Dynamic threshold based on real signal statistics - umbral más sensible
    const peakThreshold = mean + (stdDev * 0.2); // Más sensible
    
    // First pass: identify all potential peaks
    const potentialPeaks: number[] = [];
    for (let i = 2; i < values.length - 2; i++) {
      const current = values[i];
      
      // Check if this point is a peak in real data
      if (current > values[i - 1] && 
          current > values[i - 2] &&
          current > values[i + 1] && 
          current > values[i + 2] &&
          current > peakThreshold) {
        
        potentialPeaks.push(i);
      }
    }
    
    // Second pass: filter for natural rhythm with minimum distance
    if (potentialPeaks.length === 0) {
      return peaks;
    }
    
    // Always include the first peak
    peaks.push(potentialPeaks[0]);
    
    // Filter other peaks based on minimum distance
    for (let i = 1; i < potentialPeaks.length; i++) {
      const current = potentialPeaks[i];
      const prev = peaks[peaks.length - 1];
      
      // Enforce minimum distance between peaks for physiological plausibility
      if (current - prev >= minPeakDistance) {
        peaks.push(current);
      } else {
        // If peaks are too close, keep the stronger one
        if (values[current] > values[prev]) {
          peaks.pop();
          peaks.push(current);
        }
      }
    }
    
    return peaks;
  }
  
  /**
   * Original peak finder with real data
   */
  public findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Simple peak detector for real data
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Reset the heart rate detector
   */
  public reset(): void {
    this.peakTimes = [];
    this.lastProcessTime = 0;
    this.spectralEstimates = [];
    this.timeEstimates = [];
    this.fusedHeartRate = 0;
    this.timeWeight = 0.6;
    this.spectralWeight = 0.4;
    this.kalmanFilter.reset();
  }
  
  /**
   * Get estimates for debugging
   */
  public getEstimates(): {
    timeEstimate: number;
    spectralEstimate: number;
    fusedEstimate: number;
    timeWeight: number;
    spectralWeight: number;
  } {
    const timeEstimate = this.timeEstimates.length > 0 ? 
      this.timeEstimates[this.timeEstimates.length - 1] : 0;
      
    const spectralEstimate = this.spectralEstimates.length > 0 ? 
      this.spectralEstimates[this.spectralEstimates.length - 1] : 0;
      
    return {
      timeEstimate,
      spectralEstimate,
      fusedEstimate: this.fusedHeartRate,
      timeWeight: this.timeWeight,
      spectralWeight: this.spectralWeight
    };
  }
}
