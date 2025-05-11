/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal quality assessment
 * All methods work with real data only, no simulation
 * Improved to reduce false positives
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 5;
  
  /**
   * Simple noise level update - minimal implementation with improved filtering
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    // Slower adaptation to reduce impact of transient noise
    this.noiseLevel = 0.08 * instantNoise + 0.92 * this.noiseLevel;
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
    // console.log("SignalQuality: calculateSignalQuality called. ppgValues length:", ppgValues.length);
    if (ppgValues.length < 5) {
      // console.log("SignalQuality: Not enough values for quality calc, returning 0.");
      return 0;
    }
    
    const recentPpgValues = ppgValues.slice(-10);
    // console.log("SignalQuality: Recent PPG values for quality:", JSON.stringify(recentPpgValues));

    const min = Math.min(...recentPpgValues);
    const max = Math.max(...recentPpgValues);
    const amplitude = max - min;
    // console.log("SignalQuality: Min:", min, "Max:", max, "Amplitude:", amplitude);
        
    if (amplitude < 0.02) { 
      // console.log("SignalQuality: Amplitude < 0.02, resetting strong signals, returning 0 quality.");
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MIN_STRONG_SIGNALS_REQUIRED + 2, 
        this.consecutiveStrongSignals + 1
      );
      // console.log("SignalQuality: Amplitude OK. Consecutive strong signals:", this.consecutiveStrongSignals);
    }
    
    if (this.consecutiveStrongSignals < this.MIN_STRONG_SIGNALS_REQUIRED) {
      // console.log("SignalQuality: Not enough consecutive strong signals, returning 0 quality. Required:", this.MIN_STRONG_SIGNALS_REQUIRED);
      return 0;
    }
    
    const weightedQuality = this.calculateWeightedQuality(ppgValues); // Esto devuelve 0-100
    // console.log("SignalQuality: Calculated weighted quality:", weightedQuality);
    return Math.round(weightedQuality); // Asegurar que es un entero
  }
  
  /**
   * Calculate weighted quality score based on real signal properties only
   * No simulation or manipulation, only direct measurement analysis
   */
  private calculateWeightedQuality(ppgValues: number[]): number {
    if (ppgValues.length < 10) return 0;
    
    const recentValues = ppgValues.slice(-10);
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    const noiseToSignalRatio = this.noiseLevel / (amplitude + 0.001);
    
    let peakConsistency = 0;
    let lastPeakIndex = -1;
    let peakSpacings = [];
    
    for (let i = 1; i < recentValues.length - 1; i++) {
      if (recentValues[i] > recentValues[i-1] && recentValues[i] > recentValues[i+1]) {
        if (lastPeakIndex !== -1) {
          peakSpacings.push(i - lastPeakIndex);
        }
        lastPeakIndex = i;
      }
    }
    
    if (peakSpacings.length >= 2) {
      const avgSpacing = peakSpacings.reduce((sum, val) => sum + val, 0) / peakSpacings.length;
      const spacingStdDev = Math.sqrt(peakSpacings.reduce((sum, val) => sum + Math.pow(val - avgSpacing, 2), 0) / peakSpacings.length);
      const spacingCoeffOfVar = avgSpacing > 0 ? spacingStdDev / avgSpacing : 1; // Evitar división por cero
      peakConsistency = Math.max(0, 1 - spacingCoeffOfVar);
    }
    
    const amplitudeScore = Math.min(1, amplitude / 0.2);  // Divisor 0.2 para sensibilidad
    const stdDevScore = Math.min(1, Math.max(0, 1 - noiseToSignalRatio));  
    
    const weightedScore = (
      amplitudeScore * 0.4 +
      stdDevScore * 0.4 +
      peakConsistency * 0.2
    );
    
    return Math.max(0, Math.min(1, weightedScore)) * 100; // Devolver como porcentaje 0-100
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
  }
}
