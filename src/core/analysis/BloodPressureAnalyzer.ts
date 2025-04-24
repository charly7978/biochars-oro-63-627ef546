
import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';
import { SignalAnalyzer } from './SignalAnalyzer';
import { TensorUtils } from '../neural/tensorflow/TensorAdapter';

/**
 * Analizador optimizado para presión arterial a partir de señal PPG
 */
export class BloodPressureAnalyzer extends SignalAnalyzer {
  private systolicEstimate: number = 120;
  private diastolicEstimate: number = 80;
  private windowSize = 30;
  private signalBuffer: number[] = [];
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
  }
  
  /**
   * Analiza la presión arterial a partir de señal PPG
   */
  public analyze(ppgValues: number[]): { systolic: number; diastolic: number } {
    // Actualizar buffer de señal
    this.updateBuffer(ppgValues);
    
    if (this.signalBuffer.length < this.windowSize) {
      return { systolic: this.systolicEstimate, diastolic: this.diastolicEstimate };
    }
    
    // Usar valores más recientes
    const recentValues = this.signalBuffer.slice(-this.windowSize);
    
    // Procesar la señal para obtener métricas clave
    const { mean, min, max, std } = TensorUtils.getArrayStats(recentValues);
    const amplitude = max - min;
    
    // Factor de calibración si disponible
    const bpCalibrationFactor = this.settings?.bpCalibrationFactor || 1.0;
    
    // Ajustar estimaciones basado en características de señal y perfil de usuario
    let systolicAdjustment = 0;
    let diastolicAdjustment = 0;
    
    // Ajuste basado en edad
    if (this.userProfile?.age > 50) {
      systolicAdjustment += 5;
      diastolicAdjustment += 2;
    }
    
    // Ajuste basado en amplitud
    if (amplitude > 0.2) {
      systolicAdjustment -= 3;
      diastolicAdjustment -= 2;
    } else if (amplitude < 0.1) {
      systolicAdjustment += 3;
      diastolicAdjustment += 2;
    }
    
    // Ajuste por desviación estándar (variabilidad)
    if (std > 0.15) {
      systolicAdjustment += 2;
    }
    
    // Calcular estimaciones finales con calibración
    const systolic = Math.round((120 + systolicAdjustment) * bpCalibrationFactor);
    const diastolic = Math.round((80 + diastolicAdjustment) * bpCalibrationFactor);
    
    // Actualizar estimaciones almacenadas para referencia futura
    this.systolicEstimate = systolic;
    this.diastolicEstimate = diastolic;
    
    return { systolic, diastolic };
  }
  
  /**
   * Actualiza el buffer de señal de forma eficiente
   */
  private updateBuffer(newValues: number[]): void {
    this.signalBuffer = [...this.signalBuffer, ...newValues].slice(-this.windowSize * 2);
  }
  
  /**
   * Método de compatibilidad
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reinicia el analizador a valores iniciales
   */
  public reset(): void {
    super.reset();
    this.systolicEstimate = 120;
    this.diastolicEstimate = 80;
    this.signalBuffer = [];
  }
}
