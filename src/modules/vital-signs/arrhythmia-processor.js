
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { calculateRMSSD } from '../utils/signalProcessingUtils';

/**
 * Procesador especializado para detección de arritmias cardíacas
 */
export class ArrhythmiaProcessor {
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  
  private rrIntervals = [];
  private baselineRhythm = 0;
  private isLearningPhase = true;
  private arrhythmiaDetected = false;
  private measurementStartTime = Date.now();
  private lastPeakTime = null;
  
  /**
   * Detecta arritmias basadas en intervalos RR
   */
  detectArrhythmia() {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      console.log("ArrhythmiaProcessor: Insuficientes intervalos RR para RMSSD", {
        current: this.rrIntervals.length,
        needed: this.RR_WINDOW_SIZE
      });
      return;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    const rmssd = calculateRMSSD(recentRR);
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    console.log("ArrhythmiaProcessor: Análisis RMSSD", {
      timestamp: new Date().toISOString(),
      rmssd,
      threshold: this.RMSSD_THRESHOLD,
      recentRR,
      avgRR,
      lastRR,
      prematureBeat
    });

    const newArrhythmiaState = rmssd > this.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
      console.log("ArrhythmiaProcessor: Cambio en estado de arritmia", {
        previousState: !this.arrhythmiaDetected,
        newState: this.arrhythmiaDetected,
        cause: {
          rmssdExceeded: rmssd > this.RMSSD_THRESHOLD,
          prematureBeat,
          rmssdValue: rmssd
        }
      });
    }
  }
  
  /**
   * Actualiza los intervalos RR con datos nuevos
   * @param rrData Datos de intervalos RR
   */
  updateRRIntervals(rrData) {
    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
      this.lastPeakTime = rrData.lastPeakTime;
      
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }
  }
  
  /**
   * Verifica si estamos en fase de aprendizaje
   * @returns Estado de arritmia como string
   */
  getArrhythmiaStatus() {
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.measurementStartTime;

    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
      return this.arrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
    }
    
    return "--";
  }
  
  /**
   * Comprueba si estamos en fase de aprendizaje
   */
  isInLearningPhase() {
    return this.isLearningPhase;
  }
  
  /**
   * Comprueba si hay una arritmia detectada
   */
  hasArrhythmia() {
    return this.arrhythmiaDetected;
  }
  
  /**
   * Reinicia el procesador de arritmias
   */
  reset() {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
  }
}
