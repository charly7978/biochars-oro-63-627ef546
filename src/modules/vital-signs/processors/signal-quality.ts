
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality, calculateWeightedQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Signal quality assessment - forwards to centralized implementation in PPGSignalMeter
 * All methods work with real data only, no simulation
 * Greatly improved to eliminate false positives
 */
export class SignalQuality {
  private noiseLevel: number = 0;
  private consecutiveStrongSignals: number = 0;
  private readonly MIN_STRONG_SIGNALS_REQUIRED = 5; // Increased from 3
  private readonly AMPLITUDE_THRESHOLD = 0.05; // Increased from 0.02
  
  /**
   * Simple noise level update - minimal implementation with improved filtering
   */
  public updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    // Even slower adaptation to reduce impact of transient noise
    this.noiseLevel = 0.05 * instantNoise + 0.95 * this.noiseLevel; // More smoothing (0.08/0.92 previously)
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
    if (ppgValues.length < 8) return 0; // Increased from 5
    
    // Calculate amplitude and standard deviation
    const min = Math.min(...ppgValues.slice(-15)); // Use more data points
    const max = Math.max(...ppgValues.slice(-15));
    const amplitude = max - min;
    
    // Only consider valid signals with sufficient amplitude
    if (amplitude < this.AMPLITUDE_THRESHOLD) {
      this.consecutiveStrongSignals = 0;
      return 0;
    } else {
      this.consecutiveStrongSignals = Math.min(
        this.MIN_STRONG_SIGNALS_REQUIRED + 3, 
        this.consecutiveStrongSignals + 1
      );
    }
    
    // Only return positive quality after we've seen enough strong signals
    if (this.consecutiveStrongSignals < this.MIN_STRONG_SIGNALS_REQUIRED) {
      return 0;
    }
    
    // Calculate stability (coefficient of variation)
    const values = ppgValues.slice(-10);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 999;
    
    // If signal is unstable, return lower quality
    if (cv > 0.3) {
      return Math.min(40, calculateWeightedQuality(ppgValues));
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
