
/**
 * Signal processor for PPG signals
 * Implements various filtering and analysis techniques
 * Optimizado para mejor rendimiento de renderizado
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 3;
  private readonly MAX_BUFFER_SIZE = 600; // Límite para prevenir uso excesivo de memoria
  private readonly ADAPTIVE_MODE = true; // Usar modo adaptativo para mejor rendimiento
  
  // Add peak detection tracking
  private peakIndices: number[] = [];
  private lastPeakIndex: number = -1;
  private lastPeakTime: number | null = null;
  private readonly MIN_PEAK_DISTANCE = 10; // Minimum samples between peaks
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Get detected peak indices
   */
  public getPeakIndices(): number[] {
    return this.peakIndices;
  }
  
  /**
   * Get last peak time
   */
  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }
  
  /**
   * Apply Simple Moving Average filter to a value
   */
  public applySMAFilter(value: number): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (this.ppgValues.length < windowSize) {
      return value;
    }
    
    // Optimización: usar un ciclo for para sumar en lugar de reduce
    let sum = 0;
    const recentValues = this.ppgValues.slice(-windowSize);
    for (let i = 0; i < recentValues.length; i++) {
      sum += recentValues[i];
    }
    
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter with optimizations
   */
  public applyEMAFilter(value: number, alpha: number = 0.3): number {
    if (this.ppgValues.length === 0) {
      return value;
    }
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Add a value to the buffer with adaptive size management
   * Returns true if a new peak was detected
   */
  public addValue(value: number): boolean {
    // Control buffer size para prevenir uso excesivo de memoria
    if (this.ADAPTIVE_MODE && this.ppgValues.length >= this.MAX_BUFFER_SIZE) {
      // Estrategia de reducción: mantener el 75% más reciente
      this.ppgValues = this.ppgValues.slice(-Math.floor(this.MAX_BUFFER_SIZE * 0.75));
      // Also adjust peak indices
      this.peakIndices = this.peakIndices.filter(idx => idx >= this.ppgValues.length * 0.25);
      // Adjust indices after truncation
      const offset = Math.floor(this.MAX_BUFFER_SIZE * 0.25);
      this.peakIndices = this.peakIndices.map(idx => idx - offset);
      this.lastPeakIndex = this.lastPeakIndex - offset;
    }
    
    this.ppgValues.push(value);
    
    // Peak detection in real-time with the new value
    const newPeakDetected = this.detectNewPeak();
    return newPeakDetected;
  }
  
  /**
   * Check for a new peak with the last added value
   * Returns true if a new peak was detected
   */
  private detectNewPeak(): boolean {
    const currentIndex = this.ppgValues.length - 1;
    if (currentIndex < 2) return false; // Need at least 3 points
    
    const current = this.ppgValues[currentIndex];
    const prev = this.ppgValues[currentIndex - 1];
    const prevPrev = this.ppgValues[currentIndex - 2];
    
    // Check if previous point is a peak (higher than current and previous-previous)
    const isPeak = prev > current && prev > prevPrev;
    
    if (isPeak && (currentIndex - 1 - this.lastPeakIndex >= this.MIN_PEAK_DISTANCE)) {
      this.peakIndices.push(currentIndex - 1);
      this.lastPeakIndex = currentIndex - 1;
      this.lastPeakTime = Date.now();
      return true;
    }
    
    return false;
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
    this.peakIndices = [];
    this.lastPeakIndex = -1;
    this.lastPeakTime = null;
  }
  
  /**
   * Optimized heart rate calculation for better rendering performance
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 2) {
      return 0; // Need at least 2 seconds of data
    }
    
    // Use detected peaks instead of finding them again
    if (this.peakIndices.length < 2) {
      return 0;
    }
    
    // Only use recent peaks for BPM calculation
    const recentPeaks = this.peakIndices.slice(-8); // Use last 8 peaks for calculation
    
    if (recentPeaks.length < 2) {
      return 0;
    }
    
    // Calculate average interval between peaks
    let totalInterval = 0;
    for (let i = 1; i < recentPeaks.length; i++) {
      totalInterval += recentPeaks[i] - recentPeaks[i - 1];
    }
    
    const avgInterval = totalInterval / (recentPeaks.length - 1);
    
    // Convert to beats per minute
    return Math.round(60 / (avgInterval / sampleRate));
  }
  
  /**
   * This method is kept for backward compatibility
   * but now uses the pre-calculated peaks
   */
  private findPeaksOptimized(values: number[]): number[] {
    // Filter peak indices to only include ones that fall within the given values
    const valuesStartIdx = this.ppgValues.length - values.length;
    return this.peakIndices
      .filter(idx => idx >= valuesStartIdx)
      .map(idx => idx - valuesStartIdx);
  }
}
