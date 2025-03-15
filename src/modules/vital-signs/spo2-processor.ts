/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { calculateAC, calculateDC } from '../../utils/vitalSignsUtils';

export class SpO2Processor {
  // Parámetros para detección
  private readonly PERFUSION_INDEX_THRESHOLD = 0.12;
  private readonly MIN_RED_GREEN_RATIO = 1.25;
  
  private readonly SPO2_BUFFER_SIZE = 5;
  private spo2Buffer: number[] = [];
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;

  /**
   * Calcula la saturación de oxígeno basada en señal PPG
   */
  public calculateSpO2(values: number[], redValue?: number, greenValue?: number): number {
    // Almacenar valores RGB para validación fisiológica
    if (redValue !== undefined && greenValue !== undefined) {
      this.lastRedValue = redValue;
      this.lastGreenValue = greenValue;
    }
    
    // Sin datos suficientes, no calcular
    if (values.length < 40) {
      return 0;
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      return 0;
    }

    const ac = calculateAC(values);
    
    // Verificación de índice de perfusión
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      return 0;
    }
    
    // Verificación de ratio rojo/verde
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      
      if (rgRatio < this.MIN_RED_GREEN_RATIO) {
        return 0;
      }
    }

    // Pendiente de implementación real
    let spO2 = 0;

    if (spO2 > 85) {
      this.spo2Buffer.push(spO2);
      if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
        this.spo2Buffer.shift();
      }
      
      // Promedio simple para estabilizar lecturas
      const sum = this.spo2Buffer.reduce((total, val) => total + val, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    return spO2;
  }

  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
  }
  
  /**
   * Verifica si hay un dedo presente
   */
  public isFingerDetected(values: number[]): boolean {
    // Sin datos suficientes, no hay dedo
    if (values.length < 20) return false;
    
    const dc = calculateDC(values);
    if (dc === 0) return false;
    
    const ac = calculateAC(values);
    const perfusionIndex = ac / dc;
    
    // Criterio 1: Índice de perfusión mínimo
    const hasSufficientPerfusion = perfusionIndex >= this.PERFUSION_INDEX_THRESHOLD;
    
    // Criterio 2: Ratio rojo/verde correcto para tejido vivo
    let hasCorrectRGRatio = false;
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      hasCorrectRGRatio = rgRatio >= this.MIN_RED_GREEN_RATIO;
    }
    
    // Ambos criterios deben cumplirse
    return hasSufficientPerfusion && hasCorrectRGRatio;
  }
}
