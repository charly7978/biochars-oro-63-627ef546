
/**
 * Calculador de arritmias
 */

import { OptimizedSignal } from '../../../../modules/signal-optimization/types';
import { ArrhythmiaResultItem } from '../types';

/**
 * Clase para detección y clasificación de arritmias cardíacas
 */
export class ArrhythmiaCalculator {
  private arrhythmiaCount: number = 0;
  private lastIntervals: number[] = [];
  private rmssd: number = 0;
  private detectionWindowStart: number = Date.now();
  private lastDetectionTime: number = 0;
  private minDetectionIntervalMs: number = 5000; // Mínimo tiempo entre detecciones
  
  /**
   * Calcula estado de arritmia basado en señal
   */
  public calculate(signal: OptimizedSignal): ArrhythmiaResultItem {
    if (!signal || !signal.metadata?.intervals || signal.metadata.intervals.length < 2) {
      return {
        status: "--",
        data: null,
        count: 0
      };
    }
    
    const currentTime = Date.now();
    
    // Obtener intervalos RR
    const intervals = signal.metadata.intervals;
    
    // Calcular variación
    const rmssd = this.calculateRMSSD(intervals);
    this.rmssd = rmssd;
    
    // Detectar arritmia basado en umbral de variación - aumentado para mejor visualización
    const isArrhythmia = rmssd > 70; // Umbral más sensible para visualización
    
    // Verificar si ha pasado suficiente tiempo desde la última detección
    const canDetectNewArrhythmia = currentTime - this.lastDetectionTime > this.minDetectionIntervalMs;
    
    if (isArrhythmia && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.lastDetectionTime = currentTime;
      
      console.log(`ARRITMIA DETECTADA #${this.arrhythmiaCount} - RMSSD: ${rmssd.toFixed(2)}`);
      
      return {
        status: `Arritmia|${this.arrhythmiaCount}`,
        data: {
          timestamp: currentTime,
          rmssd: rmssd,
          rrVariation: this.calculateVariation(intervals),
          intervals: intervals.slice(-5),
          severity: rmssd > 100 ? 'alta' : 'media'
        },
        count: this.arrhythmiaCount
      };
    }
    
    return {
      status: isArrhythmia ? "Irregular" : "Normal",
      data: {
        timestamp: currentTime,
        rmssd: rmssd,
        rrVariation: this.calculateVariation(intervals)
      },
      count: this.arrhythmiaCount
    };
  }
  
  /**
   * Calcula RMSSD (Raíz cuadrada del promedio de las diferencias cuadradas)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    let count = 0;
    
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sumSquaredDiff += diff * diff;
      count++;
    }
    
    if (count === 0) return 0;
    
    return Math.sqrt(sumSquaredDiff / count);
  }
  
  /**
   * Calcula variación porcentual en intervalos
   */
  private calculateVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length
    );
    
    return (stdDev / mean) * 100; // Coeficiente de variación en porcentaje
  }
  
  /**
   * Reinicia el contador de arritmias
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastIntervals = [];
    this.rmssd = 0;
    this.detectionWindowStart = Date.now();
    this.lastDetectionTime = 0;
  }
  
  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
}
