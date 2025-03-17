
/**
 * Legacy blood pressure calculator component
 * Handles blood pressure estimation from PPG signals
 */

import { FilterUtils } from '../../signal-processing/FilterUtils';
import { ProcessorConfig } from '../../vital-signs/ProcessorConfig';

export class LegacyBloodPressureCalculator {
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  
  /**
   * Calculate blood pressure from PPG values
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
      return { systolic: 120, diastolic: 80 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    // Calculate weighted PTT for more stability
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);

    const normalizedPTT = Math.max(300, Math.min(1200, weightedPTT));
    
    // Calculate amplitude from peaks and valleys
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));

    // Calculate blood pressure based on PTT and amplitude
    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    // Apply physiological limits
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Ensure proper differential between systolic and diastolic
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }

    // Update buffers for smoothing
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > ProcessorConfig.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    // Apply exponential weighting for stable output
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(ProcessorConfig.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;

    console.log("VitalSignsProcessor: Blood pressure calculation", {
      instant: {
        systolic: Math.round(instantSystolic),
        diastolic: Math.round(instantDiastolic)
      },
      buffered: {
        systolic: Math.round(finalSystolic),
        diastolic: Math.round(finalDiastolic)
      },
      bufferSize: this.systolicBuffer.length,
      ptt: normalizedPTT,
      amplitude: normalizedAmplitude
    });

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }

  /**
   * Calculate signal amplitude from peaks and valleys
   */
  private calculateAmplitude(
    values: number[],
    peaks: number[],
    valleys: number[]
  ): number {
    if (peaks.length === 0 || valleys.length === 0) return 0;

    const amps: number[] = [];
    const len = Math.min(peaks.length, valleys.length);
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    if (amps.length === 0) return 0;

    const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
    return mean;
  }
  
  /**
   * Reset the blood pressure calculator state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
