import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';

/**
 * Procesador de presión arterial que usa modelo neuronal para análisis directo
 */
export class BloodPressureProcessor {
  private lastValidPeakValue: number = 0;
  private lastValidValleyValue: number = 0;
  private neuralModel: BloodPressureNeuralModel;

  constructor() {
    this.neuralModel = new BloodPressureNeuralModel();
  }

  /**
   * Calcula la presión arterial usando el modelo neuronal y valores PPG reales
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
    
    // Extraer valores de presión del resultado del modelo
    this.lastValidPeakValue = prediction[0];  // Sistólica
    this.lastValidValleyValue = prediction[1]; // Diastólica

    // Retornar valores reales sin ningún tipo de ajuste o normalización
    return {
      systolic: this.lastValidPeakValue,
      diastolic: this.lastValidValleyValue
    };
  }

  /**
   * Reinicia el procesador a su estado inicial
   */
  public reset(): void {
    this.lastValidPeakValue = 0;
    this.lastValidValleyValue = 0;
  }
}
