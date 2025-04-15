/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Heart rate detection functions for real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced for natural rhythm detection and clear beats
 */

// Import the centralized peak detector
import { PeakDetector } from '@/core/signal/PeakDetector';

export class HeartRateDetector {
  // Remove old peak state
  // private peakTimes: number[] = [];
  // private lastProcessTime: number = 0;

  // Instantiate the centralized detector
  private peakDetector: PeakDetector;

  constructor() {
    this.peakDetector = new PeakDetector();
  }

  /**
   * Calculate heart rate from real PPG values using the centralized PeakDetector
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < 30) { // Need enough data for the detector
      return 0;
    }

    // Use the centralized detector
    // Note: PeakDetector uses its own internal sampling rate constant (default 30)
    // Ensure consistency if the actual sample rate differs.
    const detectionResult = this.peakDetector.detectPeaks(ppgValues);
    const validIntervals = detectionResult.intervals;

    if (validIntervals.length < 2) {
      return 0; // Not enough valid intervals
    }

    // Calculate average interval from the detector's valid intervals
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;

    // Convert to beats per minute
    // Ensure interval is not zero to avoid division by zero
    if (avgInterval <= 0) {
        return 0;
    }
    const bpm = 60000 / avgInterval;

    // Apply basic physiological limits
    const MIN_BPM = 40;
    const MAX_BPM = 200;
    return Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, bpm)));
  }

  // Remove old peak finding methods
  /*
  public findPeaksEnhanced(values: number[], mean: number, stdDev: number): number[] {
    // ... old implementation ...
  }

  public findPeaks(values: number[]): number[] {
    // ... old implementation ...
  }
  */

  /**
   * Reset the heart rate detector (resets the internal PeakDetector state)
   */
  public reset(): void {
    // Reset the centralized detector
    this.peakDetector.reset();
  }
}
