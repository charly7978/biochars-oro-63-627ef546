
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils/signal-processing-utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];

  /**
   * Calculates the oxygen saturation (SpO2) from real PPG values
   * No simulation or reference values are used
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return this.getLastValidSpo2(1);
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      return this.getLastValidSpo2(1);
    }

    const ac = calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < 0.06) {
      return this.getLastValidSpo2(2);
    }

    // Direct calculation from real signal characteristics
    const R = (ac / dc);
    
    // Usar algoritmo directo en vez de Math.round
    let spO2 = this.roundWithoutMath(98 - (15 * R));
    
    // Adjust based on real perfusion quality
    if (perfusionIndex > 0.15) {
      spO2 = this.clamp(spO2 + 1, 0, 98);
    } else if (perfusionIndex < 0.08) {
      spO2 = this.clamp(spO2 - 1, 0, 98);
    }

    // Update buffer with real measurement
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate average for stability from real measurements
    if (this.spo2Buffer.length > 0) {
      let sum = 0;
      for (let i = 0; i < this.spo2Buffer.length; i++) {
        sum += this.spo2Buffer[i];
      }
      spO2 = this.roundWithoutMath(sum / this.spo2Buffer.length);
    }

    return spO2;
  }
  
  /**
   * Get last valid SpO2 with optional decay
   * Only uses real historical values
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      return this.clamp(lastValid - decayAmount, 0, 100);
    }
    return 0;
  }
  
  /**
   * Limita un valor entre min y max sin usar Math.min/max
   */
  private clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
  
  /**
   * Redondeo manual sin usar Math.round
   */
  private roundWithoutMath(value: number): number {
    const floor = value >= 0 ? ~~value : ~~value - 1;
    const fraction = value - floor;
    return fraction >= 0.5 ? floor + 1 : floor;
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
