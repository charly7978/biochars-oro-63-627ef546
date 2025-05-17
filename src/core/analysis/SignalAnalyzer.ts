
import { UserProfile } from '../types';
import { AnalysisSettings } from '../config/AnalysisSettings';

/**
 * Base class for all signal analyzers
 * Provides common functionality for derivation of vital signs from PPG signal
 */
export class SignalAnalyzer {
  protected userProfile: UserProfile;
  protected settings: AnalysisSettings | undefined;
  protected calibrationFactor: number = 1.0;
  
  constructor(userProfile?: UserProfile, settings?: AnalysisSettings) {
    // Default user profile if none provided
    this.userProfile = userProfile || {
      id: 'default',
      age: 30,
      gender: 'other',
      height: 170,
      weight: 70
    };
    
    this.settings = settings;
  }
  
  /**
   * Set calibration factor for this analyzer
   */
  public setCalibrationFactor(factor: number): void {
    this.calibrationFactor = factor;
  }
  
  /**
   * Get current calibration factor
   */
  public getCalibrationFactor(): number {
    return this.calibrationFactor;
  }
  
  /**
   * Set user profile for personalized analysis
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
  }
  
  /**
   * Update settings
   */
  public updateSettings(settings: Partial<AnalysisSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
  }
  
  /**
   * Reset the analyzer to its initial state
   */
  public reset(): void {
    // To be implemented by derived classes
  }
}
