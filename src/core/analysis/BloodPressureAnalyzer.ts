
import { ProcessorConfig } from '../config/ProcessorConfig';
import { VitalSignsConfig } from '../config/VitalSignsConfig';

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  confidence: number;
}

/**
 * Unified blood pressure analysis class
 * Combines functionality from different implementations
 */
export class BloodPressureAnalyzer {
  private bpCalibrationFactor: number = 0.85;
  private confidence: number = 0;
  private lastEstimation: BloodPressureResult = { 
    systolic: 0, 
    diastolic: 0, 
    confidence: 0 
  };

  constructor(private config: ProcessorConfig = {
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    hemoglobinCalibrationFactor: 1.0,
    confidenceThreshold: 0.6,
    bpCalibrationFactor: 0.85
  }) {
    this.bpCalibrationFactor = config.bpCalibrationFactor || 0.85;
  }

  /**
   * Estimate blood pressure based on PPG characteristics
   */
  public estimate(ppgValues: number[]): BloodPressureResult {
    if (ppgValues.length < VitalSignsConfig.bloodPressure.DATA.MIN_DATA_POINTS) {
      return { systolic: 0, diastolic: 0, confidence: 0 };
    }

    const amplitude = this.calculateAmplitude(ppgValues);
    const peaks = this.detectPeaks(ppgValues);
    const peakToValleyRatio = this.calculatePeakToValleyRatio(ppgValues, peaks);
    
    // Calculate systolic pressure using weighted factors
    const baseSystolic = 120;
    const amplitudeFactor = 0.2 * amplitude;
    const peakFactor = 0.3 * peakToValleyRatio;
    
    // Apply calibration
    const systolic = Math.round((baseSystolic + amplitudeFactor + peakFactor) * this.bpCalibrationFactor);
    
    // Calculate diastolic as a function of systolic (typical ratio is about 0.65-0.7)
    const diastolicRatio = 0.67;
    const diastolic = Math.round(systolic * diastolicRatio);
    
    // Calculate confidence based on signal quality
    this.confidence = this.calculateConfidence(ppgValues);
    
    // Constrain to physiological ranges
    const finalSystolic = this.constrainInRange(systolic, 
      VitalSignsConfig.bloodPressure.CALCULATION.MIN_SYSTOLIC, 
      VitalSignsConfig.bloodPressure.CALCULATION.MAX_SYSTOLIC);
    
    const finalDiastolic = this.constrainInRange(diastolic, 
      VitalSignsConfig.bloodPressure.CALCULATION.MIN_DIASTOLIC, 
      VitalSignsConfig.bloodPressure.CALCULATION.MAX_DIASTOLIC);
    
    this.lastEstimation = {
      systolic: finalSystolic,
      diastolic: finalDiastolic,
      confidence: this.confidence
    };
    
    return this.lastEstimation;
  }

  /**
   * Calculate blood pressure using the simplified estimation algorithm
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    const result = this.estimate(ppgValues);
    return { 
      systolic: result.systolic, 
      diastolic: result.diastolic 
    };
  }

  private calculateAmplitude(values: number[]): number {
    const max = Math.max(...values);
    const min = Math.min(...values);
    return max - min;
  }

  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }

  private calculatePeakToValleyRatio(values: number[], peaks: number[]): number {
    if (peaks.length < 2) return 1.0;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      
      // Find the minimum value after the peak (valley)
      let minVal = values[peakIndex];
      let minIdx = peakIndex;
      
      const searchEnd = i < peaks.length - 1 ? peaks[i + 1] : values.length - 1;
      
      for (let j = peakIndex + 1; j <= searchEnd; j++) {
        if (values[j] < minVal) {
          minVal = values[j];
          minIdx = j;
        }
      }
      
      if (minIdx > peakIndex) {
        const ratio = values[peakIndex] / minVal;
        sum += ratio;
        count++;
      }
    }
    
    return count > 0 ? sum / count : 1.0;
  }

  private calculateConfidence(values: number[]): number {
    if (values.length < VitalSignsConfig.bloodPressure.DATA.MIN_DATA_POINTS) {
      return 0;
    }
    
    // Calculate consistency of the signal
    const recentValues = values.slice(-30);
    const peaks = this.detectPeaks(recentValues);
    
    if (peaks.length < 2) {
      return 0.1;
    }
    
    // Calculate inter-peak intervals
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Calculate coefficient of variation for intervals
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;
    
    // Lower CV means more regular intervals, which increases confidence
    let confidence = 1 - Math.min(1, cv * 2);
    
    // Additional factors
    const amplitude = this.calculateAmplitude(recentValues);
    const signalStrengthFactor = Math.min(1, amplitude / 0.5);
    
    // Weighted confidence
    confidence = confidence * 0.7 + signalStrengthFactor * 0.3;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private constrainInRange(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public getLastResult(): BloodPressureResult {
    return { ...this.lastEstimation };
  }

  public getConfidence(): number {
    return this.confidence;
  }

  public reset(): void {
    this.confidence = 0;
    this.lastEstimation = { systolic: 0, diastolic: 0, confidence: 0 };
  }
}
