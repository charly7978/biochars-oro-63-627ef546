/**
 * Glucose Processor
 * Simulates blood glucose estimation
 */
export class GlucoseProcessor {
  private readonly GLUCOSE_BASELINE = 85;
  private readonly MAX_ADJUSTMENT = 30;
  private lastEstimates: number[] = [];
  private readonly BUFFER_SIZE = 5;

  /**
   * Estimate blood glucose from vital signs
   * Note: This is a simulation - real glucose cannot be accurately measured from PPG alone
   */
  public estimateGlucose(spo2: number, heartRate: number, ppgValues: number[]): number {
    // If we don't have valid inputs, return a normal baseline value
    if (spo2 === 0 || heartRate === 0 || ppgValues.length < 30) {
      return this.GLUCOSE_BASELINE;
    }

    // Calculate signal features
    const max = Math.max(...ppgValues);
    const min = Math.min(...ppgValues);
    const amplitude = max - min;
    const mean = ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length;
    
    // Calculate signal variation
    let squaredDiffs = 0;
    for (const val of ppgValues) {
      squaredDiffs += Math.pow(val - mean, 2);
    }
    const variance = squaredDiffs / ppgValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Simulate glucose variations based on input parameters
    // Higher heart rate tends to correlate with higher glucose
    const hrFactor = Math.max(-10, Math.min(10, (heartRate - 70) * 0.2));
    
    // Lower SpO2 often correlates with metabolic issues
    const spo2Factor = Math.max(-5, Math.min(5, (98 - spo2) * 0.5));
    
    // Signal variability can indicate metabolic activity
    const varFactor = Math.max(-5, Math.min(5, (stdDev - 0.1) * 40));
    
    // Calculate raw estimate
    const rawEstimate = this.GLUCOSE_BASELINE + hrFactor + spo2Factor + varFactor;
    
    // Add randomness to simulate natural variations
    const noise = Math.random() * 4 - 2; // -2 to +2
    
    // Apply constraints to keep values in realistic range
    const estimate = Math.max(70, Math.min(140, rawEstimate + noise));
    
    // Smooth with previous estimates
    this.lastEstimates.push(estimate);
    if (this.lastEstimates.length > this.BUFFER_SIZE) {
      this.lastEstimates.shift();
    }
    
    // Average the recent estimates
    const smoothedEstimate = this.lastEstimates.reduce((a, b) => a + b, 0) / this.lastEstimates.length;
    
    return Math.round(smoothedEstimate);
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.lastEstimates = [];
  }
}
