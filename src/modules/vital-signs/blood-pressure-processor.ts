
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { FilterUtils } from '../signal-processing/FilterUtils';
import { ProcessorConfig } from './ProcessorConfig';
import { PTTCalculator } from './bp/ptt-calculator';
import { AmplitudeCalculator } from './bp/amplitude-calculator';
import { BPCalculator } from './bp/bp-calculator';
import { BPSmoother } from './bp/bp-smoother';

/**
 * Blood Pressure Processor
 * Coordinates the process of estimating blood pressure from genuine PPG signals
 * No data simulation or result manipulation
 */
export class BloodPressureProcessor {
  private readonly BP_BUFFER_SIZE = ProcessorConfig.BP_BUFFER_SIZE;
  private readonly BP_ALPHA = ProcessorConfig.BP_ALPHA;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];

  /**
   * Calculate blood pressure from real PPG signal without simulation
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = FilterUtils.findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 0, diastolic: 0 };
    }

    // Extract and process PTT values from actual signal
    const pttValues = PTTCalculator.extractPTTValues(peakIndices);
    const weightedPTT = PTTCalculator.calculateWeightedPTT(pttValues);
    const normalizedPTT = PTTCalculator.normalizePTT(weightedPTT);
    
    // Calculate and normalize amplitude from real measurements
    const amplitude = AmplitudeCalculator.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = AmplitudeCalculator.normalizeAmplitude(amplitude);

    // Calculate initial blood pressure values from actual data
    let { systolic, diastolic } = BPCalculator.calculateBPValues(normalizedPTT, normalizedAmplitude);
    
    // Normalize pressure differential for physiological accuracy
    const normalizedBP = BPCalculator.normalizePressureDifferential(systolic, diastolic);
    systolic = normalizedBP.systolic;
    diastolic = normalizedBP.diastolic;

    // Add to buffer for smoothing (no simulation)
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    if (this.systolicBuffer.length === 0) {
      return { systolic: 0, diastolic: 0 };
    }

    // Calculate smoothed values from actual measurements
    const { finalSystolic, finalDiastolic } = BPSmoother.calculateSmoothedValues(
      this.systolicBuffer, 
      this.diastolicBuffer, 
      this.BP_ALPHA
    );

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }

  /**
   * Reset blood pressure processor
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
