/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Importar PeakDetector consolidado
import { PeakDetector } from '@/core/signal/PeakDetector';

/**
 * Heart rate detection functions for real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced for natural rhythm detection and clear beats
 * Uses the consolidated PeakDetector.
 */
export class HeartRateDetector {
  // Instancia del detector de picos consolidado
  private peakDetector: PeakDetector;
  // Mantener el historial de tiempos de picos es útil para HR
  private peakTimes: number[] = [];
  private lastProcessTime: number = 0;

  constructor() {
    this.peakDetector = new PeakDetector();
  }

  /**
   * Calculate heart rate from real PPG values using consolidated PeakDetector
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < sampleRate * 1.0) {
      return 0;
    }

    const now = Date.now();
    const timeDiff = now - this.lastProcessTime;
    this.lastProcessTime = now;

    // Usar el PeakDetector consolidado para encontrar picos
    const peakResult = this.peakDetector.detectPeaks(ppgValues);
    const peakIndices = peakResult.peakIndices;

    if (peakIndices.length < 2) {
      return 0;
    }

    // Convert peak indices to timestamps for natural timing
    // Necesitamos saber la duración real del segmento ppgValues para esto
    // Asumimos que ppgValues representa una duración basada en timeDiff
    const sampleDuration = ppgValues.length > 0 ? timeDiff / ppgValues.length : (1000 / sampleRate);
    const newPeakTimes = peakIndices.map(idx => now - (ppgValues.length - 1 - idx) * sampleDuration);

    // Update stored peak times, filtrando solo los nuevos detectados en esta llamada
    // o usar directamente los intervalos calculados por PeakDetector
    this.peakTimes = [...this.peakTimes, ...newPeakTimes].slice(-15);

    // Usar los intervalos directamente del PeakDetector
    const intervals: number[] = peakResult.intervals;

    if (intervals.length < 2) {
        // Fallback si PeakDetector no devuelve suficientes intervalos válidos
        // (Este fallback podría eliminarse si confiamos en PeakDetector)
        let totalIntervalSamples = 0;
        for (let i = 1; i < peakIndices.length; i++) {
            totalIntervalSamples += peakIndices[i] - peakIndices[i - 1];
        }
        if (peakIndices.length <= 1) return 0; // Evitar división por cero
        const avgIntervalSamples = totalIntervalSamples / (peakIndices.length - 1);
        const hr = Math.round(60 / (avgIntervalSamples / sampleRate));
        return isNaN(hr) ? 0 : hr;
    }

    // Calcular average interval con outlier rejection (ya hecho dentro de PeakDetector.getValidIntervals)
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // Convert to beats per minute
    const finalHr = Math.round(60000 / avgInterval);
    return isNaN(finalHr) ? 0 : finalHr;
  }

  /**
   * Reset the heart rate detector
   */
  public reset(): void {
    this.peakTimes = [];
    this.lastProcessTime = 0;
    this.peakDetector.reset(); // Resetear también el detector de picos interno
  }
}
