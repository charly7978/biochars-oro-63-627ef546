
/**
 * Adapter for blood pressure analysis that ensures compatibility with existing code
 * while transitioning to a unified BloodPressureAnalyzer.
 */

import { VitalSignsConfig } from '../config/VitalSignsConfig';

interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  confidence: number;
}

export class BloodPressureAdapter {
  private readonly CONFIDENCE_THRESHOLD = VitalSignsConfig.bloodPressure.DATA.CONFIDENCE_THRESHOLD;
  private readonly MIN_DATA_POINTS = VitalSignsConfig.bloodPressure.DATA.MIN_DATA_POINTS;
  private readonly CALIBRATION_FACTOR = VitalSignsConfig.bloodPressure.CALCULATION.CALIBRATION_FACTOR;
  
  private validDataAccumulated: boolean = false;
  
  /**
   * Calculate blood pressure based on PPG signal characteristics
   * Compatible with the existing blood-pressure-processor API
   */
  public calculateBloodPressure(ppgValues: number[]): BloodPressureResult {
    if (ppgValues.length < this.MIN_DATA_POINTS) {
      return { systolic: 0, diastolic: 0, confidence: 0 };
    }
    
    // Set validation flag once we have enough data
    this.validDataAccumulated = true;
    
    // Extract signal features
    const features = this.extractFeatures(ppgValues);
    
    // Calculate blood pressure
    const systolic = this.calculateSystolic(features);
    const diastolic = this.calculateDiastolic(features, systolic);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(features, ppgValues);
    
    return { 
      systolic: systolic > 0 ? Math.round(systolic) : 0, 
      diastolic: diastolic > 0 ? Math.round(diastolic) : 0, 
      confidence 
    };
  }
  
  /**
   * Extract features from PPG signal for BP calculation
   */
  private extractFeatures(ppgValues: number[]) {
    const min = Math.min(...ppgValues);
    const max = Math.max(...ppgValues);
    const amplitude = max - min;
    
    // Calculate signal derivatives
    const derivatives: number[] = [];
    for (let i = 1; i < ppgValues.length; i++) {
      derivatives.push(ppgValues[i] - ppgValues[i - 1]);
    }
    
    // Find peaks in the signal
    const peaks: number[] = [];
    for (let i = 1; i < derivatives.length - 1; i++) {
      if (derivatives[i] > 0 && derivatives[i + 1] <= 0) {
        peaks.push(i + 1);
      }
    }
    
    // Calculate peak intervals
    const peakIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      peakIntervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Calculate average peak interval
    const avgInterval = peakIntervals.length > 0 
      ? peakIntervals.reduce((sum, val) => sum + val, 0) / peakIntervals.length 
      : 0;
    
    return {
      amplitude,
      avgInterval,
      peaks,
      peakIntervals,
      min,
      max
    };
  }
  
  /**
   * Calculate systolic BP from signal features
   */
  private calculateSystolic(features: ReturnType<typeof this.extractFeatures>): number {
    if (features.peaks.length < 2) return 0;
    
    // Base calculation on amplitude and interval
    const baseValue = 120;
    const amplitudeContribution = features.amplitude * 25 * this.CALIBRATION_FACTOR;
    const intervalContribution = features.avgInterval > 0 
      ? -0.5 * features.avgInterval 
      : 0;
    
    // Calculate and validate
    const systolic = baseValue + amplitudeContribution + intervalContribution;
    
    // Apply physiological limits
    return Math.max(
      VitalSignsConfig.bloodPressure.CALCULATION.MIN_SYSTOLIC,
      Math.min(systolic, VitalSignsConfig.bloodPressure.CALCULATION.MAX_SYSTOLIC)
    );
  }
  
  /**
   * Calculate diastolic BP from systolic and features
   */
  private calculateDiastolic(
    features: ReturnType<typeof this.extractFeatures>,
    systolic: number
  ): number {
    if (systolic <= 0) return 0;
    
    // Apply typical systolic-diastolic relationship
    const diastolic = systolic * 0.65 + 10;
    
    // Apply physiological limits
    return Math.max(
      VitalSignsConfig.bloodPressure.CALCULATION.MIN_DIASTOLIC,
      Math.min(diastolic, VitalSignsConfig.bloodPressure.CALCULATION.MAX_DIASTOLIC)
    );
  }
  
  /**
   * Calculate confidence level for BP estimation
   */
  private calculateConfidence(
    features: ReturnType<typeof this.extractFeatures>,
    ppgValues: number[]
  ): number {
    if (!this.validDataAccumulated || features.peaks.length < 3) {
      return 0.3;
    }
    
    // Base confidence on signal quality factors
    const amplitudeFactor = Math.min(1, features.amplitude / 0.5);
    
    // Peak consistency factor
    let peakConsistency = 1;
    if (features.peakIntervals.length >= 3) {
      const avgInterval = features.peakIntervals.reduce((sum, val) => sum + val, 0) / 
                          features.peakIntervals.length;
      
      const variability = features.peakIntervals.reduce(
        (sum, val) => sum + Math.pow(val - avgInterval, 2), 0
      ) / features.peakIntervals.length;
      
      peakConsistency = Math.max(0.2, Math.min(1, 1 - variability / (avgInterval * avgInterval)));
    }
    
    // Signal stability factor
    const signalValues = ppgValues.slice(-20);
    const mean = signalValues.reduce((sum, val) => sum + val, 0) / signalValues.length;
    const variance = signalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signalValues.length;
    const stabilityFactor = Math.max(0.2, Math.min(1, 1 - variance / (mean * mean) * 10));
    
    // Combined confidence
    const confidence = (amplitudeFactor * 0.4) + (peakConsistency * 0.4) + (stabilityFactor * 0.2);
    
    return Math.min(0.95, confidence);
  }
  
  /**
   * Reset the BP adapter
   */
  public reset(): void {
    this.validDataAccumulated = false;
  }
}
