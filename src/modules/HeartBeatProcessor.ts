
import { HeartBeatResult } from '../core/types';

/**
 * Clase que procesa latidos cardíacos detectados a partir de señales PPG
 */
export class HeartBeatProcessor {
  private bpmValue: number = 0;
  private confidence: number = 0;
  private arrhythmiaCount: number = 0;
  private isMonitoring: boolean = false;
  private lastPeakTime: number = 0;
  private rrIntervals: number[] = [];

  /**
   * Procesa una señal y devuelve los resultados analizados
   * @param value El valor de la señal PPG
   */
  public processSignal(value: number): HeartBeatResult {
    // Solo procesamos si estamos monitoreando
    if (!this.isMonitoring) {
      return this.createResult();
    }

    // Procesamiento básico para devolver un resultado
    this.updateBPM();
    
    return this.createResult();
  }

  /**
   * Actualiza el valor de BPM basado en los intervalos RR
   */
  private updateBPM(): void {
    // Cálculo básico de BPM
    if (this.rrIntervals.length >= 3) {
      const sum = this.rrIntervals.reduce((a, b) => a + b, 0);
      const avg = sum / this.rrIntervals.length;
      this.bpmValue = Math.round(60000 / avg);
      this.confidence = 0.7; // Confianza media-alta
    }
  }

  /**
   * Crea un objeto de resultado con los datos actuales
   */
  private createResult(): HeartBeatResult {
    return {
      bpm: this.bpmValue,
      confidence: this.confidence,
      isArrhythmia: false,
      arrhythmiaCount: this.arrhythmiaCount,
      time: Date.now()
    };
  }

  /**
   * Obtiene los intervalos RR y el tiempo del último pico
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime || null
    };
  }

  /**
   * Activa o desactiva el monitoreo
   */
  public setMonitoring(value: boolean): void {
    this.isMonitoring = value;
  }

  /**
   * Resetea el procesador
   */
  public reset(): void {
    this.bpmValue = 0;
    this.confidence = 0;
    this.arrhythmiaCount = 0;
    this.rrIntervals = [];
    this.lastPeakTime = 0;
  }
}
