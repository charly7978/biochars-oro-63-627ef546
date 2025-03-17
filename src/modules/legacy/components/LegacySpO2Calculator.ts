
/**
 * Legacy SpO2 calculator component
 * Handles oxygen saturation calculation from PPG signals
 */

import { FilterUtils } from '../../signal-processing/FilterUtils';
import { ProcessorConfig } from '../../vital-signs/ProcessorConfig';

export class LegacySpO2Calculator {
  private spo2Buffer: number[] = [];
  
  /**
   * Calculate SpO2 (oxygen saturation) from PPG values
   */
  public calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const dc = FilterUtils.calculateDC(values);
    if (dc === 0) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const ac = FilterUtils.calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < ProcessorConfig.PERFUSION_INDEX_THRESHOLD) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 2);
      }
      return 0;
    }

    const R = (ac / dc) / ProcessorConfig.SPO2_CALIBRATION_FACTOR;
    
    let spO2 = Math.round(98 - (15 * R));
    
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);

    // Update SpO2 buffer
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > ProcessorConfig.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calculate average from buffer for stability
    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    console.log("VitalSignsProcessor: SpO2 Calculation", {
      ac,
      dc,
      ratio: R,
      perfusionIndex,
      rawSpO2: spO2,
      bufferSize: this.spo2Buffer.length,
      smoothedSpO2: spO2
    });

    return spO2;
  }
  
  /**
   * Reset the SpO2 calculator state
   */
  public reset(): void {
    this.spo2Buffer = [];
  }
}
