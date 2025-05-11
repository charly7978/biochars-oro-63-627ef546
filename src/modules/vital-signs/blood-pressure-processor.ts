import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';
import { SignalCoreProcessor } from '../../core/signal-processing/SignalCoreProcessor';
import { BloodPressureAnalyzer } from '../../core/analysis/BloodPressureAnalyzer';
import { UserProfile } from '../../core/types';
import { AnalysisSettings } from '../../core/config/AnalysisSettings';
import * as tf from '@tensorflow/tfjs';

export class BloodPressureProcessor {
  private readonly BP_BUFFER_SIZE = 150; // 5 segundos a 30Hz
  private readonly MEASUREMENT_DURATION = 30000; // 30 segundos en ms
  private readonly SAMPLE_RATE = 30; // 30Hz
  private readonly MIN_SAMPLES = 30; // 1 segundo de datos
  private readonly ANALYSIS_INTERVAL = 1000; // Analizar cada 1000 ms (1 segundo)

  private measurementStartTime: number | null = null;
  private lastAnalysisTime: number = 0; // Track last analysis time
  private isFingerPresent: boolean = false;
  private isPaused: boolean = false; // Flag for pause state
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  private lastInstantResult: { systolic: number; diastolic: number } | null = null; // Store last intermediate result

  // private neuralModel: BloodPressureNeuralModel; // Temporarily commented out
  private signalProcessor: SignalCoreProcessor;
  private analyzer: BloodPressureAnalyzer;

  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    // this.neuralModel = new BloodPressureNeuralModel(); // Temporarily commented out
    this.signalProcessor = new SignalCoreProcessor({
      bufferSize: this.BP_BUFFER_SIZE,
      sampleRate: this.SAMPLE_RATE,
      channels: ['bloodPressure']
    });
    this.analyzer = new BloodPressureAnalyzer(userProfile, settings);
  }

  public calculateBloodPressure(values: number[]): { systolic: number; diastolic: number } | null {
    // If paused, return the last known intermediate result without processing
    if (this.isPaused) {
        // console.log("BP Processor Paused");
        return this.lastInstantResult;
    }

    // Basic checks (data length, finger presence - though finger check might be redundant now)
    if (!values || values.length < this.MIN_SAMPLES) {
      return this.lastInstantResult; 
    }
    const currentAmplitude = Math.max(...values) - Math.min(...values);
    this.isFingerPresent = currentAmplitude > 0.1; 
    if (!this.isFingerPresent) {
        // This condition might be handled externally now, but as fallback:
        this.resetMeasurement(); // If finger lost internally, reset completely
        return null;
    }

    // Start measurement if not already started
    if (this.measurementStartTime === null) {
      console.log("BP Measurement Starting...");
      this.measurementStartTime = Date.now();
      this.lastAnalysisTime = 0; 
      this.resetBuffers();
      this.lastInstantResult = null; 
      this.analyzer.startMeasurement(); 
    }

    // Process signal (assuming SignalCoreProcessor is stateful and handles buffering)
    values.forEach(value => {
      this.signalProcessor.processSignal(value);
    });
    const bpChannel = this.signalProcessor.getChannel('bloodPressure');
    if (!bpChannel) return this.lastInstantResult;
    const processedValues = bpChannel.getValues();
    if (processedValues.length < this.MIN_SAMPLES) return this.lastInstantResult;

    const now = Date.now();
    let currentAnalysisResult: { systolic: number; diastolic: number; quality?: number } | null = null;

    // Run analysis periodically (throttling)
    if (now - this.lastAnalysisTime >= this.ANALYSIS_INTERVAL) {
      const analyzerInput = processedValues.length > 150 ? processedValues.slice(-150) : processedValues;
      if (analyzerInput.length >= this.MIN_SAMPLES) { 
          currentAnalysisResult = this.analyzer.analyze(analyzerInput); // Use 'currentAnalysisResult' directly
          this.lastAnalysisTime = now;
          if (currentAnalysisResult && currentAnalysisResult.systolic > 0 && currentAnalysisResult.diastolic > 0) {
            this.lastInstantResult = { 
                systolic: Math.round(currentAnalysisResult.systolic), 
                diastolic: Math.round(currentAnalysisResult.diastolic) 
            };
            // Update buffers only when a new valid analysis is done AND not paused
            if (!this.isPaused) { 
                 this.updateBuffers(this.lastInstantResult.systolic, this.lastInstantResult.diastolic);
            }
          } 
      }
    }

    // Check if measurement duration has elapsed
    const elapsedTime = now - (this.measurementStartTime || now);
    if (elapsedTime >= this.MEASUREMENT_DURATION) {
      console.log(`BP Measurement Complete (${elapsedTime}ms). Calculating final result...`);
      const finalResult = this.calculateFinalResult();
      this.resetMeasurement(); // Reset after finishing the 30s cycle
      return finalResult; 
    }

    // Return the latest intermediate result during the measurement
    return this.lastInstantResult;
  }

  // --- Pause and Resume Methods --- 
  public pauseMeasurement(): void {
      if (!this.isPaused && this.measurementStartTime !== null) {
          this.isPaused = true;
          console.log("BP Measurement Paused");
      }
  }

  public resumeMeasurement(): void {
      if (this.isPaused) {
          this.isPaused = false;
          console.log("BP Measurement Resumed");
          // No need to adjust startTime, elapsedTime calculation handles the gap
      }
  }

  private calculateFinalResult(): { systolic: number; diastolic: number } | null {
    const validSystolic = this.systolicBuffer.filter(v => v > 0);
    const validDiastolic = this.diastolicBuffer.filter(v => v > 0);
    const minRequiredReadings = (this.MEASUREMENT_DURATION / this.ANALYSIS_INTERVAL) * 0.3; 
    if (validSystolic.length < minRequiredReadings || validDiastolic.length < minRequiredReadings) {
       console.warn(`BP Final Result: Not enough valid readings (${validSystolic.length} systolic, ${validDiastolic.length} diastolic). Returning last valid or zero.`);
       return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }
    const systolic = this.calculateMedian(validSystolic);
    const diastolic = this.calculateMedian(validDiastolic);
    this.lastValidMeasurement = { systolic, diastolic }; 
    console.log(`BP Final Result: S:${systolic}, D:${diastolic} from ${validSystolic.length} readings.`);
    return this.lastValidMeasurement;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0; 
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }
    return Math.round(sorted[middle]);
  }

  // Full reset for the BP measurement cycle
  private resetMeasurement(): void {
    console.log("Resetting BP Measurement Cycle.");
    this.measurementStartTime = null;
    this.lastAnalysisTime = 0;
    this.lastInstantResult = null; 
    this.isPaused = false; // Ensure not paused on reset
    this.resetBuffers();
    this.analyzer.reset(); // Reset the underlying analyzer as well
  }

  private resetBuffers(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }

  private updateBuffers(systolic: number, diastolic: number): void {
     if (systolic > 0 && diastolic > 0) { 
       this.systolicBuffer.push(systolic);
       this.diastolicBuffer.push(diastolic);
     }
  }

  // Public reset called by VitalSignsProcessor
  public reset(): void {
    this.resetMeasurement(); // Perform the full internal reset
    this.lastValidMeasurement = null; 
    this.signalProcessor.reset(); // Reset internal signal core processor
    // Analyzer is reset within resetMeasurement
  }
  
  // --- Feature extraction methods (kept for now, potential redundancy) ---
  private extractPPGFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): {
    amplitude: number;
    peakSlope: number;
    valleySlope: number;
    peakInterval: number;
    areaUnderCurve: number;
    dicroticIndex: number;
  } {
    // Ensure indices are valid
     if (!peakIndices || peakIndices.length < 2 || !valleyIndices || valleyIndices.length < 1) {
       console.warn("extractPPGFeatures: Invalid peak/valley indices provided.");
       return { amplitude: 0, peakSlope: 0, valleySlope: 0, peakInterval: 0, areaUnderCurve: 0, dicroticIndex: 0 };
     }

    const peaks = peakIndices.map(i => values[i]).filter(v => !isNaN(v));
    const valleys = valleyIndices.map(i => values[i]).filter(v => !isNaN(v));

     if (peaks.length < 2 || valleys.length < 1) {
        console.warn("extractPPGFeatures: Not enough valid peak/valley values.");
        return { amplitude: 0, peakSlope: 0, valleySlope: 0, peakInterval: 0, areaUnderCurve: 0, dicroticIndex: 0 };
     }

    const amplitude = Math.max(...peaks) - Math.min(...valleys);

    const peakSlopes: number[] = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const prevValleyIdx = valleyIndices.filter(v => v < peakIdx).pop();
      if (prevValleyIdx !== undefined && values[peakIdx] !== undefined && values[prevValleyIdx] !== undefined) {
        const timeDiff = (peakIdx - prevValleyIdx) / this.SAMPLE_RATE;
        if (timeDiff > 0) {
           peakSlopes.push((values[peakIdx] - values[prevValleyIdx]) / timeDiff);
        }
      }
    }
    const peakSlope = peakSlopes.length > 0 ? peakSlopes.reduce((a,b) => a + b, 0) / peakSlopes.length : 0;

    const valleySlopes: number[] = [];
     for (let i = 0; i < peakIndices.length; i++) {
        const peakIdx = peakIndices[i];
        const nextValleyIdx = valleyIndices.find(v => v > peakIdx);
        if (nextValleyIdx !== undefined && values[nextValleyIdx] !== undefined && values[peakIdx] !== undefined) {
           const timeDiff = (nextValleyIdx - peakIdx) / this.SAMPLE_RATE;
           if (timeDiff > 0) {
              valleySlopes.push((values[nextValleyIdx] - values[peakIdx]) / timeDiff);
           }
        }
     }
    const valleySlope = valleySlopes.length > 0 ? valleySlopes.reduce((a,b) => a + b, 0) / valleySlopes.length : 0;


    const peakIntervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
       if (peakIndices[i] !== undefined && peakIndices[i-1] !== undefined) {
          peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
       }
    }
    const avgIntervalSamples = peakIntervals.length > 0 ? peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length : 0;
    const peakInterval = avgIntervalSamples * (1000 / this.SAMPLE_RATE); // ms

    const areaUnderCurve = this.calculateAreaUnderCurve(values);
    const dicroticIndex = this.calculateDicroticIndex(values, peakIndices);

    return { amplitude, peakSlope, valleySlope, peakInterval, areaUnderCurve, dicroticIndex };
  }

  private calculateAreaUnderCurve(values: number[]): number {
     if (values.length === 0) return 0;
     const minVal = Math.min(...values);
     // Normalize values to be non-negative relative to the minimum
     const normalizedValues = values.map(v => v - minVal);
     // Simple trapezoidal rule approximation
     let area = 0;
     for (let i = 1; i < normalizedValues.length; i++) {
        area += (normalizedValues[i] + normalizedValues[i-1]) / 2;
     }
     // Normalize by duration and max amplitude (relative to min)
     const maxVal = Math.max(...values);
     const maxAmplitude = maxVal - minVal;
     if (maxAmplitude === 0) return 0; // Avoid division by zero
     return area / (normalizedValues.length * maxAmplitude);
  }


  private calculateDicroticIndex(values: number[], peakIndices: number[]): number {
    // Placeholder: Needs a proper algorithm to find dicrotic notch
    // This is a complex feature and might require more sophisticated signal processing
    // For now, return a default value or estimate based on simpler features
    if (peakIndices.length < 1) return 0;
    const lastPeakIndex = peakIndices[peakIndices.length - 1];
    // Very basic placeholder: position of minimum after last peak
    const segmentAfterPeak = values.slice(lastPeakIndex);
    if (segmentAfterPeak.length < 2) return 0;
    const minValueAfterPeak = Math.min(...segmentAfterPeak);
    const maxValue = values[lastPeakIndex];
    if (maxValue === minValueAfterPeak) return 0;
    // Simple ratio, not a real dicrotic index
    return minValueAfterPeak / maxValue;
  }
}
