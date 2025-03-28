/**
 * Lipid Processor
 * Simulates lipid profile estimation
 */
export class LipidProcessor {
  private readonly CHOLESTEROL_BASELINE = 170;
  private readonly TRIGLYCERIDES_BASELINE = 120;
  private readonly MAX_ADJUSTMENT = 50;
  private lastCholesterolEstimates: number[] = [];
  private lastTriglyceridesEstimates: number[] = [];
  private readonly BUFFER_SIZE = 5;

  /**
   * Estimate lipid profile from vital signs
   * Note: This is a simulation - real lipid profile cannot be accurately measured from PPG alone
   */
  public estimateLipids(spo2: number, heartRate: number, ppgValues: number[]): {
    totalCholesterol: number;
    triglycerides: number;
  } {
    // If we don't have valid inputs, return baseline values
    if (spo2 === 0 || heartRate === 0 || ppgValues.length < 30) {
      return {
        totalCholesterol: this.CHOLESTEROL_BASELINE,
        triglycerides: this.TRIGLYCERIDES_BASELINE
      };
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
    
    // Simulate lipid profile variations based on input parameters
    
    // Higher heart rate might correlate with metabolic activity
    const hrFactor = Math.max(-15, Math.min(15, (heartRate - 70) * 0.5));
    
    // Lower SpO2 can indicate metabolic issues
    const spo2Factor = Math.max(-10, Math.min(10, (98 - spo2) * 1.5));
    
    // Signal features can indicate vascular health
    const varFactor = Math.max(-10, Math.min(10, (stdDev - 0.1) * 80));
    const ampFactor = Math.max(-10, Math.min(10, (amplitude - 0.5) * 40));
    
    // Calculate raw estimates
    const rawCholesterol = this.CHOLESTEROL_BASELINE + hrFactor + spo2Factor + varFactor;
    const rawTriglycerides = this.TRIGLYCERIDES_BASELINE + hrFactor + spo2Factor + ampFactor;
    
    // Add randomness to simulate natural variations
    const cholNoise = Math.random() * 10 - 5; // -5 to +5
    const trigNoise = Math.random() * 8 - 4;  // -4 to +4
    
    // Apply constraints to keep values in realistic ranges
    const cholEstimate = Math.max(140, Math.min(240, rawCholesterol + cholNoise));
    const trigEstimate = Math.max(80, Math.min(200, rawTriglycerides + trigNoise));
    
    // Smooth with previous estimates
    this.lastCholesterolEstimates.push(cholEstimate);
    this.lastTriglyceridesEstimates.push(trigEstimate);
    
    if (this.lastCholesterolEstimates.length > this.BUFFER_SIZE) {
      this.lastCholesterolEstimates.shift();
      this.lastTriglyceridesEstimates.shift();
    }
    
    // Average the recent estimates
    const smoothedCholesterol = 
      this.lastCholesterolEstimates.reduce((a, b) => a + b, 0) / 
      this.lastCholesterolEstimates.length;
    
    const smoothedTriglycerides = 
      this.lastTriglyceridesEstimates.reduce((a, b) => a + b, 0) / 
      this.lastTriglyceridesEstimates.length;
    
    return {
      totalCholesterol: Math.round(smoothedCholesterol),
      triglycerides: Math.round(smoothedTriglycerides)
    };
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.lastCholesterolEstimates = [];
    this.lastTriglyceridesEstimates = [];
  }
}
