
import { ProcessorConfig } from '../config/ProcessorConfig';

// Interface para UserProfile
interface UserProfile {
  age: number;
  gender: string;
  height: number;
  weight: number;
}

// Interface para resultados
interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  formatted: string;
}

/**
 * Analizador de presión arterial a partir de PPG
 */
export class BloodPressureAnalyzer {
  private config: ProcessorConfig;
  private userProfile: UserProfile | null = null;
  private lastEstimation: BloodPressureResult | null = null;
  private calibrationFactor: number = 1.0;

  constructor(config: ProcessorConfig) {
    this.config = config;
  }

  /**
   * Estimar presión arterial basada en valores PPG y ritmo cardíaco
   */
  public estimateBloodPressure(ppgValues: number[], heartRate: number): BloodPressureResult {
    // Si no hay suficientes datos, devolver estimación anterior o valores predeterminados
    if (!ppgValues || ppgValues.length < 10 || heartRate <= 0) {
      return this.lastEstimation || { systolic: 120, diastolic: 80, formatted: "120/80" };
    }

    // Cálculos básicos a partir de PPG
    const peakValues = this.detectPeakValues(ppgValues);
    const valleyValues = this.detectValleyValues(ppgValues);
    
    if (peakValues.length < 2 || valleyValues.length < 2) {
      return this.lastEstimation || { systolic: 120, diastolic: 80, formatted: "120/80" };
    }

    // Perfil de usuario si está disponible
    const userFactor = this.userProfile ? 
      this.calculateUserFactor(this.userProfile) : 1.0;
    
    // Aplicar factor de calibración (simulación)
    const lipidCalibrationFactor = 1.0; // Valor predeterminado
    
    // Cálculo
    const avgPeak = peakValues.reduce((sum, val) => sum + val, 0) / peakValues.length;
    const avgValley = valleyValues.reduce((sum, val) => sum + val, 0) / valleyValues.length;
    const amplitude = avgPeak - avgValley;
    
    // Estimaciones basadas en fórmulas simplificadas
    let systolic = 90 + (amplitude * 30 * this.calibrationFactor * userFactor * lipidCalibrationFactor);
    let diastolic = 60 + (heartRate * 0.15 * this.calibrationFactor * userFactor * lipidCalibrationFactor);
    
    // Ajustes de acuerdo a valores normales
    systolic = Math.max(90, Math.min(180, Math.round(systolic)));
    diastolic = Math.max(60, Math.min(120, Math.round(diastolic)));
    
    // Asegurarse que sistólica > diastólica
    if (systolic <= diastolic) {
      diastolic = systolic - 10;
    }
    
    // Formatear resultado
    const result = {
      systolic,
      diastolic,
      formatted: `${systolic}/${diastolic}`
    };
    
    this.lastEstimation = result;
    return result;
  }

  /**
   * Detectar valores pico en la señal PPG
   */
  private detectPeakValues(values: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(values[i]);
      }
    }
    
    return peaks;
  }

  /**
   * Detectar valores valle en la señal PPG
   */
  private detectValleyValues(values: number[]): number[] {
    const valleys: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(values[i]);
      }
    }
    
    return valleys;
  }

  /**
   * Calcular factor de ajuste basado en perfil de usuario
   */
  private calculateUserFactor(profile: UserProfile): number {
    let factor = 1.0;
    
    // Ajustes por edad
    if (profile.age > 60) {
      factor *= 1.1;
    } else if (profile.age < 30) {
      factor *= 0.95;
    }
    
    // Ajustes por género
    if (profile.gender === 'female') {
      factor *= 0.97;
    }
    
    // Ajuste por índice de masa corporal (IMC)
    const heightInMeters = profile.height / 100;
    const bmi = profile.weight / (heightInMeters * heightInMeters);
    
    if (bmi > 30) {
      factor *= 1.15;
    } else if (bmi < 20) {
      factor *= 0.93;
    }
    
    return factor;
  }

  /**
   * Ajustar calibración con valor de referencia
   */
  public calibrate(referenceSystolic: number, referenceDiastolic: number): void {
    if (!this.lastEstimation) return;
    
    const systolicRatio = referenceSystolic / this.lastEstimation.systolic;
    const diastolicRatio = referenceDiastolic / this.lastEstimation.diastolic;
    
    // Promedio de los ratios
    const avgRatio = (systolicRatio + diastolicRatio) / 2;
    
    // Actualizar factor de calibración (con límites)
    this.calibrationFactor = Math.max(0.7, Math.min(1.3, this.calibrationFactor * avgRatio));
  }

  /**
   * Establecer perfil de usuario
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }
}
