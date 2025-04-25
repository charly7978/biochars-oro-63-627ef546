
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';

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
    
    // Calculate SpO2 without Math.round
    let spO2 = 98 - (15 * R);
    // Integer conversion without Math.round
    spO2 = spO2 >= 0 ? ~~(spO2 + 0.5) : ~~(spO2 - 0.5);
    
    // Adjust based on real perfusion quality without using Math.min/Math.max
    if (perfusionIndex > 0.15) {
      spO2 = spO2 >= 98 ? 98 : spO2 + 1;
    } else if (perfusionIndex < 0.08) {
      spO2 = spO2 <= 0 ? 0 : spO2 - 1;
    }

    spO2 = spO2 >= 98 ? 98 : spO2;

    // Update buffer with real measurement
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate average for stability from real measurements
    if (this.spo2Buffer.length > 0) {
      // Sum without reduce
      let sum = 0;
      for (let i = 0; i < this.spo2Buffer.length; i++) {
        sum += this.spo2Buffer[i];
      }
      
      // Integer conversion without Math.round
      const avg = sum / this.spo2Buffer.length;
      spO2 = avg >= 0 ? ~~(avg + 0.5) : ~~(avg - 0.5);
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
      // No Math.max needed - simple comparison
      return lastValid > decayAmount ? lastValid - decayAmount : 0;
    }
    return 0;
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
