
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export class HemoglobinEstimator {
  private calibrationFactor: number;
  private confidenceThreshold: number;
  private lastEstimate: number = 0;
  private lastConfidence: number = 0;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    const fullConfig = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = fullConfig.nonInvasiveSettings.hemoglobinCalibrationFactor;
    this.confidenceThreshold = fullConfig.nonInvasiveSettings.confidenceThreshold;
  }
  
  public estimate(values: number[]): number {
    if (values.length < 40) return 0;
    
    // Implementación provisional simplificada
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const normalizedValue = Math.min(1, Math.max(0, average / 180));
    
    // Rango normal de hemoglobina: 12-16 g/dL
    const baseHemoglobin = 13;
    const estimate = baseHemoglobin + ((normalizedValue - 0.5) * 3);
    
    this.lastEstimate = parseFloat((estimate * this.calibrationFactor).toFixed(1));
    this.lastConfidence = 0.72; // Confianza fija para este ejemplo
    
    return this.lastEstimate;
  }
  
  public getConfidence(): number {
    return this.lastConfidence;
  }
  
  public meetsConfidenceThreshold(): boolean {
    return this.lastConfidence >= this.confidenceThreshold;
  }
  
  public reset(): void {
    this.lastEstimate = 0;
    this.lastConfidence = 0;
  }
}
