
import { FilterUtils } from '../signal-processing/FilterUtils';
import { ProcessorConfig } from './ProcessorConfig';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = ProcessorConfig.SPO2_CALIBRATION_FACTOR;
  private readonly PERFUSION_INDEX_THRESHOLD = ProcessorConfig.PERFUSION_INDEX_THRESHOLD;
  private readonly SPO2_BUFFER_SIZE = ProcessorConfig.SPO2_BUFFER_SIZE;
  private spo2Buffer: number[] = [];

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      return this.getLastValidSpo2(1);
    }

    const dc = FilterUtils.calculateDC(values);
    if (dc === 0) {
      return this.getLastValidSpo2(1);
    }

    const ac = FilterUtils.calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      return this.getLastValidSpo2(2);
    }

    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    let spO2 = Math.round(98 - (15 * R));
    
    // Adjust based on perfusion quality
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);

    // Update buffer
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate average for stability
    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    return spO2;
  }
  
  /**
   * Get last valid SpO2 with optional decay
   */
  private getLastValidSpo2(decayAmount: number): number {
    if (this.spo2Buffer.length > 0) {
      const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
      return Math.max(0, lastValid - decayAmount);
    }
    return 0;
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
