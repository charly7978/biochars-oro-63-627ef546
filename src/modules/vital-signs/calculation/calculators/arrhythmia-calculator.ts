
/**
 * Calculador de arritmias cardíacas
 * 
 * Analiza intervalos RR para detectar irregularidades en el ritmo cardíaco
 */

import { CalculationResult } from '../types';

export class ArrhythmiaCalculator {
  private arrhythmiaCount: number = 0;
  private lastDetectionTime: number | null = null;
  private rrHistory: number[] = [];
  private readonly MAX_RR_HISTORY = 30;
  private stabilityCounter: number = 0;
  
  /**
   * Procesa intervalos RR para detectar arritmias
   */
  public processRRIntervals(rrIntervals: number[]): CalculationResult['arrhythmia'] {
    if (rrIntervals.length < 5) {
      return {
        status: "--",
        count: this.arrhythmiaCount,
        lastDetection: this.lastDetectionTime,
        data: null
      };
    }
    
    // Añadir intervalos al historial
    for (const interval of rrIntervals) {
      if (interval >= 300 && interval <= 1500) {
        this.rrHistory.push(interval);
        
        if (this.rrHistory.length > this.MAX_RR_HISTORY) {
          this.rrHistory.shift();
        }
      }
    }
    
    // Verificar si tenemos suficientes datos para análisis
    if (this.rrHistory.length < 10) {
      return {
        status: "INSUFICIENTE",
        count: this.arrhythmiaCount,
        lastDetection: this.lastDetectionTime,
        data: null
      };
    }
    
    // Calcular métricas de variabilidad
    const metrics = this.calculateVariabilityMetrics(this.rrHistory);
    
    // Aplicar criterios de detección
    const result = this.detectArrhythmia(metrics);
    
    return {
      status: result.status,
      count: this.arrhythmiaCount,
      lastDetection: result.isArrhythmia ? Date.now() : this.lastDetectionTime,
      data: metrics
    };
  }
  
  /**
   * Calcula métricas de variabilidad de RR
   */
  private calculateVariabilityMetrics(rrIntervals: number[]): ArrhythmiaMetrics {
    // Calcular estadísticas básicas
    const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    
    // Calcular desviación estándar
    const variance = rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    let rmssdSum = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      rmssdSum += Math.pow(rrIntervals[i] - rrIntervals[i-1], 2);
    }
    const rmssd = Math.sqrt(rmssdSum / (rrIntervals.length - 1));
    
    // Calcular pNN50 (porcentaje de intervalos que difieren más de 50ms)
    let nn50Count = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
        nn50Count++;
      }
    }
    const pnn50 = (nn50Count / (rrIntervals.length - 1)) * 100;
    
    // Calcular coeficiente de variación
    const cvRR = (stdDev / mean) * 100;
    
    return {
      mean,
      stdDev,
      rmssd,
      pnn50,
      cvRR,
      sdnn: stdDev
    };
  }
  
  /**
   * Detecta arritmia basado en métricas
   */
  private detectArrhythmia(metrics: ArrhythmiaMetrics): ArrhythmiaResult {
    // Umbral adaptativo para detección
    const cvThreshold = 15;
    const rmssdThreshold = 50;
    const pnn50Threshold = 30;
    
    // Detectar posible arritmia basado en métricas
    const isCVHigh = metrics.cvRR > cvThreshold;
    const isRMSSDHigh = metrics.rmssd > rmssdThreshold;
    const isPNN50High = metrics.pnn50 > pnn50Threshold;
    
    // Determinar tipo de arritmia
    let arrhythmiaType = "NORMAL";
    let isArrhythmia = false;
    
    if (isCVHigh && isRMSSDHigh && isPNN50High) {
      // Alta variabilidad en todos los parámetros
      arrhythmiaType = "ARRITMIA|" + (++this.arrhythmiaCount);
      this.lastDetectionTime = Date.now();
      isArrhythmia = true;
      this.stabilityCounter = 0;
    } else if (isCVHigh || isRMSSDHigh) {
      // Variabilidad moderada
      if (this.stabilityCounter < 5) {
        arrhythmiaType = "IRREGULAR|" + this.arrhythmiaCount;
        isArrhythmia = false;
      } else {
        arrhythmiaType = "NORMAL";
        isArrhythmia = false;
      }
      this.stabilityCounter = 0;
    } else {
      // Ritmo normal
      arrhythmiaType = "NORMAL";
      isArrhythmia = false;
      this.stabilityCounter = Math.min(10, this.stabilityCounter + 1);
    }
    
    return {
      status: arrhythmiaType,
      isArrhythmia
    };
  }
  
  /**
   * Obtiene contador de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reinicia detector de arritmias
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastDetectionTime = null;
    this.rrHistory = [];
    this.stabilityCounter = 0;
  }
}

/**
 * Métricas de variabilidad de intervalos RR
 */
interface ArrhythmiaMetrics {
  mean: number;
  stdDev: number;
  rmssd: number;
  pnn50: number;
  cvRR: number;
  sdnn: number;
}

/**
 * Resultado de detección de arritmia
 */
interface ArrhythmiaResult {
  status: string;
  isArrhythmia: boolean;
}
