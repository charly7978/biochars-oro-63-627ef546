
import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';
import { SignalAnalyzer } from './SignalAnalyzer';

/**
 * Analyzer for blood pressure estimation from PPG signal
 */
export class BloodPressureAnalyzer extends SignalAnalyzer {
  private systolicEstimate: number = 120;
  private diastolicEstimate: number = 80;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    super(userProfile, settings);
  }
  
  /**
   * Analyze blood pressure from PPG signal
   */
  public analyze(ppgValues: number[]): { systolic: number; diastolic: number } {
    if (ppgValues.length < 30) {
      return { systolic: this.systolicEstimate, diastolic: this.diastolicEstimate };
    }
    
    // Simple PPG-based calculation for demonstration
    const recentValues = ppgValues.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Apply calibration factor if available
    const bpCalibrationFactor = this.settings?.bpCalibrationFactor || 1.0;
    
    // Adjust estimates based on signal characteristics and user profile
    let systolicAdjustment = 0;
    let diastolicAdjustment = 0;
    
    // Age-based adjustment
    if (this.userProfile?.age > 50) {
      systolicAdjustment += 5;
      diastolicAdjustment += 2;
    }
    
    // Amplitude-based adjustment
    if (amplitude > 0.2) {
      systolicAdjustment -= 3;
      diastolicAdjustment -= 2;
    } else if (amplitude < 0.1) {
      systolicAdjustment += 3;
      diastolicAdjustment += 2;
    }
    
    // Calculate final estimates with calibration
    const systolic = Math.round((120 + systolicAdjustment) * bpCalibrationFactor);
    const diastolic = Math.round((80 + diastolicAdjustment) * bpCalibrationFactor);
    
    // Update stored estimates for future reference
    this.systolicEstimate = systolic;
    this.diastolicEstimate = diastolic;
    
    return { systolic, diastolic };
  }
  
  /**
   * Legacy method for compatibility
   */
  public calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    return this.analyze(ppgValues);
  }
  
  /**
   * Reset the analyzer to initial values
   */
  public reset(): void {
    super.reset();
    this.systolicEstimate = 120;
    this.diastolicEstimate = 80;
  }
}
