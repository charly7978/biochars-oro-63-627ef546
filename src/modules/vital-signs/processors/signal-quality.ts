
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal quality assessment for real PPG signals
 * All methods work with real data only, no simulation
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private readonly NOISE_THRESHOLD = 25;
  
  /**
   * Update noise level estimation on real data
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    this.noiseLevel = 0.1 * instantNoise + 0.9 * this.noiseLevel;
  }
  
  /**
   * Get current noise level
   */
  public getNoiseLevel(): number {
    return this.noiseLevel;
  }
  
  /**
   * Calculate signal quality based on real signal characteristics
   */
  public calculateSignalQuality(ppgValues: number[]): number {
    // No quality assessment with insufficient data
    if (ppgValues.length < 10) {
      return 50;
    }
    
    // Factor 1: Noise level (lower is better)
    const noiseScore = Math.max(0, 100 - (this.noiseLevel * 4));
    
    // Factor 2: Signal stability
    const recentValues = ppgValues.slice(-10);
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
   * Reset noise level
   */
  public reset(): void {
    this.noiseLevel = 0;
  }
}
