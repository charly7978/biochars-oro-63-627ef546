
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
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
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
   */
  public addValue(value: number): void {
    // Control buffer size para prevenir uso excesivo de memoria
    if (this.ADAPTIVE_MODE && this.ppgValues.length >= this.MAX_BUFFER_SIZE) {
      // Estrategia de reducción: mantener el 75% más reciente
      this.ppgValues = this.ppgValues.slice(-Math.floor(this.MAX_BUFFER_SIZE * 0.75));
    }
    
    this.ppgValues.push(value);
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
  }
  
  /**
   * Optimized heart rate calculation for better rendering performance
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 2) {
      return 0; // Need at least 2 seconds of data
    }
    
    // Optimización: limitar datos a procesar para mejor rendimiento
    const maxDataPoints = sampleRate * 5; // 5 segundos de datos
    const recentData = this.ppgValues.slice(-Math.min(this.ppgValues.length, maxDataPoints));
    
    // Find peaks con algoritmo optimizado
    const peaks = this.findPeaksOptimized(recentData);
    
    if (peaks.length < 2) {
      return 0;
    }
    
    // Optimización: cálculo directo con for loop en lugar de reduce
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i - 1];
    }
    
    const avgInterval = totalInterval / (peaks.length - 1);
    
    // Convert to beats per minute
    return Math.round(60 / (avgInterval / sampleRate));
  }
  
  /**
   * Find peaks in signal with optimized algorithm
   */
  private findPeaksOptimized(values: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 10; // Distancia mínima entre picos en muestras
    let lastPeakIndex = -minPeakDistance;
    
    // Algoritmo de detección de picos más eficiente
    for (let i = 1; i < values.length - 1; i++) {
      if (i - lastPeakIndex < minPeakDistance) continue;
      
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
        lastPeakIndex = i;
      }
    }
    
    return peaks;
  }
}
