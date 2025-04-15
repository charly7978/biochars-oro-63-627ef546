
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

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
    if (ppgValues.length < 5) return 0;
    
    // Calculate amplitude and standard deviation
    const min = Math.min(...ppgValues.slice(-10));
    const max = Math.max(...ppgValues.slice(-10));
    const amplitude = max - min;
    
    // Only consider valid signals with sufficient amplitude
    if (amplitude < 0.02) {
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MIN_STRONG_SIGNALS_REQUIRED + 2, 
        this.consecutiveStrongSignals + 1
      );
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
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calculate average and standard deviation - real data only
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
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
      const avgSpacing = peakSpacings.reduce((sum, val) => sum + val, 0) / peakSpacings.length;
      const spacingVariance = peakSpacings.reduce((sum, val) => sum + Math.pow(val - avgSpacing, 2), 0) / peakSpacings.length;
      const spacingCoeffOfVar = Math.sqrt(spacingVariance) / avgSpacing;
      peakConsistency = Math.max(0, 1 - spacingCoeffOfVar);
    }
    
    // Calculate overall quality score with weighted components - real data only
    const amplitudeScore = Math.min(1, amplitude / 0.5);  // Normalize amplitude
    const stdDevScore = Math.min(1, Math.max(0, 1 - noiseToSignalRatio));  // Lower noise is better
    
    // Weight the factors to get overall quality
    const weightedScore = (
      amplitudeScore * 0.4 +          // 40% amplitude
      stdDevScore * 0.4 +             // 40% signal-to-noise
      peakConsistency * 0.2           // 20% peak consistency
    );
    
    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, weightedScore));
  }
  
  /**
   * Reset quality tracking state
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
  }
}
