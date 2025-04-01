
import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  // MODIFICADO: Elevamos el umbral de perfusión para mayor calidad
  private readonly PERFUSION_INDEX_THRESHOLD = 0.07; // antes: 0.06
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const ac = calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    // MODIFICADO: Si el índice de perfusión es demasiado bajo, retornamos
    // el último valor válido con reducción progresiva
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 2);
      }
      return 0;
    }

    // MODIFICADO: Mejor calibración del factor R
    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    let spO2 = Math.round(98 - (15 * R));
    
    // MODIFICADO: Ajustes basados en la calidad de la perfusión
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    // IMPORTANTE: Limitamos el valor máximo de SpO2 a 98%
    spO2 = Math.min(98, spO2);

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Promedio ponderado de los valores en el buffer
    if (this.spo2Buffer.length > 0) {
      // MODIFICADO: Usamos un promedio ponderado con más peso en los valores recientes
      let weightedSum = 0;
      let weightSum = 0;
      
      for (let i = 0; i < this.spo2Buffer.length; i++) {
        const weight = i + 1; // Damos más peso a los valores más recientes
        weightedSum += this.spo2Buffer[i] * weight;
        weightSum += weight;
      }
      
      spO2 = Math.round(weightedSum / weightSum);
    }

    return spO2;
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
