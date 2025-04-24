
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal quality assessment - forwards to centralized implementation in PPGSignalMeter
 * All methods work with real data only, no simulation
 * Improved to reduce false positives
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 3;
  
  /**
   * Simple noise level update - minimal implementation with improved filtering
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = rawValue > filteredValue ? 
                         rawValue - filteredValue : 
                         filteredValue - rawValue;
    
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
    if (ppgValues.length < 5) return 0;
    
    // Calculate amplitude and standard deviation
    let min = ppgValues[ppgValues.length - 10];
    let max = min;
    
    // Manual implementation of min/max for the last 10 values
    for (let i = ppgValues.length - 10; i < ppgValues.length; i++) {
      if (i >= 0) {
        if (ppgValues[i] < min) min = ppgValues[i];
        if (ppgValues[i] > max) max = ppgValues[i];
      }
    }
    
    const amplitude = max - min;
    
    // Only consider valid signals with sufficient amplitude
    if (amplitude < 0.02) {
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      // Calculate min using ternary
      this.consecutiveStrongSignals = this.consecutiveStrongSignals + 1 > this.MIN_STRONG_SIGNALS_REQUIRED + 2 ?
                                      this.MIN_STRONG_SIGNALS_REQUIRED + 2 :
                                      this.consecutiveStrongSignals + 1;
    }
    
    // Only return positive quality after we've seen enough strong signals
    if (this.consecutiveStrongSignals < this.MIN_STRONG_SIGNALS_REQUIRED) {
      return 0;
    }
    
    // Calculate quality based on real signal properties
    return this.calculateWeightedQuality(ppgValues);
  }
  
  /**
   * Calculate weighted quality score based on real signal properties only
   * No simulation or manipulation, only direct measurement analysis
   */
  private calculateWeightedQuality(ppgValues: number[]): number {
    if (ppgValues.length < 10) return 0;
    
    // Get recent values for analysis
    const recentValues = ppgValues.slice(-10);
    
    // Calculate signal amplitude (min to max) - real data only
    let min = recentValues[0];
    let max = recentValues[0];
    
    for (let i = 1; i < recentValues.length; i++) {
      if (recentValues[i] < min) min = recentValues[i];
      if (recentValues[i] > max) max = recentValues[i];
    }
    
    const amplitude = max - min;
    
    // Calculate average and standard deviation - real data only
    let sum = 0;
    for (let i = 0; i < recentValues.length; i++) {
      sum += recentValues[i];
    }
    const avg = sum / recentValues.length;
    
    // Calculate standard deviation manually
    let sumOfSquares = 0;
    for (let i = 0; i < recentValues.length; i++) {
      const diff = recentValues[i] - avg;
      sumOfSquares += diff * diff;
    }
    const variance = sumOfSquares / recentValues.length;
    
    // Calculate square root manually using Newton's method
    let stdDev = variance;
    for (let i = 0; i < 5; i++) {
      if (stdDev <= 0) break;
      stdDev = 0.5 * (stdDev + variance / stdDev);
    }
    
    // Calculate noise to signal ratio - real data only
    const noiseToSignalRatio = this.noiseLevel / (amplitude + 0.001);
    
    // Calculate consistency of peak spacing - real data only
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
      let spacingSum = 0;
      for (let i = 0; i < peakSpacings.length; i++) {
        spacingSum += peakSpacings[i];
      }
      const avgSpacing = spacingSum / peakSpacings.length;
      
      // Calculate variance of spacings manually
      let spacingVarSum = 0;
      for (let i = 0; i < peakSpacings.length; i++) {
        const spacingDiff = peakSpacings[i] - avgSpacing;
        spacingVarSum += spacingDiff * spacingDiff;
      }
      const spacingVariance = spacingVarSum / peakSpacings.length;
      
      // Calculate coefficient of variation manually using Newton's method for sqrt
      let spacingStdDev = spacingVariance;
      for (let i = 0; i < 5; i++) {
        if (spacingStdDev <= 0) break;
        spacingStdDev = 0.5 * (spacingStdDev + spacingVariance / spacingStdDev);
      }
      
      const spacingCoeffOfVar = avgSpacing > 0 ? spacingStdDev / avgSpacing : 1;
      peakConsistency = spacingCoeffOfVar >= 1 ? 0 : 1 - spacingCoeffOfVar;
    }
    
    // Calculate overall quality score with weighted components - real data only
    const amplitudeScore = amplitude >= 0.5 ? 1 : amplitude / 0.5;  // Normalize amplitude
    const stdDevScore = noiseToSignalRatio >= 1 ? 0 : 1 - noiseToSignalRatio;  // Lower noise is better
    
    // Weight the factors to get overall quality
    const weightedScore = (
      amplitudeScore * 0.4 +          // 40% amplitude
      stdDevScore * 0.4 +             // 40% signal-to-noise
      peakConsistency * 0.2           // 20% peak consistency
    );
    
    // Normalize to 0-1 range using clamp
    return weightedScore < 0 ? 0 : (weightedScore > 1 ? 1 : weightedScore);
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
  }
}
