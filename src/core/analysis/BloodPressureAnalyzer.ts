import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';
import { SignalAnalyzer } from './SignalAnalyzer';

/**
 * Analyzer for blood pressure estimation from PPG signal
 */
export class BloodPressureAnalyzer extends SignalAnalyzer {
  private systolicEstimate: number | null = null;
  private diastolicEstimate: number | null = null;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
  }
  
  /**
   * Analyze blood pressure from PPG signal
   * NOTA: La estimación de presión arterial desde PPG solo con cámara es inherentemente imprecisa.
   * Esta función devolverá valores nulos hasta que se integre un método validado.
   */
  public analyze(ppgValues: number[]): { systolic: number | null; diastolic: number | null } {
    // La lógica actual basada en amplitud es especulativa y no validada.
    // TODO: Integrar con BloodPressureNeuralModel o algoritmo validado (ej. PTT si ECG está disponible).
    console.warn("BloodPressureAnalyzer: La estimación actual de BP no es fiable.");
    
    // Devolver null para indicar que no hay medición fiable
    this.systolicEstimate = null;
    this.diastolicEstimate = null;
    return { systolic: null, diastolic: null };
  }
  
  /**
   * Legacy method for compatibility
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number | null; diastolic: number | null } {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reset the analyzer to initial values
   */
  public reset(): void {
    super.reset();
    this.systolicEstimate = null;
    this.diastolicEstimate = null;
  }
}
