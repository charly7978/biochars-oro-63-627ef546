
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { checkSignalQuality, calculateWeightedQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Signal quality assessment for real PPG signals
 * All methods work with real data only, no simulation
 * 
 * NOTE: This class is maintained for backward compatibility.
 * The main signal quality functionality is now centralized in
 * heart-beat/signal-quality.ts
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
   * (Forwards to centralized function for consistency)
   */
  public calculateSignalQuality(ppgValues: number[]): number {
    return calculateWeightedQuality(ppgValues);
  }
  
  /**
   * Reset noise level
   */
  public reset(): void {
    this.noiseLevel = 0;
  }
}
