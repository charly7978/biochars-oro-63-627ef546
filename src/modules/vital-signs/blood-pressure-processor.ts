import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';
import { IntelligentCalibrationSystem } from '../../core/calibration/IntelligentCalibrationSystem';

/**
 * Procesador de presión arterial que usa modelo neuronal y calibración inteligente
 */
export class BloodPressureProcessor {
  private lastValidPeakValue: number = 0;
  private lastValidValleyValue: number = 0;
  private neuralModel: BloodPressureNeuralModel;
  private calibrationSystem: IntelligentCalibrationSystem;
  private currentCalibrationParams = {
    gain: 1.0,
    offset: 0,
    threshold: 0.5,
    sensitivity: 1.0
  };

  constructor() {
    this.neuralModel = new BloodPressureNeuralModel();
    this.calibrationSystem = IntelligentCalibrationSystem.getInstance();
  }

  /**
   * Calcula la presión arterial usando el modelo neuronal y calibración inteligente
   */
  public calculateBloodPressure(ppgSignal: number[]): { systolic: number; diastolic: number } {
    if (!ppgSignal || ppgSignal.length < 2) {
      return { 
        systolic: this.lastValidPeakValue, 
        diastolic: this.lastValidValleyValue 
      };
    }

    // Obtener picos y valles reales de la señal PPG sin manipulación
    const { peakIndices, valleyIndices } = findPeaksAndValleys(ppgSignal);
    
    if (peakIndices.length === 0 || valleyIndices.length === 0) {
      return { 
        systolic: this.lastValidPeakValue, 
        diastolic: this.lastValidValleyValue 
      };
    }

    // Usar el modelo neuronal para procesar la señal PPG
    const prediction = this.neuralModel.predict(ppgSignal);

    // Aplicar calibración inteligente
    this.currentCalibrationParams = this.calibrationSystem.adjustCalibrationParameters(
      ppgSignal,
      this.currentCalibrationParams
    );

    // Extraer y calibrar valores de presión
    const rawSystolic = prediction[0];
    const rawDiastolic = prediction[1];

    this.lastValidPeakValue = rawSystolic * this.currentCalibrationParams.gain + this.currentCalibrationParams.offset;
    this.lastValidValleyValue = rawDiastolic * this.currentCalibrationParams.gain + this.currentCalibrationParams.offset;

    // Proporcionar retroalimentación al sistema de calibración
    this.calibrationSystem.provideFeedback({
      measurementType: 'bloodPressure',
      accuracy: this.calculateSignalQuality(ppgSignal),
      conditions: {
        signalStrength: calculateAmplitude(ppgSignal),
        motionLevel: this.detectMotion(ppgSignal),
        environmentalFactors: this.assessEnvironmentalFactors()
      }
    });

    // Retornar valores calibrados
    return {
      systolic: this.lastValidPeakValue,
      diastolic: this.lastValidValleyValue
    };
  }

  /**
   * Calcula la calidad de la señal
   */
  private calculateSignalQuality(signal: number[]): number {
    const amplitude = calculateAmplitude(signal);
    const noiseLevel = this.calculateNoiseLevel(signal);
    return Math.max(0, Math.min(1, (amplitude / 2) * (1 - noiseLevel)));
  }

  /**
   * Calcula el nivel de ruido en la señal
   */
  private calculateNoiseLevel(signal: number[]): number {
    if (signal.length < 3) return 1;
    
    let noiseSum = 0;
    for (let i = 1; i < signal.length - 1; i++) {
      const diff = Math.abs(signal[i] - (signal[i-1] + signal[i+1]) / 2);
      noiseSum += diff;
    }
    
    return Math.min(1, noiseSum / (signal.length - 2) / calculateAmplitude(signal));
  }

  /**
   * Detecta nivel de movimiento
   */
  private detectMotion(signal: number[]): number {
    if (signal.length < 4) return 0;
    
    let motionSum = 0;
    for (let i = 3; i < signal.length; i++) {
      const shortTermDiff = Math.abs(signal[i] - signal[i-1]);
      const longTermDiff = Math.abs(signal[i] - signal[i-3]);
      motionSum += Math.max(shortTermDiff, longTermDiff);
    }
    
    return Math.min(1, motionSum / (signal.length - 3) / calculateAmplitude(signal));
  }

  /**
   * Evalúa factores ambientales
   */
  private assessEnvironmentalFactors(): number {
    // Por ahora retornamos un valor óptimo
    // TODO: Implementar detección real de factores ambientales
    return 0.9;
  }

  /**
   * Reinicia el procesador a su estado inicial
   */
  public reset(): void {
    this.lastValidPeakValue = 0;
    this.lastValidValleyValue = 0;
    this.currentCalibrationParams = {
      gain: 1.0,
      offset: 0,
      threshold: 0.5,
      sensitivity: 1.0
    };
  }
}
