
/**
 * Calculador de frecuencia cardíaca
 * Calcula la frecuencia cardíaca basada en intervalos RR
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { BaseCalculator, CalculationResultItem } from '../types';

export class HeartRateCalculator implements BaseCalculator {
  private lastCalculatedBPM: number = 0;
  private confidenceHistory: number[] = [];
  private readonly MAX_HISTORY = 5;
  
  /**
   * Calcula la frecuencia cardíaca a partir de señal optimizada
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem<number> {
    // Inicializar resultado
    let bpm = 0;
    let confidence = 0;
    
    try {
      // Obtener intervalos RR de metadatos
      const intervals = signal.metadata?.intervals || [];
      
      if (intervals.length >= 3) {
        // Filtrar intervalos válidos (entre 300ms y 2000ms)
        const validIntervals = intervals.filter(i => i >= 300 && i <= 2000);
        
        if (validIntervals.length >= 2) {
          // Calcular promedio de intervalos
          const avgInterval = validIntervals.reduce((sum, i) => sum + i, 0) / validIntervals.length;
          
          // Convertir a BPM
          bpm = Math.round(60000 / avgInterval);
          
          // Limitar a rango fisiológico
          bpm = Math.max(40, Math.min(220, bpm));
          
          // Calcular confianza basada en variabilidad de intervalos
          const stdDev = Math.sqrt(
            validIntervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / validIntervals.length
          );
          
          // Menor desviación = mayor confianza
          confidence = Math.max(0.1, Math.min(0.95, 1 - (stdDev / avgInterval / 0.5)));
          
          // Añadir factor de confianza basado en cantidad de intervalos
          confidence *= Math.min(1, validIntervals.length / 8);
          
          // Estabilizar BPM si hay valores previos
          if (this.lastCalculatedBPM > 0 && Math.abs(bpm - this.lastCalculatedBPM) > 15) {
            bpm = Math.round(0.7 * this.lastCalculatedBPM + 0.3 * bpm);
            confidence *= 0.8; // Reducir confianza en transiciones bruscas
          }
          
          // Actualizar histórico de confianza
          this.confidenceHistory.push(confidence);
          if (this.confidenceHistory.length > this.MAX_HISTORY) {
            this.confidenceHistory.shift();
          }
          
          // Suavizar confianza
          if (this.confidenceHistory.length > 1) {
            confidence = this.confidenceHistory.reduce((sum, c) => sum + c, 0) / this.confidenceHistory.length;
          }
        }
      }
      
      // Guardar último valor calculado
      if (bpm > 0) {
        this.lastCalculatedBPM = bpm;
      }
      
      return {
        value: bpm,
        confidence,
        metadata: {
          intervalCount: intervals.length
        }
      };
    } catch (error) {
      console.error("Error calculando frecuencia cardíaca:", error);
      
      return {
        value: this.lastCalculatedBPM,
        confidence: 0.1
      };
    }
  }
  
  /**
   * Reinicia calculador
   */
  public reset(): void {
    this.lastCalculatedBPM = 0;
    this.confidenceHistory = [];
  }
}
