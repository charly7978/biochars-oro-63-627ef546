import { UserProfile } from '../types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { SignalAnalyzer } from './SignalAnalyzer';

/**
 * Estimator for blood lipids from PPG signal characteristics
 */
export class LipidEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastTotal: number = 180;
  private lastTriglycerides: number = 150;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Analyze lipid levels from PPG signal
   */
  public analyze(ppgValues: number[]): { totalCholesterol: number; triglycerides: number } | null {
    if (ppgValues.length < 10) {
      // No hay datos suficientes para una estimación genuina
      return null;
    }
    
    // Calculate metrics from PPG
    const recentValues = ppgValues.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Get calibration factors
    const cholesterolCalibrationFactor = this.config.analysisSettings.cholesterolCalibrationFactor || 1.0;
    const triglycerideCalibrationFactor = this.config.analysisSettings.triglycerideCalibrationFactor || 1.0;
    
    // Base estimates (healthy ranges)
    let totalCholesterol = 180;
    let triglycerides = 150;
    
    // Adjust based on PPG characteristics
    if (amplitude < 0.1) {
      totalCholesterol += 10;
      triglycerides += 15;
    } else if (amplitude > 0.25) {
      totalCholesterol -= 5;
      triglycerides -= 10;
    }
    
    // Apply calibration factors
    totalCholesterol = Math.round(totalCholesterol * cholesterolCalibrationFactor);
    triglycerides = Math.round(triglycerides * triglycerideCalibrationFactor);
    
    // Ensure physiological ranges
    totalCholesterol = Math.max(120, Math.min(300, totalCholesterol));
    triglycerides = Math.max(50, Math.min(500, triglycerides));
    
    // Update last estimates
    this.lastTotal = totalCholesterol;
    this.lastTriglycerides = triglycerides;
    
    return { totalCholesterol, triglycerides };
  }
  
  /**
   * Legacy method for compatibility
   */
  public estimate(ppgValues: number[]): { totalCholesterol: number; triglycerides: number } | null {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reset the estimator
   */
  public reset(): void {
    super.reset();
    this.lastTotal = 180;
    this.lastTriglycerides = 150;
  }
}
