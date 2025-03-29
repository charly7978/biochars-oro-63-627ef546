
import { ProcessorConfig } from '../config/ProcessorConfig';

// Define the missing interfaces
export interface UserProfile {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  height?: number;
  condition?: string;
}

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;
  confidence: number;
  formatted: string;
}

export class BloodPressureAnalyzer {
  private readonly MIN_DATA_POINTS = 60;
  private readonly CALIBRATION_FACTOR = 0.85;
  private readonly DEFAULT_SYSTOLIC = 120;
  private readonly DEFAULT_DIASTOLIC = 80;
  
  private dataPoints: number[] = [];
  private lastHeartRate: number = 0;
  private lastSystolic: number = 0;
  private lastDiastolic: number = 0;
  private confidenceScore: number = 0;
  
  constructor(private config: ProcessorConfig, private userProfile?: UserProfile) {
    this.reset();
  }
  
  public addDataPoint(value: number, heartRate: number = 0): void {
    if (value !== 0) {
      this.dataPoints.push(value);
      if (this.dataPoints.length > this.MIN_DATA_POINTS * 2) {
        this.dataPoints.shift();
      }
    }
    
    if (heartRate > 0) {
      this.lastHeartRate = heartRate;
    }
  }
  
  public estimateBloodPressure(): BloodPressureResult {
    if (this.dataPoints.length < this.MIN_DATA_POINTS) {
      return {
        systolic: 0,
        diastolic: 0,
        map: 0,
        confidence: 0,
        formatted: "--/--"
      };
    }
    
    try {
      // Calcular variabilidad de la señal
      const variance = this.calculateVariance(this.dataPoints);
      const amplitude = this.calculateAmplitude(this.dataPoints);
      
      // Using a fixed calibration factor since config.lipidCalibrationFactor doesn't exist
      const calibrationFactor = this.CALIBRATION_FACTOR;
      
      // Estimar presión sistólica basada en señal PPG y frecuencia cardíaca
      const systolicBase = this.DEFAULT_SYSTOLIC + (this.lastHeartRate - 70) * 0.7;
      const systolicVariance = variance * 30 * calibrationFactor;
      const systolicAmplitude = amplitude * 15 * calibrationFactor;
      
      const systolic = Math.round(systolicBase + systolicVariance + systolicAmplitude);
      
      // Estimar presión diastólica
      const diastolicBase = this.DEFAULT_DIASTOLIC + (this.lastHeartRate - 70) * 0.4;
      const diastolicVariance = variance * 20 * calibrationFactor;
      
      const diastolic = Math.round(diastolicBase + diastolicVariance);
      
      // Calcular presión arterial media (MAP)
      const map = Math.round(diastolic + (systolic - diastolic) / 3);
      
      // Calcular confianza basada en cantidad de datos
      const confidenceFactor = Math.min(1, this.dataPoints.length / (this.MIN_DATA_POINTS * 1.5));
      this.confidenceScore = confidenceFactor * 0.8;
      
      // Asegurar rangos fisiológicos
      const finalSystolic = Math.max(90, Math.min(180, systolic));
      const finalDiastolic = Math.max(50, Math.min(110, diastolic));
      
      // Suavizar cambios bruscos
      if (this.lastSystolic > 0) {
        this.lastSystolic = Math.round(this.lastSystolic * 0.7 + finalSystolic * 0.3);
        this.lastDiastolic = Math.round(this.lastDiastolic * 0.7 + finalDiastolic * 0.3);
      } else {
        this.lastSystolic = finalSystolic;
        this.lastDiastolic = finalDiastolic;
      }
      
      return {
        systolic: this.lastSystolic,
        diastolic: this.lastDiastolic,
        map,
        confidence: this.confidenceScore,
        formatted: `${this.lastSystolic}/${this.lastDiastolic}`
      };
    } catch (error) {
      console.error('Error estimando presión arterial:', error);
      return {
        systolic: 0,
        diastolic: 0,
        map: 0,
        confidence: 0,
        formatted: "--/--"
      };
    }
  }
  
  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length);
  }
  
  private calculateAmplitude(data: number[]): number {
    const max = Math.max(...data);
    const min = Math.min(...data);
    return max - min;
  }
  
  public reset(): void {
    this.dataPoints = [];
    this.lastHeartRate = 0;
    this.lastSystolic = 0;
    this.lastDiastolic = 0;
    this.confidenceScore = 0;
  }
  
  public getConfidence(): number {
    return this.confidenceScore;
  }
}
