
/**
 * Interfaz para eventos de arritmia detectados
 */
export interface ArrhythmiaEvent {
  type: 'bradycardia' | 'tachycardia' | 'irregular' | 'extrasystole';
  timestamp: number;
  bpm: number;
  rr: number;
}

/**
 * Detector de arritmias basado en intervalos RR
 */
export class ArrhythmiaDetector {
  private rrHistory: number[] = [];
  private readonly MAX_HISTORY = 20;
  private readonly BRADYCARDIA_THRESHOLD = 50;
  private readonly TACHYCARDIA_THRESHOLD = 110;

  /**
   * Actualiza el detector con un nuevo intervalo RR y devuelve un evento de arritmia si se detecta
   * @param rr Intervalo RR en milisegundos
   * @returns Evento de arritmia o null si no se detecta
   */
  public update(rr: number): ArrhythmiaEvent | null {
    if (rr <= 300 || rr >= 2000) return null; // fuera de rango válido (300-2000 ms)

    this.rrHistory.push(rr);
    if (this.rrHistory.length > this.MAX_HISTORY) this.rrHistory.shift();

    const bpm = 60000 / rr;
    const timestamp = Date.now();

    // Bradicardia sostenida
    if (bpm < this.BRADYCARDIA_THRESHOLD) {
      return { type: 'bradycardia', timestamp, bpm, rr };
    }

    // Taquicardia sostenida
    if (bpm > this.TACHYCARDIA_THRESHOLD) {
      return { type: 'tachycardia', timestamp, bpm, rr };
    }

    // Extrasístole: RR mucho más corto que promedio
    if (this.rrHistory.length >= 5) {
      const avg = this.rrHistory.reduce((a, b) => a + b, 0) / this.rrHistory.length;
      if (rr < avg * 0.6) {
        return { type: 'extrasystole', timestamp, bpm, rr };
      }
    }

    // Irregularidad alta (RMSSD elevado)
    if (this.rrHistory.length >= 6) {
      const diffs = this.rrHistory.slice(1).map((rr, i) => rr - this.rrHistory[i]);
      const rmssd = Math.sqrt(diffs.reduce((sum, x) => sum + x * x, 0) / diffs.length);
      if (rmssd > 100) {
        return { type: 'irregular', timestamp, bpm, rr };
      }
    }

    return null;
  }

  /**
   * Resetea el historial de intervalos RR
   */
  public reset() {
    this.rrHistory = [];
  }
}
