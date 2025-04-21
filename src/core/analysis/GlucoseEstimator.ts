import { UserProfile } from '../types';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';
import { SignalAnalyzer } from './SignalAnalyzer';

/**
 * Estimator for blood glucose from PPG signal characteristics
 */
export class GlucoseEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastEstimate: number = 95;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Estimate glucose level from PPG values
   * Returns null if not enough data is available.
   */
  public analyze(ppgValues: number[]): number | null {
    if (ppgValues.length < 30) {
      // Not enough data to provide a reliable estimate
      return null;
    }
    
    // Calculate metrics from real PPG data
    const recentValues = ppgValues.slice(-30);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Apply calibration factor from settings
    const calibrationFactor = this.config.analysisSettings.glucoseCalibrationFactor || 1.0;
    
    // Base estimate (healthy range)
    let glucoseEstimate = 95;
    
    // Adjust based on PPG characteristics
    if (amplitude > 0.2) {
      glucoseEstimate -= 5;
    } else if (amplitude < 0.1) {
      glucoseEstimate += 5;
    }
    
    // Adjust based on mean value
    if (mean > 0.6) {
      glucoseEstimate += 3;
    } else if (mean < 0.4) {
      glucoseEstimate -= 3;
    }
    
    // Apply calibration
    glucoseEstimate = Math.round(glucoseEstimate * calibrationFactor);
    
    // Ensure physiological range
    glucoseEstimate = Math.max(70, Math.min(180, glucoseEstimate));
    
    // Update last estimate
    this.lastEstimate = glucoseEstimate;
    
    return glucoseEstimate;
  }
  
  /**
   * Legacy method for compatibility
   */
  public estimate(ppgValues: number[]): number | null {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reset the estimator
   */
  public reset(): void {
    super.reset();
    this.lastEstimate = 95;
  }
}
