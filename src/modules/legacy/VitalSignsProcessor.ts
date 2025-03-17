/**
 * Legacy VitalSignsProcessor converted to TypeScript
 * This file adapts the old JavaScript implementation into the new TypeScript structure
 * by leveraging the modular components and configurations
 */

import { ProcessorConfig } from '../vital-signs/ProcessorConfig';
import { FilterUtils } from '../signal-processing/FilterUtils';
import { SignalValidator } from '../signal-validation/SignalValidator';
import { SignalAnalyzer } from '../signal-analysis/SignalAnalyzer';
import { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';

export class LegacyVitalSignsProcessor {
  private ppgValues: number[] = [];
  private lastValue = 0;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private baselineRhythm = 0;
  private isLearningPhase = true;
  private arrhythmiaDetected = false;
  private measurementStartTime: number = Date.now();
  
  // Buffer management
  private spo2Buffer: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private smaBuffer: number[] = [];
  
  // Validator for signal quality
  private signalValidator: SignalValidator;
  
  constructor() {
    this.signalValidator = new SignalValidator();
    this.measurementStartTime = Date.now();
  }

  private detectArrhythmia(): void {
    if (this.rrIntervals.length < ProcessorConfig.RR_WINDOW_SIZE) {
      console.log("VitalSignsProcessor: Insufficient RR intervals for RMSSD", {
        current: this.rrIntervals.length,
        needed: ProcessorConfig.RR_WINDOW_SIZE
      });
      return;
    }

    const recentRR = this.rrIntervals.slice(-ProcessorConfig.RR_WINDOW_SIZE);
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    console.log("VitalSignsProcessor: RMSSD Analysis", {
      timestamp: new Date().toISOString(),
      rmssd,
      threshold: ProcessorConfig.RMSSD_THRESHOLD,
      recentRR,
      avgRR,
      lastRR,
      prematureBeat
    });

    const newArrhythmiaState = rmssd > ProcessorConfig.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
      console.log("VitalSignsProcessor: Arrhythmia state change", {
        previousState: !this.arrhythmiaDetected,
        newState: this.arrhythmiaDetected,
        cause: {
          rmssdExceeded: rmssd > ProcessorConfig.RMSSD_THRESHOLD,
          prematureBeat,
          rmssdValue: rmssd
        }
      });
    }
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    console.log("VitalSignsProcessor: Signal input", {
      ppgValue,
      isLearning: this.isLearningPhase,
      rrIntervalsCount: this.rrIntervals.length,
      receivedRRData: rrData ? true : false
    });

    // Apply filtering to the signal
    const filteredValue = this.applySMAFilter(ppgValue);
    
    // Update PPG values buffer
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > ProcessorConfig.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Process RR data if available
    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Detect arrhythmias if we have enough data and not in learning phase
      if (!this.isLearningPhase && this.rrIntervals.length >= ProcessorConfig.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }

    // Calculate SpO2
    const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
    
    // Calculate blood pressure
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    // Determine arrhythmia status
    let arrhythmiaStatus = "--";
    
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.measurementStartTime;

    // After learning period, report arrhythmia status
    if (timeSinceStart > ProcessorConfig.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
      arrhythmiaStatus = this.arrhythmiaDetected ? "ARRHYTHMIA DETECTED" : "NO ARRHYTHMIAS";
    }

    console.log("VitalSignsProcessor: Current state", {
      timestamp: currentTime,
      isLearningPhase: this.isLearningPhase,
      arrhythmiaDetected: this.arrhythmiaDetected,
      arrhythmiaStatus,
      rrIntervals: this.rrIntervals.length
    });

    // Use the SignalAnalyzer to determine confidence values
    const signalQuality = this.signalValidator.validateSignalQuality(ppgValue).validSampleCounter / 10;
    
    // Create and return a standard VitalSignsResult
    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus,
      glucose: 0, // Not calculated in legacy processor
      lipids: {
        totalCholesterol: 0, // Not calculated in legacy processor
        triglycerides: 0 // Not calculated in legacy processor
      }
    };
  }

  private calculateSpO2(values: number[]): number {
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

  private calculateBloodPressure(values: number[]): {
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

  private applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > ProcessorConfig.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }

  public reset(): void {
    // Reset all buffers and state
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.signalValidator.reset();
    console.log("VitalSignsProcessor: Complete reset");
  }
}
