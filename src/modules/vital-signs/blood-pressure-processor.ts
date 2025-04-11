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
    if (!values || values.length < this.MIN_SAMPLES) {
      return this.lastInstantResult; // Return last known result if not enough data
    }

    // Verificar si hay un dedo presente basado en la amplitud de la señal
    const currentAmplitude = Math.max(...values) - Math.min(...values);
    this.isFingerPresent = currentAmplitude > 0.1;

    if (!this.isFingerPresent) {
      this.resetMeasurement();
      return null; // Return null if finger is not present
    }

    // Iniciar medición si no está en curso
    if (this.measurementStartTime === null) {
      this.measurementStartTime = Date.now();
      this.lastAnalysisTime = 0; // Reset last analysis time
      this.resetBuffers();
      this.lastInstantResult = null; // Reset last instant result
      this.analyzer.startMeasurement(); // Start analyzer measurement period
    }

    // Procesar señal a través del SignalCoreProcessor
    // This could be optimized if SignalCoreProcessor accepts arrays
    values.forEach(value => {
      this.signalProcessor.processSignal(value);
    });

    const bpChannel = this.signalProcessor.getChannel('bloodPressure');
    if (!bpChannel) {
      return this.lastInstantResult;
    }

    // Obtener señal procesada
    const processedValues = bpChannel.getValues();
    if (processedValues.length < this.MIN_SAMPLES) {
      return this.lastInstantResult;
    }

    const now = Date.now();
    let currentAnalysisResult: { systolic: number; diastolic: number; quality: number } | null = null;

    // --- Run analysis only once per second ---
    if (now - this.lastAnalysisTime >= this.ANALYSIS_INTERVAL) {
      // Analizar forma de onda PPG con el Analyzer
      // Pass only the last 150 samples (5 seconds) to the analyzer
      const analyzerInput = processedValues.length > 150 ? processedValues.slice(-150) : processedValues;
      
      if (analyzerInput.length >= this.MIN_SAMPLES) { // Ensure we still have enough samples after slicing
          const analysisResult = this.analyzer.analyze(analyzerInput);
          this.lastAnalysisTime = now;
    
          if (analysisResult && analysisResult.systolic > 0 && analysisResult.diastolic > 0) {
            // Store the valid result from the analyzer
            currentAnalysisResult = analysisResult;
    
            // Use only analyzer result for now
            this.lastInstantResult = {
              systolic: Math.round(analysisResult.systolic),
              diastolic: Math.round(analysisResult.diastolic)
            };
    
            // Update buffers only when a new analysis is done
            this.updateBuffers(this.lastInstantResult.systolic, this.lastInstantResult.diastolic);
          }
          // If analysisResult is null or invalid, lastInstantResult remains unchanged
      }
    }
    // --- End of periodic analysis ---

    // Verificar si la medición está completa
    const elapsedTime = now - (this.measurementStartTime || now);
    if (elapsedTime >= this.MEASUREMENT_DURATION) {
      // Calcular resultado final
      const finalResult = this.calculateFinalResult();
      this.resetMeasurement(); // Reset after final calculation
      return finalResult; // Return final result
    }

    // Retornar el último resultado instantáneo válido durante la medición
    return this.lastInstantResult;
  }

  private calculateFinalResult(): { systolic: number; diastolic: number } | null {
    // Filtrar valores válidos
    const validSystolic = this.systolicBuffer.filter(v => v > 0);
    const validDiastolic = this.diastolicBuffer.filter(v => v > 0);

    // Require at least a few seconds of valid data for final result
    const minRequiredReadings = (this.MEASUREMENT_DURATION / this.ANALYSIS_INTERVAL) * 0.3; // e.g., 30% of expected readings

    if (validSystolic.length < minRequiredReadings || validDiastolic.length < minRequiredReadings) {
       console.warn(`BP Final Result: Not enough valid readings (${validSystolic.length} systolic, ${validDiastolic.length} diastolic). Returning last valid or zero.`);
       return this.lastValidMeasurement || { systolic: 0, diastolic: 0 }; // Return last overall valid or zero if none
    }

    // Calcular medianas
    const systolic = this.calculateMedian(validSystolic);
    const diastolic = this.calculateMedian(validDiastolic);

    this.lastValidMeasurement = { systolic, diastolic }; // Store this as the last overall valid measurement
    console.log(`BP Final Result: S:${systolic}, D:${diastolic} from ${validSystolic.length} readings.`);
    return this.lastValidMeasurement;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0; // Avoid errors on empty array
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }
    return Math.round(sorted[middle]);
  }

  private resetMeasurement(): void {
    this.measurementStartTime = null;
    this.lastAnalysisTime = 0;
    this.lastInstantResult = null; // Clear intermediate result on reset
    // Don't reset lastValidMeasurement here, keep it until next successful measurement
    this.resetBuffers();
    // No need to reset analyzer here, it resets internally or via VitalSignsProcessor
  }

  private resetBuffers(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }

  // Update buffers only when a new analysis is performed
  private updateBuffers(systolic: number, diastolic: number): void {
     if (systolic > 0 && diastolic > 0) { // Only buffer valid readings
       this.systolicBuffer.push(systolic);
       this.diastolicBuffer.push(diastolic);

       // Optional: Limit buffer size if needed, though median calculation handles outliers
       // if (this.systolicBuffer.length > SOME_MAX_BUFFER_LIMIT) {
       //   this.systolicBuffer.shift();
       //   this.diastolicBuffer.shift();
       // }
     }
  }

  public reset(): void {
    this.resetMeasurement();
    this.lastValidMeasurement = null; // Full reset clears everything
    this.signalProcessor.reset();
    this.analyzer.reset();
    // if (this.neuralModel) this.neuralModel.reset(); // If re-enabled
  }

  // Feature extraction and quality calculation might be redundant if analyzer does it
  // Consider removing these if BloodPressureAnalyzer handles them internally

  private calculateSignalQuality(signal: number[]): number {
    if (signal.length < 2) return 0;
    const amplitude = Math.max(...signal) - Math.min(...signal);
    const noise = this.calculateSignalNoise(signal);
    if (noise === 0) return amplitude > 0 ? 100 : 0; // Avoid division by zero
    const snr = amplitude / noise;
    return Math.min(100, Math.max(0, snr * 50)); // Scale SNR to 0-100 quality
  }

  private calculateSignalNoise(signal: number[]): number {
    if (signal.length < 2) return 0;
    let noise = 0;
    for (let i = 1; i < signal.length; i++) {
      noise += Math.abs(signal[i] - signal[i-1]);
    }
    // Average absolute difference as noise estimate
    return noise / (signal.length -1) ;
  }

  // --- Feature Extraction (Potentially redundant if analyzer handles it) ---
  // Keeping these for now, but consider moving logic entirely into BloodPressureAnalyzer

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
