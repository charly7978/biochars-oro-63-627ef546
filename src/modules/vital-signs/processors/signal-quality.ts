
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality, calculateWeightedQuality } from '../../../modules/heart-beat/signal-quality';

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
   * Calculate signal quality - forwards to centralized implementation
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
    
    return calculateWeightedQuality(ppgValues);
  }
  
  /**
   * Reset noise level and signal quality counters
   */
  public reset(): void {
    this.noiseLevel = 0;
    this.consecutiveStrongSignals = 0;
  }
}
