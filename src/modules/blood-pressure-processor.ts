
/**
 * Processes PPG signals to estimate blood pressure
 */
export class BloodPressureProcessor {
  /**
   * Calculate estimated blood pressure from PPG values
   */
  calculateBloodPressure(ppgValues: number[]): { systolic: number; diastolic: number } {
    if (!ppgValues || ppgValues.length < 10) {
      return { systolic: 0, diastolic: 0 };
    }
    
    // Analyze PPG waveform for blood pressure estimation
    const recentValues = ppgValues.slice(-30);
    
    // Calculate min and max
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Estimate baseline systolic and diastolic based on signal characteristics
    // Normal ranges: systolic 90-140, diastolic 60-90
    const signalQuality = this.estimateSignalQuality(ppgValues);
    
    // Base values
    const baseSystolic = 110;
    const baseDiastolic = 70;
    
    // Calculate adjustments based on signal amplitude and other factors
    const systolicAdjustment = amplitude * 20 * signalQuality;
    const diastolicAdjustment = amplitude * 10 * signalQuality;
    
    // Apply adjustments
    const systolic = baseSystolic + systolicAdjustment;
    const diastolic = baseDiastolic + diastolicAdjustment;
    
    // Ensure results are in valid physiological range
    return {
      systolic: Math.min(140, Math.max(90, Math.round(systolic))),
      diastolic: Math.min(90, Math.max(60, Math.round(diastolic)))
    };
  }
  
  /**
   * Estimate signal quality from PPG values
   * @returns Quality score between 0-1
   */
  private estimateSignalQuality(ppgValues: number[]): number {
    const recentValues = ppgValues.slice(-15);
    
    // Calculate variance to determine signal consistency
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Lower variance = higher quality
    const normalizedVariance = Math.min(1, variance * 10);
    const quality = 1 - normalizedVariance;
    
    return Math.max(0.2, quality);
  }
}
