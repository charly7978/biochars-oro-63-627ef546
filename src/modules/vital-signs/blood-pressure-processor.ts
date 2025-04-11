import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';
import { SignalCoreProcessor } from '../../core/signal-processing/SignalCoreProcessor';
import { BloodPressureAnalyzer } from '../../core/analysis/BloodPressureAnalyzer';
import { UserProfile } from '../../core/types';
import { AnalysisSettings } from '../../core/config/AnalysisSettings';
import * as tf from '@tensorflow/tfjs';

export class BloodPressureProcessor extends BloodPressureAnalyzer {
  private readonly BP_BUFFER_SIZE = 150;
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  
  private neuralModel: BloodPressureNeuralModel;
  private signalProcessor: SignalCoreProcessor;

  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
    
    this.neuralModel = new BloodPressureNeuralModel();
    this.signalProcessor = new SignalCoreProcessor({
      bufferSize: this.BP_BUFFER_SIZE,
      sampleRate: 30,
      channels: ['bloodPressure']
    });
  }

  public calculateBloodPressure(values: number[]): { systolic: number; diastolic: number } {
    if (!values || values.length < 30) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // 1. Procesar señal a través del SignalCoreProcessor
    values.forEach(value => this.signalProcessor.processSignal(value));
    const bpChannel = this.signalProcessor.getChannel('bloodPressure');
    if (!bpChannel) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // 2. Obtener señal filtrada
    const processedValues = bpChannel.getValues();
    
    // 3. Analizar forma de onda PPG
    const { peakIndices, valleyIndices } = findPeaksAndValleys(processedValues);
    if (peakIndices.length < 2 || valleyIndices.length < 2) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // 4. Extraer características
    const ppgFeatures = this.extractPPGFeatures(processedValues, peakIndices, valleyIndices);

    // 5. Convertir características a tensor para el modelo neural
    const featureArray = [
      ppgFeatures.amplitude,
      ppgFeatures.peakSlope,
      ppgFeatures.valleySlope,
      ppgFeatures.peakInterval / 1000, // convertir a segundos
      ppgFeatures.areaUnderCurve,
      ppgFeatures.dicroticIndex
    ];

    // 6. Obtener predicción del modelo neural
    const prediction = this.neuralModel.predict(featureArray);

    // 7. Analizar con BloodPressureAnalyzer (clase padre)
    const result = super.analyze(processedValues);

    // 8. Combinar predicción neural con análisis tradicional
    const finalResult = {
      systolic: Math.round((prediction[0] + result.systolic) / 2),
      diastolic: Math.round((prediction[1] + result.diastolic) / 2)
    };

    // 9. Actualizar buffers
    this.updateBuffers(finalResult.systolic, finalResult.diastolic);
    this.lastValidMeasurement = finalResult;

    return finalResult;
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

  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }

  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastValidMeasurement = null;
  }
}
