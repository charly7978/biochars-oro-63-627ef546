
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * No simulation or reference values are used
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 3;
  private readonly LOW_PASS_ALPHA = 0.2;
  
  // Noise detection parameters
  private readonly NOISE_THRESHOLD = 25;
  private noiseLevel: number = 0;
  
  /**
   * Get current PPG values buffer with real data only
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply Moving Average filter to real values
   */
  public applySMAFilter(value: number): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (this.ppgValues.length < windowSize) {
      return value;
    }
    
    const recentValues = this.ppgValues.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, alpha: number = this.LOW_PASS_ALPHA): number {
    if (this.ppgValues.length === 0) {
      return value;
    }
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number): number {
    if (this.ppgValues.length < this.MEDIAN_WINDOW_SIZE) {
      return value;
    }
    
    const values = [...this.ppgValues.slice(-this.MEDIAN_WINDOW_SIZE), value];
    values.sort((a, b) => a - b);
    
    return values[Math.floor(values.length / 2)];
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   */
  public applyFilters(value: number): { filteredValue: number, quality: number } {
    // Step 1: Median filter to remove outliers
    const medianFiltered = this.applyMedianFilter(value);
    
    // Step 2: Low pass filter to smooth the signal
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    
    // Step 3: Moving average for final smoothing
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate noise level of real signal
    this.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    const quality = this.calculateSignalQuality();
    
    // Store the filtered value in the buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    return { 
      filteredValue: smaFiltered,
      quality
    };
  }
  
  /**
   * Update noise level estimation on real data
   */
  private updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    this.noiseLevel = 0.1 * instantNoise + 0.9 * this.noiseLevel;
  }
  
  /**
   * Calculate signal quality based on real signal characteristics
   */
  private calculateSignalQuality(): number {
    // No quality assessment with insufficient data
    if (this.ppgValues.length < 10) {
      return 50;
    }
    
    // Factor 1: Noise level (lower is better)
    const noiseScore = Math.max(0, 100 - (this.noiseLevel * 4));
    
    // Factor 2: Signal stability
    const recentValues = this.ppgValues.slice(-10);
    const sum = recentValues.reduce((a, b) => a + b, 0);
    const mean = sum / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stabilityScore = Math.max(0, 100 - Math.min(100, variance / 2));
    
    // Factor 3: Signal range
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    const rangeScore = range > 5 && range < 100 ? 100 : Math.max(0, 100 - Math.abs(range - 50));
    
    // Weighted average of factors
    const quality = Math.round(
      (noiseScore * 0.4) +
      (stabilityScore * 0.4) +
      (rangeScore * 0.2)
    );
    
    return Math.min(100, Math.max(0, quality));
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.ppgValues = [];
    this.noiseLevel = 0;
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 2) {
      return 0;
    }
    
    // Get recent real data
    const recentData = this.ppgValues.slice(-Math.min(this.ppgValues.length, sampleRate * 5));
    
    // Find peaks in real data
    const peaks = this.findPeaksEnhanced(recentData);
    
    if (peaks.length < 2) {
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
  private findPeaksEnhanced(values: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 10;
    
    // Calculate statistics from real data
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    // Dynamic threshold based on real signal statistics
    const peakThreshold = mean + (stdDev * 0.5);
    
    for (let i = 2; i < values.length - 2; i++) {
      const current = values[i];
      
      // Check if this point is a peak in real data
      if (current > values[i - 1] && 
          current > values[i - 2] &&
          current > values[i + 1] && 
          current > values[i + 2] &&
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
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Simple peak detector for real data
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
}
