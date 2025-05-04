
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
    if (ppgValues.length < sampleRate * 1.0) { // Mantener para detección rápida
      return 0;
    }
    
    const now = Date.now();
    
    // Track processing time for natural timing
    const timeDiff = now - this.lastProcessTime;
    this.lastProcessTime = now;
    
    // Get recent real data - analizamos más datos para mejor detección
    const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 8)); // Aumentado para detección más completa
    
    // Calculate signal statistics for adaptive thresholding - MEJORADO
    const mean = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    
    // Cálculo mejorado de desviación estándar para mayor precisión
    let sumSquaredDiff = 0;
    for (let i = 0; i < recentData.length; i++) {
      const diff = recentData[i] - mean;
      sumSquaredDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSquaredDiff / recentData.length);
    
    // Find peaks in real data with adaptive threshold - OPTIMIZADO
    const peaks = this.findPeaksEnhanced(recentData, mean, stdDev);
    
    if (peaks.length < 2) {
      return 0;
    }
    
    // Convert peak indices to timestamps for natural timing
    const sampleDuration = timeDiff / recentData.length || 33.33; // Fallback a 30fps
    const peakTimes = peaks.map(idx => now - (recentData.length - idx) * sampleDuration);
    
    // Update stored peak times
    this.peakTimes = [...this.peakTimes, ...peakTimes].slice(-20); // Aumentado para análisis más estable
    
    // Calculate intervals between consecutive peaks - MEJORADO
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i-1];
      // Rango ampliado para detección más precisa de FC
      if (interval >= 240 && interval <= 2100) { // 240ms = 250 BPM, 2100ms = 28 BPM
        intervals.push(interval);
      }
    }
    
    if (intervals.length < 2) {
      // Fall back to sample-based calculation - MEJORADO
      let totalInterval = 0;
      let validIntervals = 0;
      
      for (let i = 1; i < peaks.length; i++) {
        const interval = peaks[i] - peaks[i - 1];
        if (interval > 0) {
          totalInterval += interval;
          validIntervals++;
        }
      }
      
      if (validIntervals === 0) {
        return 0;
      }
      
      const avgInterval = totalInterval / validIntervals;
      return Math.round(60 / (avgInterval / sampleRate));
    }
    
    // Calculate average interval with outlier rejection - REFINADO
    intervals.sort((a, b) => a - b);
    
    // Filtrado más agresivo de outliers
    const filteredIntervals = intervals.slice(
      Math.floor(intervals.length * 0.2),  // Eliminar el 20% inferior
      Math.ceil(intervals.length * 0.8)    // Eliminar el 20% superior
    );
    
    if (filteredIntervals.length === 0) {
      if (intervals.length > 0) {
        // Usar la mediana como fallback cuando no hay suficientes intervalos
        return Math.round(60000 / intervals[Math.floor(intervals.length / 2)]);
      }
      return 0;
    }
    
    // Usar mediana en lugar de promedio para mayor robustez
    const medianInterval = filteredIntervals[Math.floor(filteredIntervals.length / 2)];
    
    // Convert to beats per minute
    return Math.round(60000 / medianInterval);
  }
  
  /**
   * Enhanced peak detection with real data and adaptive thresholding
   * Mejorado para sincronización natural entre visualización y beeps
   */
  public findPeaksEnhanced(values: number[], mean: number, stdDev: number): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 4; // Más sensible para detección natural
    
    // Dynamic threshold based on real signal statistics - más adaptativo
    const peakThreshold = mean + (stdDev * 0.15); // Umbral más sensible
    
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
    
    // Filter other peaks based on minimum distance - MEJORADO
    for (let i = 1; i < potentialPeaks.length; i++) {
      const current = potentialPeaks[i];
      const prev = peaks[peaks.length - 1];
      
      // Enforce minimum distance between peaks for physiological plausibility
      if (current - prev >= minPeakDistance) {
        peaks.push(current);
      } else {
        // Si los picos están muy cercanos, quedarse con el más fuerte
        if (values[current] > values[prev] * 1.15) { // Umbral aumentado para favorecer picos claros
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
