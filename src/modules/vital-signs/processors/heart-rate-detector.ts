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
  
  /**
   * Calculate heart rate from real PPG values with enhanced peak detection
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < sampleRate * 1.5) {
      return 0;
    }
    
    const now = Date.now();
    
    // Track processing time for natural timing
    const timeDiff = now - this.lastProcessTime;
    this.lastProcessTime = now;
    
    // Get recent real data
    const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 4));
    
    // Calculate signal statistics for adaptive thresholding
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    const stdDev = Math.sqrt(
      recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentData.length
    );
    
    // Find peaks in real data with adaptive threshold
    const peaks = this.findPeaksEnhanced(recentData, mean, stdDev);
    
    if (peaks.length < 2) {
      return 0;
    }
    
    // Convert peak indices to timestamps for natural timing
    const sampleDuration = timeDiff / recentData.length;
    const peakTimes = peaks.map(idx => now - (recentData.length - idx) * sampleDuration);
    
    // Update stored peak times
    this.peakTimes = [...this.peakTimes, ...peakTimes].slice(-10);
    
    // Calculate intervals between consecutive peaks
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i-1];
      // Only use physiologically plausible intervals (30-200 BPM)
      if (interval >= 300 && interval <= 2000) {
        intervals.push(interval);
      }
    }
    
    if (intervals.length < 2) {
      // Fall back to sample-based calculation if not enough timestamp-based intervals
      let totalInterval = 0;
      for (let i = 1; i < peaks.length; i++) {
        totalInterval += peaks[i] - peaks[i - 1];
      }
      
      const avgInterval = totalInterval / (peaks.length - 1);
      return Math.round(60 / (avgInterval / sampleRate));
    }
    
    // Calculate average interval with outlier rejection
    intervals.sort((a, b) => a - b);
    const filteredIntervals = intervals.slice(
      Math.floor(intervals.length * 0.2),
      Math.ceil(intervals.length * 0.8)
    );
    
    if (filteredIntervals.length === 0) {
      return 0;
    }
    
    const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
    
    // Convert to beats per minute
    return Math.round(60000 / avgInterval);
  }
  
  /**
   * Enhanced peak detection with real data and adaptive thresholding
   */
  public findPeaksEnhanced(values: number[], mean: number, stdDev: number): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 8; // More sensitive for natural peak detection
    
    // Dynamic threshold based on real signal statistics
    const peakThreshold = mean + (stdDev * 0.3); // More sensitive threshold
    
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
