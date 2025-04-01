
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export interface LipidProfile {
  totalCholesterol: number;
  triglycerides: number;
}

export class LipidEstimator {
  private calibrationFactor: number;
  private confidenceThreshold: number;
  private lastEstimate: LipidProfile = { totalCholesterol: 0, triglycerides: 0 };
  private lastConfidence: number = 0;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = fullConfig.nonInvasiveSettings.lipidCalibrationFactor;
    this.confidenceThreshold = fullConfig.nonInvasiveSettings.confidenceThreshold;
  }
  
  public estimate(values: number[]): LipidProfile {
    if (values.length < 50) {
      return { totalCholesterol: 0, triglycerides: 0 };
    }
    
    // Implementación provisional simplificada
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const normalizedValue = Math.min(1, Math.max(0, average / 200));
    
    // Valores normales: colesterol total < 200, triglicéridos < 150
    const baseCholesterol = 150;
    const baseTriglycerides = 100;
    
    this.lastEstimate = {
      totalCholesterol: Math.round((baseCholesterol + (normalizedValue * 40)) * this.calibrationFactor),
      triglycerides: Math.round((baseTriglycerides + (normalizedValue * 30)) * this.calibrationFactor)
    };
    
    this.lastConfidence = 0.7; // Confianza fija para este ejemplo
    
    return this.lastEstimate;
  }
  
  public getConfidence(): number {
    return this.lastConfidence;
  }
  
  public meetsConfidenceThreshold(): boolean {
    return this.lastConfidence >= this.confidenceThreshold;
  }
  
  public reset(): void {
    this.lastEstimate = { totalCholesterol: 0, triglycerides: 0 };
    this.lastConfidence = 0;
  }
}
