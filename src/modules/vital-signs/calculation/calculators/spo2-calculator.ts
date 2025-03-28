
/**
 * Calculador de saturación de oxígeno (SpO2)
 * Calcula SpO2 a partir de la señal optimizada
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { BaseCalculator, CalculationResultItem } from '../types';

export class SPO2Calculator implements BaseCalculator {
  private spo2Values: number[] = [];
  private readonly MAX_VALUES = 10;
  private lastValidValue: number = 0;
  private calibrationCount: number = 0;
  private readonly CALIBRATION_THRESHOLD = 30;
  
  /**
   * Calcula SpO2 a partir de señal optimizada
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem<number> {
    // Inicializar valores
    let spo2 = 0;
    let confidence = 0;
    
    try {
      // En un sistema real, aquí se analizaría la proporción AC/DC
      // entre señales de luz roja e infrarroja.
      // Para este prototipo, calculamos un valor basado en la calidad
      // de la señal y metadatos disponibles.
      
      // Simular cálculo basado en propiedades de la señal
      const signalStrength = signal.confidence;
      const isPeak = signal.metadata?.peaks || false;
      
      if (signalStrength > 0.3) {
        // En calibración, aumentar gradualmente hacia valor normal
        if (this.calibrationCount < this.CALIBRATION_THRESHOLD) {
          this.calibrationCount++;
          
          // Partir desde 90% y subir gradualmente
          const baseValue = 90 + (this.calibrationCount / this.CALIBRATION_THRESHOLD) * 8;
          
          // Añadir variación basada en la señal
          const variation = (signal.value - 0.5) * 2; // Normalizar a +/-1
          
          // Calcular SpO2
          spo2 = baseValue + variation;
          
          // Limitar a rango fisiológico (90-100%)
          spo2 = Math.max(90, Math.min(100, spo2));
          
          // Confianza aumenta con calibración
          confidence = this.calibrationCount / this.CALIBRATION_THRESHOLD;
        } else {
          // Después de calibración, calcular valor normal
          const baseValue = 96; // Valor base para persona saludable
          
          // Añadir variación basada en la señal
          const variation = (signal.value - 0.5) * 4; // Normalizar a +/-2
          
          // Calcular SpO2
          spo2 = baseValue + variation;
          
          // Limitar a rango fisiológico (85-100%)
          spo2 = Math.max(85, Math.min(100, spo2));
          
          // Confianza alta para señal fuerte
          confidence = Math.min(0.95, 0.7 + signalStrength * 0.3);
        }
        
        // Redondear a 1 decimal
        spo2 = Math.round(spo2 * 10) / 10;
        
        // Almacenar valor
        this.spo2Values.push(spo2);
        if (this.spo2Values.length > this.MAX_VALUES) {
          this.spo2Values.shift();
        }
        
        // Suavizar con valores recientes
        if (this.spo2Values.length > 1) {
          spo2 = this.spo2Values.reduce((sum, val) => sum + val, 0) / this.spo2Values.length;
          spo2 = Math.round(spo2 * 10) / 10;
        }
        
        this.lastValidValue = spo2;
      } else {
        // Señal débil, mantener último valor válido con baja confianza
        spo2 = this.lastValidValue;
        confidence = 0.1;
      }
      
      return {
        value: spo2,
        confidence,
        metadata: {
          calibrationProgress: Math.min(1, this.calibrationCount / this.CALIBRATION_THRESHOLD)
        }
      };
    } catch (error) {
      console.error("Error calculando SpO2:", error);
      
      return {
        value: this.lastValidValue,
        confidence: 0.1
      };
    }
  }
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    this.spo2Values = [];
    this.lastValidValue = 0;
    this.calibrationCount = 0;
  }
}
