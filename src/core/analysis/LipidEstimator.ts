
import { ProcessorConfig } from '../config/ProcessorConfig';

// Interface para UserProfile
interface UserProfile {
  age: number;
  gender: string;
  height: number;
  weight: number;
}

// Interface para LipidResult
interface LipidResult {
  totalCholesterol: number;
  triglycerides: number;
  hdl?: number;
  ldl?: number;
}

/**
 * Estimador de lípidos a partir de características de la señal PPG
 */
export class LipidEstimator {
  private config: ProcessorConfig;
  private userProfile: UserProfile | null = null;
  private lastEstimation: LipidResult | null = null;
  private dataPoints: number[] = [];
  
  constructor(config: ProcessorConfig) {
    this.config = config;
  }
  
  /**
   * Añadir punto de datos para análisis
   */
  public addDataPoint(value: number): void {
    this.dataPoints.push(value);
    
    // Mantener un buffer razonable
    if (this.dataPoints.length > 1000) {
      this.dataPoints = this.dataPoints.slice(-1000);
    }
  }
  
  /**
   * Estimar niveles de lípidos
   */
  public estimateLipidLevels(ppgValues: number[], heartRate: number): LipidResult {
    // Si no hay suficientes datos, devolver estimación anterior o valores predeterminados
    if (!ppgValues || ppgValues.length < 20 || heartRate <= 0) {
      return this.lastEstimation || { totalCholesterol: 180, triglycerides: 150 };
    }
    
    // El factor de calibración (simulado)
    const lipidCalibrationFactor = 1.0;
    
    // Calcular características espectrales y temporales de la señal PPG
    const signalFeatures = this.extractSignalFeatures(ppgValues);
    
    // Perfil de usuario si está disponible
    const userFactor = this.userProfile ? 
      this.calculateUserFactor(this.userProfile) : 1.0;
    
    // Cálculos basados en características de la señal
    let totalCholesterol = 150 + (signalFeatures.risingTime * 50 * lipidCalibrationFactor * userFactor);
    let triglycerides = 100 + (signalFeatures.dicroticNotchHeight * 200 * lipidCalibrationFactor * userFactor);
    
    // Ajustes de acuerdo a valores normales
    totalCholesterol = Math.max(120, Math.min(300, Math.round(totalCholesterol)));
    triglycerides = Math.max(50, Math.min(400, Math.round(triglycerides)));
    
    // Resultado
    const result = {
      totalCholesterol,
      triglycerides
    };
    
    this.lastEstimation = result;
    return result;
  }
  
  /**
   * Extraer características de la señal
   */
  private extractSignalFeatures(values: number[]): {
    risingTime: number;
    dicroticNotchHeight: number;
    pulseWidth: number;
  } {
    // Identificar picos y valles para análisis
    const peaks = this.findPeaks(values);
    const valleys = this.findValleys(values);
    
    if (peaks.length < 2 || valleys.length < 2) {
      return {
        risingTime: 0.2,
        dicroticNotchHeight: 0.15,
        pulseWidth: 0.4
      };
    }
    
    // Calcular tiempo de subida promedio (del valle al pico)
    let risingTimeSum = 0;
    let risingTimeCount = 0;
    
    for (let i = 0; i < valleys.length; i++) {
      for (let j = 0; j < peaks.length; j++) {
        if (peaks[j].index > valleys[i].index) {
          risingTimeSum += (peaks[j].index - valleys[i].index) / values.length;
          risingTimeCount++;
          break;
        }
      }
    }
    
    const risingTime = risingTimeCount > 0 ? risingTimeSum / risingTimeCount : 0.2;
    
    // Buscar muesca dicrótica (dicrotic notch) - característica importante para lípidos
    let dicroticNotchHeight = 0;
    
    for (let i = 0; i < peaks.length - 1; i++) {
      const startIdx = peaks[i].index;
      const endIdx = peaks[i+1].index;
      
      if (endIdx - startIdx > 5) {
        // Buscar mínimo local entre picos (posible muesca dicrótica)
        let minVal = values[startIdx];
        let minIdx = startIdx;
        
        for (let j = startIdx + 1; j < endIdx; j++) {
          if (values[j] < minVal) {
            minVal = values[j];
            minIdx = j;
          }
        }
        
        // Calcular altura relativa de la muesca
        if (minIdx > startIdx && minIdx < endIdx) {
          const peakToPeakHeight = Math.abs(peaks[i].value - peaks[i+1].value);
          const notchDepth = Math.abs(peaks[i].value - minVal);
          dicroticNotchHeight += notchDepth / (peakToPeakHeight > 0 ? peakToPeakHeight : 1);
        }
      }
    }
    
    dicroticNotchHeight = peaks.length > 1 ? dicroticNotchHeight / (peaks.length - 1) : 0.15;
    
    // Anchura de pulso promedio
    let pulseWidthSum = 0;
    
    for (let i = 0; i < valleys.length - 1; i++) {
      pulseWidthSum += (valleys[i+1].index - valleys[i].index) / values.length;
    }
    
    const pulseWidth = valleys.length > 1 ? pulseWidthSum / (valleys.length - 1) : 0.4;
    
    return {
      risingTime,
      dicroticNotchHeight,
      pulseWidth
    };
  }
  
  /**
   * Encontrar picos en la señal
   */
  private findPeaks(values: number[]): { index: number, value: number }[] {
    const peaks: { index: number, value: number }[] = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] && 
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        peaks.push({ index: i, value: values[i] });
      }
    }
    
    return peaks;
  }
  
  /**
   * Encontrar valles en la señal
   */
  private findValleys(values: number[]): { index: number, value: number }[] {
    const valleys: { index: number, value: number }[] = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] < values[i-1] && 
          values[i] < values[i-2] && 
          values[i] < values[i+1] && 
          values[i] < values[i+2]) {
        valleys.push({ index: i, value: values[i] });
      }
    }
    
    return valleys;
  }
  
  /**
   * Calcular factor de ajuste basado en perfil de usuario
   */
  private calculateUserFactor(profile: UserProfile): number {
    let factor = 1.0;
    
    // Ajustes por edad (aumenta con la edad)
    if (profile.age > 50) {
      factor *= 1.1;
    } else if (profile.age < 30) {
      factor *= 0.9;
    }
    
    // Ajustes por género
    if (profile.gender === 'male') {
      factor *= 1.05;
    }
    
    // Ajuste por índice de masa corporal (IMC)
    const heightInMeters = profile.height / 100;
    const bmi = profile.weight / (heightInMeters * heightInMeters);
    
    if (bmi > 30) {
      factor *= 1.2;
    } else if (bmi < 20) {
      factor *= 0.9;
    }
    
    return factor;
  }
  
  /**
   * Establecer perfil de usuario
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }
}
