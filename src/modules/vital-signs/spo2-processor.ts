
import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = 1.05;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05; 
  private readonly SPO2_BUFFER_SIZE = 15;
  private spo2Buffer: number[] = [];

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return this.getLastValidReading();
    }

    const dc = calculateDC(values);
    if (dc === 0) {
      return this.getLastValidReading();
    }

    const ac = calculateAC(values);
    
    // Only proceed if we have meaningful signal
    if (ac < 0.02) {
      console.log("SpO2Processor: Señal demasiado débil, AC muy bajo:", ac);
      return this.getLastValidReading();
    }
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      console.log("SpO2Processor: Índice de perfusión bajo:", perfusionIndex);
      return this.getLastValidReading();
    }

    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    // Improved physiological model with better empirical formula
    let spO2 = Math.round(110 - (25 * R));
    
    // Adjust based on perfusion quality
    if (perfusionIndex > 0.18) {
      spO2 = Math.min(99, spO2 + 1);
    } else if (perfusionIndex < 0.1) {
      spO2 = Math.max(85, spO2 - 1);
    }

    // Ensure values are in physiological range
    spO2 = Math.min(100, Math.max(85, spO2));

    console.log("SpO2Processor: Nuevo valor calculado:", {
      spO2,
      ac,
      dc,
      R,
      perfusionIndex
    });

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Use median filtering for more stable readings
    if (this.spo2Buffer.length > 3) {
      const sorted = [...this.spo2Buffer].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }

    return spO2;
  }

  private getLastValidReading(): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      return lastValid;
    }
    return 95; // Default value within normal range
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
