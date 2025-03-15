
/**
 * Procesador avanzado de detección de arritmias cardíacas
 * Basado en técnicas de análisis de variabilidad de la frecuencia cardíaca (HRV)
 * y patrones de intervalos RR utilizado en diagnóstico clínico.
 */

import { calculateRMSSD, detectArrhythmia } from './utils';

export class ArrhythmiaProcessor {
  private readonly RR_WINDOW_SIZE = 10;
  private readonly RMSSD_THRESHOLD = 50; // Increased from 30 to reduce sensitivity
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 2000; // Increased from 1000 to detect less frequently
  private readonly MAX_LEARNING_PERIOD = 5000;
  private readonly SEVERITY_LEVELS = ['LEVE', 'MODERADA', 'SEVERA'];
  
  private rrIntervals: number[] = [];
  private baselineHRV: number = 0;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaDetected: boolean = false;
  private isLearningPhase: boolean = true;
  private learningStartTime: number = Date.now();
  private arrhythmiaHistory: {
    timestamp: number;
    type: string;
    severity: string;
    rmssd: number;
    rrVariation: number;
  }[] = [];

  /**
   * Procesa datos de intervalos RR para detectar arritmias cardíacas
   * El algoritmo implementa análisis de variabilidad de frecuencia cardíaca
   * y detección de latidos prematuros basado en criterios clínicos.
   * 
   * @param rrData Datos de intervalos RR
   * @returns Estado de arritmia y datos adicionales
   */
  public processRRData(rrData?: { 
    intervals: number[]; 
    lastPeakTime: number | null 
  }): {
    arrhythmiaStatus: string;
    count: number;
    isLearning: boolean;
    lastArrhythmiaData: { 
      timestamp: number; 
      type: string;
      severity: string;
      rmssd: number; 
      rrVariation: number; 
    } | null;
  } {
    const currentTime = Date.now();
    
    // Verificar si estamos en fase de aprendizaje
    if (this.isLearningPhase) {
      if (currentTime - this.learningStartTime > this.MAX_LEARNING_PERIOD) {
        this.isLearningPhase = false;
        // Calcular línea base HRV al finalizar aprendizaje
        if (this.rrIntervals.length >= 5) {
          this.baselineHRV = calculateRMSSD(this.rrIntervals);
        }
      }
    }
    
    // Actualizar intervalos RR
    if (rrData && rrData.intervals && rrData.intervals.length > 0) {
      // Filtrar intervalos no fisiológicos (fuera del rango normal humano)
      const validIntervals = rrData.intervals.filter(
        interval => interval >= 400 && interval <= 1500 // Rango más estricto
      );
      
      // Actualizar buffer interno
      this.rrIntervals = [...validIntervals].slice(-30); // Mantener hasta 30 intervalos
    }
    
    // Si no hay suficientes datos, mantener estado actual
    if (this.rrIntervals.length < 6) { // Aumentado para mayor robustez
      return {
        arrhythmiaStatus: this.isLearningPhase ? 
          'CALIBRANDO' : 
          (this.arrhythmiaDetected ? 'ARRITMIA DETECTADA' : 'RITMO NORMAL'),
        count: this.arrhythmiaCount,
        isLearning: this.isLearningPhase,
        lastArrhythmiaData: null
      };
    }
    
    // Análisis avanzado de HRV con ventana móvil
    const recentIntervals = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Detección de arritmias usando múltiples criterios clínicos con mayor umbral
    const arrhythmiaResult = detectArrhythmia(recentIntervals);
    
    // Calcular métricas específicas para informes
    const rmssd = calculateRMSSD(recentIntervals);
    const avgRR = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
    const lastRR = recentIntervals[recentIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Determinar si hay una nueva arritmia con criterios más estrictos
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const isNewArrhythmia = arrhythmiaResult.detected && 
                           !this.isLearningPhase && 
                           timeSinceLastArrhythmia > this.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
                           rmssd > this.RMSSD_THRESHOLD && // Añadido umbral de RMSSD más alto
                           rrVariation > 0.30; // Añadido umbral de variación más alto
    
    // Determinar nivel de severidad basado en múltiples factores con umbrales más altos
    let severity = this.SEVERITY_LEVELS[0]; // Predeterminado: LEVE
    
    if (arrhythmiaResult.detected) {
      if (rmssd > 100 || rrVariation > 0.65) { // Umbral más alto
        severity = this.SEVERITY_LEVELS[2]; // SEVERA
      } else if (rmssd > 75 || rrVariation > 0.45) { // Umbral más alto
        severity = this.SEVERITY_LEVELS[1]; // MODERADA
      }
    }
    
    // Incrementar contador y registrar nueva arritmia
    if (isNewArrhythmia) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      this.arrhythmiaDetected = true;
      
      // Registrar esta arritmia en el historial
      const arrhythmiaEntry = {
        timestamp: currentTime,
        type: arrhythmiaResult.type,
        severity,
        rmssd,
        rrVariation
      };
      
      this.arrhythmiaHistory.push(arrhythmiaEntry);
      
      // Mantener un tamaño razonable para el historial
      if (this.arrhythmiaHistory.length > 20) {
        this.arrhythmiaHistory.shift();
      }
      
      return {
        arrhythmiaStatus: `ARRITMIA ${severity}`,
        count: this.arrhythmiaCount,
        isLearning: false,
        lastArrhythmiaData: arrhythmiaEntry
      };
    }
    
    // Actualizar estado actual - Añadir decaimiento gradual de la detección
    // Si ha pasado mucho tiempo desde la última arritmia, volver a estado normal
    if (this.arrhythmiaDetected && currentTime - this.lastArrhythmiaTime > 10000) { // 10 segundos
      this.arrhythmiaDetected = false;
    }
    
    // Construir mensaje de estado
    let statusMessage;
    if (this.isLearningPhase) {
      statusMessage = 'CALIBRANDO';
    } else if (this.arrhythmiaDetected) {
      statusMessage = `ARRITMIA ${severity}`;
    } else {
      statusMessage = 'RITMO NORMAL';
    }
    
    return {
      arrhythmiaStatus: statusMessage,
      count: this.arrhythmiaCount,
      isLearning: this.isLearningPhase,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Obtener métricas avanzadas de HRV para análisis clínico
   */
  public getHRVMetrics(): {
    rmssd: number;
    sdnn: number;
    pnn50: number;
    baselineDeviation: number;
  } | null {
    if (this.rrIntervals.length < 5) return null;
    
    const rmssd = calculateRMSSD(this.rrIntervals);
    
    // SDNN - Desviación estándar de intervalos NN
    const mean = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
    const sdnn = Math.sqrt(
      this.rrIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.rrIntervals.length
    );
    
    // pNN50 - Porcentaje de intervalos adyacentes que difieren por más de 50ms
    let nn50Count = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      if (Math.abs(this.rrIntervals[i] - this.rrIntervals[i-1]) > 50) {
        nn50Count++;
      }
    }
    const pnn50 = (nn50Count / (this.rrIntervals.length - 1)) * 100;
    
    // Desviación de línea base
    const baselineDeviation = this.baselineHRV > 0 ? 
      (rmssd - this.baselineHRV) / this.baselineHRV : 0;
    
    return {
      rmssd,
      sdnn,
      pnn50,
      baselineDeviation
    };
  }
  
  /**
   * Obtener historial de arritmias
   */
  public getArrhythmiaHistory(): {
    timestamp: number;
    type: string;
    severity: string;
    rmssd: number;
    rrVariation: number;
  }[] {
    return [...this.arrhythmiaHistory];
  }

  /**
   * Reiniciar procesador
   */
  public reset(): void {
    this.rrIntervals = [];
    this.arrhythmiaCount = 0;
    this.arrhythmiaDetected = false;
    this.lastArrhythmiaTime = 0;
    this.isLearningPhase = true;
    this.learningStartTime = Date.now();
    this.arrhythmiaHistory = [];
    // No se resetea el baselineHRV para mantener la calibración
  }
  
  /**
   * Reiniciar contador de arritmias sin borrar datos de aprendizaje
   */
  public resetCounter(): void {
    this.arrhythmiaCount = 0;
    this.arrhythmiaHistory = [];
  }
}
