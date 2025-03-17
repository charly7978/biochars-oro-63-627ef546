
/**
 * Lipid processor for estimating lipid levels from PPG signal
 */
export class LipidProcessor {
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private readonly LIPID_BUFFER_SIZE = 8;
  private confidence: number = 0;

  /**
   * Calculate lipid levels from PPG signal
   */
  public calculateLipids(values: number[]): {
    totalCholesterol: number;
    triglycerides: number;
  } {
    if (values.length < 60) {
      this.confidence = 0;
      return { totalCholesterol: 0, triglycerides: 0 };
    }

    // Calculate signal metrics
    const signalMean = values.reduce((a, b) => a + b, 0) / values.length;
    const signalVariance = values.reduce((acc, val) => acc + Math.pow(val - signalMean, 2), 0) / values.length;
    const signalMax = Math.max(...values);
    const signalMin = Math.min(...values);
    const signalRange = signalMax - signalMin;
    
    // Calculate spectral features from the signal
    const spectralEnergy = this.calculateSpectralEnergy(values);
    
    // Apply a simple model for cholesterol estimation
    const baseCholesterol = 160; // baseline value in mg/dL
    const cholesterolVariation = (signalVariance / Math.pow(signalRange, 2)) * 80;
    const cholesterolEstimate = baseCholesterol + cholesterolVariation + (spectralEnergy * 10);
    
    // Apply a simple model for triglycerides estimation
    const baseTriglycerides = 120; // baseline value in mg/dL
    const triglyceridesVariation = (signalVariance / Math.pow(signalRange, 2)) * 60;
    const triglyceridesEstimate = baseTriglycerides + triglyceridesVariation + (spectralEnergy * 15);
    
    // Apply physiological constraints
    const constrainedCholesterol = Math.max(140, Math.min(300, cholesterolEstimate));
    const constrainedTriglycerides = Math.max(70, Math.min(400, triglyceridesEstimate));
    
    // Update confidence based on signal quality
    this.confidence = Math.min(0.7, Math.max(0.1, signalRange / 5));
    
    // Add to buffer for smoothing
    this.cholesterolBuffer.push(constrainedCholesterol);
    this.triglyceridesBuffer.push(constrainedTriglycerides);
    
    if (this.cholesterolBuffer.length > this.LIPID_BUFFER_SIZE) {
      this.cholesterolBuffer.shift();
      this.triglyceridesBuffer.shift();
    }
    
    // Calculate smoothed values
    const smoothedCholesterol = this.cholesterolBuffer.reduce((a, b) => a + b, 0) / this.cholesterolBuffer.length;
    const smoothedTriglycerides = this.triglyceridesBuffer.reduce((a, b) => a + b, 0) / this.triglyceridesBuffer.length;
    
    return {
      totalCholesterol: Math.round(smoothedCholesterol),
      triglycerides: Math.round(smoothedTriglycerides)
    };
  }

  /**
   * Calculate spectral energy from PPG signal
   */
  private calculateSpectralEnergy(values: number[]): number {
    // Simple approximation of spectral energy
    let energy = 0;
    for (let i = 1; i < values.length; i++) {
      energy += Math.pow(values[i] - values[i-1], 2);
    }
    return Math.min(1, energy / values.length / 10);
  }

  /**
   * Get confidence level of lipid estimate
   */
  public getConfidence(): number {
    return this.confidence;
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    this.confidence = 0;
  }
}
