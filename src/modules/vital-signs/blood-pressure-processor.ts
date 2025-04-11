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

  private measurementStartTime: number | null = null;
  private isFingerPresent: boolean = false;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  
  private neuralModel: BloodPressureNeuralModel;
  private signalProcessor: SignalCoreProcessor;
  private analyzer: BloodPressureAnalyzer;

  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    this.neuralModel = new BloodPressureNeuralModel();
    this.signalProcessor = new SignalCoreProcessor({
      bufferSize: this.BP_BUFFER_SIZE,
      sampleRate: this.SAMPLE_RATE,
      channels: ['bloodPressure']
    });
    this.analyzer = new BloodPressureAnalyzer(userProfile, settings);
  }

  public calculateBloodPressure(values: number[]): { systolic: number; diastolic: number } | null {
    if (!values || values.length < this.MIN_SAMPLES) {
      return null;
    }

    // Verificar si hay un dedo presente basado en la amplitud de la señal
    const currentAmplitude = Math.max(...values) - Math.min(...values);
    this.isFingerPresent = currentAmplitude > 0.1;

    if (!this.isFingerPresent) {
      this.resetMeasurement();
      return null;
    }

    // Iniciar medición si no está en curso
    if (this.measurementStartTime === null) {
      this.measurementStartTime = Date.now();
      this.resetBuffers();
    }

    // Procesar señal a través del SignalCoreProcessor
    values.forEach(value => {
      this.signalProcessor.processSignal(value);
    });

    const bpChannel = this.signalProcessor.getChannel('bloodPressure');
    if (!bpChannel) {
      return null;
    }

    // Obtener señal procesada
    const processedValues = bpChannel.getValues();
    if (processedValues.length < this.MIN_SAMPLES) {
      return null;
    }

    // Analizar forma de onda PPG
    const { peakIndices, valleyIndices } = findPeaksAndValleys(processedValues);
    if (peakIndices.length < 2 || valleyIndices.length < 2) {
      return null;
    }

    // Extraer características
    const ppgFeatures = this.extractPPGFeatures(processedValues, peakIndices, valleyIndices);

    // Obtener predicción del modelo neural
    const featureArray = [
      ppgFeatures.amplitude,
      ppgFeatures.peakSlope,
      ppgFeatures.valleySlope,
      ppgFeatures.peakInterval / 1000,
      ppgFeatures.areaUnderCurve,
      ppgFeatures.dicroticIndex
    ];

    const prediction = this.neuralModel.predict(featureArray);
    const result = this.analyzer.analyze(processedValues);

    // Calcular presión instantánea
    const instantResult = {
      systolic: Math.round((prediction[0] + result.systolic) / 2),
      diastolic: Math.round((prediction[1] + result.diastolic) / 2)
    };

    // Actualizar buffers
    this.updateBuffers(instantResult.systolic, instantResult.diastolic);

    // Verificar si la medición está completa
    const elapsedTime = Date.now() - this.measurementStartTime;
    if (elapsedTime >= this.MEASUREMENT_DURATION) {
      // Calcular resultado final
      const finalResult = this.calculateFinalResult();
      this.resetMeasurement();
      return finalResult;
    }

    // Retornar null mientras la medición está en curso
    return null;
  }

  private calculateFinalResult(): { systolic: number; diastolic: number } {
    // Filtrar valores válidos
    const validSystolic = this.systolicBuffer.filter(v => v > 0);
    const validDiastolic = this.diastolicBuffer.filter(v => v > 0);

    if (validSystolic.length < 5 || validDiastolic.length < 5) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // Calcular medianas
    const systolic = this.calculateMedian(validSystolic);
    const diastolic = this.calculateMedian(validDiastolic);

    this.lastValidMeasurement = { systolic, diastolic };
    return this.lastValidMeasurement;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }
    return Math.round(sorted[middle]);
  }

  private resetMeasurement(): void {
    this.measurementStartTime = null;
    this.resetBuffers();
  }

  private resetBuffers(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }

  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }

  public reset(): void {
    this.resetMeasurement();
    this.lastValidMeasurement = null;
    this.signalProcessor.reset();
    this.analyzer.reset();
  }

  private calculateSignalQuality(signal: number[]): number {
    const amplitude = Math.max(...signal) - Math.min(...signal);
    const noise = this.calculateSignalNoise(signal);
    const snr = amplitude / noise;
    return Math.min(100, Math.max(0, snr * 50));
  }

  private calculateSignalNoise(signal: number[]): number {
    let noise = 0;
    for (let i = 1; i < signal.length; i++) {
      noise += Math.abs(signal[i] - signal[i-1]);
    }
    return noise / signal.length;
  }

  private extractPPGFeatures(values: number[], peakIndices: number[], valleyIndices: number[]): {
    amplitude: number;          // Amplitud pico-valle
    peakSlope: number;         // Pendiente sistólica
    valleySlope: number;       // Pendiente diastólica
    peakInterval: number;      // Intervalo entre picos (ms)
    areaUnderCurve: number;    // Área bajo la curva
    dicroticIndex: number;     // Índice dicrótico
  } {
    // Amplitud pico-valle (correlaciona con presión de pulso)
    const peaks = peakIndices.map(i => values[i]);
    const valleys = valleyIndices.map(i => values[i]);
    const amplitude = Math.max(...peaks) - Math.min(...valleys);

    // Pendiente sistólica (correlaciona con presión sistólica)
    const peakSlopes = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const prevValleyIdx = valleyIndices.filter(v => v < peakIdx).pop();
      if (prevValleyIdx !== undefined) {
        const slope = (values[peakIdx] - values[prevValleyIdx]) / (peakIdx - prevValleyIdx);
        peakSlopes.push(slope);
      }
    }
    const peakSlope = peakSlopes.reduce((a,b) => a + b, 0) / peakSlopes.length;

    // Pendiente diastólica (correlaciona con presión diastólica)
    const valleySlopes = [];
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const nextValleyIdx = valleyIndices.find(v => v > peakIdx);
      if (nextValleyIdx !== undefined) {
        const slope = (values[nextValleyIdx] - values[peakIdx]) / (nextValleyIdx - peakIdx);
        valleySlopes.push(slope);
      }
    }
    const valleySlope = valleySlopes.reduce((a,b) => a + b, 0) / valleySlopes.length;

    // Intervalo entre picos (correlaciona inversamente con presión)
    const peakIntervals = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakIntervals.push(peakIndices[i] - peakIndices[i-1]);
    }
    const peakInterval = (peakIntervals.reduce((a,b) => a + b, 0) / peakIntervals.length) * (1000/30); // ms

    // Área bajo la curva (correlaciona con volumen sistólico)
    const areaUnderCurve = this.calculateAreaUnderCurve(values);

    // Índice dicrótico (correlaciona con resistencia vascular)
    const dicroticIndex = this.calculateDicroticIndex(values, peakIndices);

    return {
      amplitude,
      peakSlope,
      valleySlope,
      peakInterval,
      areaUnderCurve,
      dicroticIndex
    };
  }

  private calculateAreaUnderCurve(values: number[]): number {
    const baseline = Math.min(...values);
    const area = values.reduce((sum, val) => sum + (val - baseline), 0);
    return area / (values.length * (Math.max(...values) - baseline));
  }

  private calculateDicroticIndex(values: number[], peakIndices: number[]): number {
    let totalIndex = 0;
    let count = 0;

    for (let i = 0; i < peakIndices.length - 1; i++) {
      const start = peakIndices[i];
      const end = peakIndices[i + 1];
      const segment = values.slice(start, end);

      if (segment.length < 10) continue;

      const peakValue = values[start];
      const minAfterPeak = Math.min(...segment.slice(Math.floor(segment.length * 0.3)));
      const dicroticNotch = Math.max(...segment.slice(Math.floor(segment.length * 0.3)));

      const index = (dicroticNotch - minAfterPeak) / (peakValue - minAfterPeak);
      if (!isNaN(index)) {
        totalIndex += index;
        count++;
      }
    }

    return count > 0 ? totalIndex / count : 0.5;
  }
}
