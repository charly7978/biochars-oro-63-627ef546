
import { UserProfile } from '../types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { SignalAnalyzer } from './SignalAnalyzer';

/**
 * Estimator for hemoglobin levels from PPG signal
 */
export class HemoglobinEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastEstimate: number = 14;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Analyze hemoglobin level from PPG values
   */
  public analyze(ppgValues: number[]): number {
    if (ppgValues.length < 30) {
      return this.lastEstimate;
    }
    
    // Calculate metrics from PPG
    const recentValues = ppgValues.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Get calibration factor from settings
    const calibrationFactor = this.config.analysisSettings.hemoglobinCalibrationFactor || 1.0;
    
    // Base estimate (healthy range)
    let hemoglobinEstimate = 14.0;
    
    // Gender-based adjustment if available
    if (this.userProfile?.gender === 'female') {
      hemoglobinEstimate = 12.5;
    }
    
    // Adjust based on PPG characteristics
    if (amplitude > 0.25) {
      hemoglobinEstimate += 0.5;
    } else if (amplitude < 0.1) {
      hemoglobinEstimate -= 0.5;
    }
    
    // Apply calibration and convert to integer
    hemoglobinEstimate = Math.round(hemoglobinEstimate * calibrationFactor);
    
    // Ensure physiological range
    hemoglobinEstimate = Math.max(8, Math.min(18, hemoglobinEstimate));
    
    // Update last estimate
    this.lastEstimate = hemoglobinEstimate;
    
    return hemoglobinEstimate;
  }
  
  /**
   * Legacy method for compatibility
   */
  public estimate(ppgValues: number[]): number {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reset the estimator
   */
  public reset(): void {
    super.reset();
    this.lastEstimate = 14;
  }
}
