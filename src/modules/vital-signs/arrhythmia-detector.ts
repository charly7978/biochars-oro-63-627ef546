
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { calculateRMSSD } from '../../utils/signalProcessingUtils';

export class ArrhythmiaDetector {
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private isLearningPhase = true;
  private arrhythmiaDetected = false;
  private measurementStartTime: number = Date.now();

  /**
   * Actualiza los intervalos RR a partir de datos proporcionados
   * @param rrData Datos de intervalos RR
   */
  public updateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): void {
    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
      this.lastPeakTime = rrData.lastPeakTime;
      
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }
    
    // Actualizar fase de aprendizaje
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }
  }

  /**
   * Detecta la presencia de arritmias basado en intervalos RR
   */
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      return;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    const rmssd = calculateRMSSD(recentRR);
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    const newArrhythmiaState = rmssd > this.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
    }
  }

  /**
   * Calcula la variación de intervalos RR
   * @returns Variación de RR normalizada
   */
  public calculateRRVariation(): number {
    if (this.rrIntervals.length < 3) {
      return 0;
    }

    const recentRR = this.rrIntervals.slice(-3);
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    
    return Math.abs(lastRR - avgRR) / avgRR;
  }

  /**
   * Obtiene el estado actual de detección de arritmias
   * @returns Estado de arritmia formateado
   */
  public getArrhythmiaStatus(): string {
    if (this.isLearningPhase) {
      return "--";
    }
    return this.arrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
  }

  /**
   * Indica si se ha detectado una arritmia
   * @returns true si se ha detectado arritmia, false en caso contrario
   */
  public hasArrhythmia(): boolean {
    return this.arrhythmiaDetected;
  }

  /**
   * Indica si el detector está en fase de aprendizaje
   * @returns true si está en fase de aprendizaje, false en caso contrario
   */
  public isInLearningPhase(): boolean {
    return this.isLearningPhase;
  }

  /**
   * Calcula el RMSSD de los intervalos RR actuales
   * @returns Valor RMSSD calculado
   */
  public calculateRMSSD(): number {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      return 0;
    }
    return calculateRMSSD(this.rrIntervals.slice(-this.RR_WINDOW_SIZE));
  }

  /**
   * Reinicia el detector de arritmias
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
  }
}
