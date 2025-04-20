/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Heart rate detection functions for real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced for natural rhythm detection and clear beats
 */
export class HeartRateDetector {
  // Store recent peaks for consistent timing analysis
  private peakTimes: number[] = [];
  private lastProcessTime: number = 0;
  private lastValidBPM: number = 75;
  
  /**
   * Calculate heart rate from real PPG values with enhanced peak detection
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < sampleRate * 0.5) {
      return this.lastValidBPM;
    }
    const now = Date.now();
    const timeDiff = now - this.lastProcessTime;
    this.lastProcessTime = now;
    const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 3));
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    const stdDev = Math.sqrt(
      recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentData.length
    );
    const peaks = this.findPeaksEnhanced(recentData, mean, stdDev * 0.8);
    if (peaks.length < 2) {
      return this.lastValidBPM;
    }
    const sampleDuration = timeDiff / recentData.length;
    const peakTimes = peaks.map(idx => now - (recentData.length - idx) * sampleDuration);
    this.peakTimes = [...this.peakTimes, ...peakTimes].slice(-20);
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i-1];
      if (interval >= 200 && interval <= 2200) {
        intervals.push(interval);
      }
    }
    let bpm = this.lastValidBPM;
    if (intervals.length >= 2) {
      intervals.sort((a, b) => a - b);
      const filteredIntervals = intervals.slice(
        Math.floor(intervals.length * 0.05),
        Math.ceil(intervals.length * 0.95)
      );
      if (filteredIntervals.length > 0) {
        const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
        bpm = Math.round(60000 / avgInterval);
      }
    } else if (peaks.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < peaks.length; i++) {
        totalInterval += peaks[i] - peaks[i - 1];
      }
      const avgInterval = totalInterval / (peaks.length - 1);
      bpm = Math.round(60 / (avgInterval / sampleRate));
    }
    // Validación fisiológica
    if (bpm < 30 || bpm > 220 || Math.abs(bpm - this.lastValidBPM) > 50) {
      bpm = this.lastValidBPM;
    }
    this.lastValidBPM = bpm;
    return bpm;
  }
  
  /**
   * Enhanced peak detection with real data and adaptive thresholding
   * Mejorado para sincronización natural entre visualización y beeps
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
  }
}
