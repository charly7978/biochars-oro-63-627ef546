
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
  private arrhythmiaWindows: {start: number, end: number, severity: 'alta' | 'media'}[] = [];
  
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
      
      // Registrar ventana de arritmia para visualización
      const windowEnd = currentTime;
      const windowStart = windowEnd - 3000; // 3 segundos antes
      const severity = rmssd > 100 ? 'alta' : 'media';
      
      this.arrhythmiaWindows.push({
        start: windowStart, 
        end: windowEnd,
        severity
      });
      
      // Limitar a las 3 últimas detecciones para visualización
      if (this.arrhythmiaWindows.length > 3) {
        this.arrhythmiaWindows.shift();
      }
      
      console.log(`ARRITMIA DETECTADA #${this.arrhythmiaCount} - RMSSD: ${rmssd.toFixed(2)}, severidad: ${severity}`);
      
      const arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCount}`;
      const arrhythmiaData = {
        timestamp: currentTime,
        rmssd: rmssd,
        rrVariation: this.calculateVariation(intervals),
        intervals: intervals.slice(-5),
        severity: severity,
        visualWindow: {
          start: windowStart,
          end: windowEnd
        },
        type: 'irregular'
      };
      
      // Dispatch an event for the PPG graph
      const arrhythmiaEvent = new CustomEvent('external-arrhythmia-detected', {
        detail: { 
          start: windowStart, 
          end: windowEnd, 
          timestamp: currentTime,
          severity: severity,
          type: 'irregular'
        }
      });
      document.dispatchEvent(arrhythmiaEvent);
      
      // Force redraw
      setTimeout(() => {
        const refreshEvent = new CustomEvent('refresh-ppg-visualization');
        document.dispatchEvent(refreshEvent);
      }, 100);
      
      return {
        status: arrhythmiaStatus,
        data: arrhythmiaData,
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
    this.arrhythmiaWindows = [];
  }
  
  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Obtiene las ventanas de arritmia para visualización
   */
  public getArrhythmiaWindows(): {start: number, end: number, severity: 'alta' | 'media'}[] {
    return [...this.arrhythmiaWindows];
  }
}
