
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Heart rate detection functions for real PPG signals
 * All methods work with real data only, no simulation
 */
export class HeartRateDetector {
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < sampleRate * 3) {
      return 0;
    }
    
    // Get recent real data
    const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 5));
    
    // Find peaks in real data
    const peaks = this.findPeaksEnhanced(recentData);
    
    if (peaks.length < 3) {
      return 0;
    }
    
    // Calculate average interval between real peaks
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i - 1];
    }
    
    const avgInterval = totalInterval / (peaks.length - 1);
    
    // Convert to beats per minute using real data
    return Math.round(60 / (avgInterval / sampleRate));
  }
  
  /**
   * Enhanced peak detection with real data
   */
  public findPeaksEnhanced(values: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 15; // Increased from 10
    
    // Calculate statistics from real data
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    // Dynamic threshold based on real signal statistics
    const peakThreshold = mean + (stdDev * 0.7); // Increased from 0.5
    
    for (let i = 3; i < values.length - 3; i++) {
      const current = values[i];
      
      // Check if this point is a peak in real data with stricter requirements
      if (current > values[i - 1] && 
          current > values[i - 2] &&
          current > values[i - 3] &&
          current > values[i + 1] && 
          current > values[i + 2] &&
          current > values[i + 3] &&
          current > peakThreshold) {
        
        // Check if we're far enough from the last detected peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
          peaks.push(i);
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
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i - 1] && 
          values[i] > values[i - 2] && 
          values[i] > values[i + 1] &&
          values[i] > values[i + 2]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
}
