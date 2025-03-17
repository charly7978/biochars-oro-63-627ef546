
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
      return 0;
    }

    const dc = FilterUtils.calculateDC(values);
    if (dc === 0) {
      return 0;
    }

    const ac = FilterUtils.calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      return 0;
    }

    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    // Calculate SpO2 using standard formula
    let spO2 = Math.round(110 - (25 * R));
    
    // Ensure results are in valid physiological range
    spO2 = Math.max(70, Math.min(100, spO2));

    // Update buffer for stability
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
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
