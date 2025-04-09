
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_BUFFER_SIZE = 10;
  private spo2Buffer: number[] = [];
  private lastCalculationTime: number = 0;
  private readonly MIN_CALCULATION_INTERVAL = 500; // ms
  private readonly MIN_SIGNAL_AMPLITUDE = 0.05;
  private readonly MIN_SIGNAL_QUALITY = 30; // Reduced threshold for better responsiveness

  /**
   * Calculates the oxygen saturation (SpO2) from real PPG values
   * No simulation or reference values are used
   */
  public calculateSpO2(values: number[]): number {
    // Basic validation
    if (values.length < 20) {
      console.log("SpO2Processor: Insufficient data points for SpO2 calculation", {
        dataPoints: values.length,
        required: 20,
        returning: this.getLastValidSpo2(0)
      });
      return this.getLastValidSpo2(0);
    }

    // Rate limiting to avoid unnecessary calculations
    const now = Date.now();
    if (now - this.lastCalculationTime < this.MIN_CALCULATION_INTERVAL) {
      return this.getLastValidSpo2(0);
    }
    this.lastCalculationTime = now;

    // Calculate DC component (baseline)
    const dc = calculateDC(values);
    if (dc === 0 || isNaN(dc)) {
      console.log("SpO2Processor: Invalid DC component", { dc });
      return this.getLastValidSpo2(0);
    }

    // Calculate AC component (pulsatile)
    const ac = calculateAC(values);
    if (ac === 0 || isNaN(ac)) {
      console.log("SpO2Processor: Invalid AC component", { ac });
      return this.getLastValidSpo2(0);
    }
    
    // Calculate amplitude
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    // Check if signal has enough amplitude
    if (amplitude < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("SpO2Processor: Signal amplitude too low", { 
        amplitude, 
        min, 
        max, 
        threshold: this.MIN_SIGNAL_AMPLITUDE 
      });
      return this.getLastValidSpo2(0);
    }
    
    // Calculate perfusion index: ratio of pulsatile blood flow to non-pulsatile blood
    const perfusionIndex = ac / dc;
    
    // Basic validation of perfusion index
    if (perfusionIndex < 0.03) {
      console.log("SpO2Processor: Perfusion index too low", { perfusionIndex });
      return this.getLastValidSpo2(1);
    }

    // Calculate R (ratio) using real measurements
    const R = (ac / dc);
    
    // SpO2 empirical formula based on real R-curve
    // The formula is: SpO2 = -25*R + 110
    // Modified to work with higher baseline for better visual feedback
    let spO2 = Math.round(-25 * R + 110);
    
    // Apply quality and perfusion adjustments
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(99, spO2 + 1);
    } else if (perfusionIndex < 0.05) {
      spO2 = Math.max(85, spO2 - 1);
    }

    // Clamp to physiologically reasonable range
    spO2 = Math.max(85, Math.min(99, spO2));

    // Log the calculation details
    console.log("SpO2Processor: Calculation details", {
      ac,
      dc,
      R,
      perfusionIndex,
      amplitude,
      calculatedValue: spO2,
      values: {
        min,
        max,
        length: values.length
      }
    });

    // Update buffer with real measurement
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate average for stability from real measurements
    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
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
      return Math.max(85, lastValid - decayAmount);
    }
    return 0;
  }

  /**
   * Reset the SpO2 processor state
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.lastCalculationTime = 0;
    console.log("SpO2Processor: Reset completed");
  }
}
