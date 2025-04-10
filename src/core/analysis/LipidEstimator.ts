
import { ProcessorConfig } from '../config/ProcessorConfig';

// Define missing interfaces
export interface UserProfile {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  height?: number;
  condition?: string;
}

export interface LipidResult {
  totalCholesterol: number;
  triglycerides: number;
  ldl?: number;
  hdl?: number;
  confidence: number;
}

export class LipidEstimator {
  private dataPoints: number[] = [];
  private readonly MIN_DATA_POINTS = 120;
  private readonly DEFAULT_TOTAL_CHOLESTEROL = 185;
  private readonly DEFAULT_TRIGLYCERIDES = 150;
  private readonly BASE_CONFIDENCE = 0.6;
  private readonly CALIBRATION_FACTOR = 1.0;  // Fixed value since config.lipidCalibrationFactor doesn't exist
  
  constructor(private config: ProcessorConfig, private userProfile?: UserProfile) {}
  
  public addDataPoint(value: number): void {
    if (value !== 0) {
      this.dataPoints.push(value);
      
      if (this.dataPoints.length > this.MIN_DATA_POINTS * 2) {
        this.dataPoints.shift();
      }
    }
  }
  
  public estimateLipids(): LipidResult {
    if (this.dataPoints.length < this.MIN_DATA_POINTS) {
      return {
        totalCholesterol: 0,
        triglycerides: 0,
        ldl: 0,
        hdl: 0,
        confidence: 0
      };
    }
    
    try {
      // Calcular características de la señal
      const variance = this.calculateVariance(this.dataPoints);
      const frequencyFeatures = this.calculateFrequencyFeatures(this.dataPoints);
      
      // Aplicar factores de calibración
      const cholesterolCalibration = this.CALIBRATION_FACTOR;
      const triglycerideCalibration = this.CALIBRATION_FACTOR;
      
      // Estimar colesterol total basado en características de la señal
      const totalCholesterolRaw = this.DEFAULT_TOTAL_CHOLESTEROL +
        (variance * 15 * cholesterolCalibration) +
        (frequencyFeatures.highRatio * 30 * cholesterolCalibration);
      
      // Estimar triglicéridos
      const triglyceridesRaw = this.DEFAULT_TRIGLYCERIDES +
        (variance * 25 * triglycerideCalibration) +
        (frequencyFeatures.lowRatio * 40 * triglycerideCalibration);
      
      // Límites fisiológicos
      const totalCholesterol = Math.max(140, Math.min(300, Math.round(totalCholesterolRaw)));
      const triglycerides = Math.max(70, Math.min(400, Math.round(triglyceridesRaw)));
      
      // Calcular HDL y LDL
      const hdl = Math.round(Math.max(25, Math.min(80, 50 - (variance * 5))));
      const ldl = Math.round(totalCholesterol - hdl - (triglycerides / 5));
      
      // Calcular confianza
      const confidenceFactor = Math.min(1, this.dataPoints.length / (this.MIN_DATA_POINTS * 1.5));
      const confidence = this.BASE_CONFIDENCE * confidenceFactor;
      
      return {
        totalCholesterol,
        triglycerides,
        ldl,
        hdl,
        confidence
      };
    } catch (error) {
      console.error('Error estimando lípidos:', error);
      return {
        totalCholesterol: 0,
        triglycerides: 0,
        ldl: 0,
        hdl: 0,
        confidence: 0
      };
    }
  }
  
  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length);
  }
  
  private calculateFrequencyFeatures(data: number[]): { lowRatio: number, highRatio: number } {
    // Simplificación: calcular proporción de amplitud en diferentes bandas de frecuencia
    const segment1 = data.slice(0, Math.floor(data.length / 3));
    const segment2 = data.slice(Math.floor(data.length / 3), Math.floor(2 * data.length / 3));
    const segment3 = data.slice(Math.floor(2 * data.length / 3));
    
    const amp1 = Math.max(...segment1) - Math.min(...segment1);
    const amp2 = Math.max(...segment2) - Math.min(...segment2);
    const amp3 = Math.max(...segment3) - Math.min(...segment3);
    
    const totalAmp = amp1 + amp2 + amp3;
    
    if (totalAmp === 0) return { lowRatio: 0, highRatio: 0 };
    
    return {
      lowRatio: amp1 / totalAmp,
      highRatio: amp3 / totalAmp
    };
  }
  
  public reset(): void {
    this.dataPoints = [];
  }
}
