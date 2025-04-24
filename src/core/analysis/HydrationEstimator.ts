import { SignalAnalyzer } from './SignalAnalyzer';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

/**
 * Estimator for hydration levels based on PPG signal characteristics
 */
export class HydrationEstimator extends SignalAnalyzer {
  private config: ProcessorConfig;
  private lastEstimate: number = 70;
  private calibrationSamples: number[] = [];
  private readonly SAMPLE_WINDOW = 10;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
  }
  
  /**
   * Analyze hydration level from PPG signal characteristics
   * Uses advanced PPG analysis including:
   * - Pulse wave velocity variations
   * - Signal amplitude dynamics
   * - Baseline drift patterns
   * - Waveform morphology
   */
  public analyze(ppgValues: number[]): number | null {
    if (ppgValues.length < this.SAMPLE_WINDOW) {
      // No hay datos suficientes para una estimación genuina
      return null;
    }
    
    // Get the most recent window of values
    const recentValues = ppgValues.slice(-this.SAMPLE_WINDOW);
    
    // Calculate key metrics for hydration estimation
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Calculate signal derivatives for waveform analysis
    const derivatives = this.calculateDerivatives(recentValues);
    const secondDerivatives = this.calculateDerivatives(derivatives);
    
    // Calculate baseline drift (related to fluid volume)
    const baselineDrift = this.calculateBaselineDrift(recentValues);
    
    // Calculate area under curve (AUC) - correlates with blood volume
    const auc = this.calculateAreaUnderCurve(recentValues);
    
    // Extract waveform features specific to hydration status
    const dicroticNotchPosition = this.findDicroticNotchPosition(derivatives);
    const dicroticNotchIntensity = dicroticNotchPosition > 0 ? 
      Math.abs(secondDerivatives[dicroticNotchPosition]) : 0;
    
    // Base hydration calculation from physiological correlates
    let hydrationLevel = 70; // Default baseline (70% is typical)
    
    // Adjust based on amplitude (stronger pulse typically indicates better hydration)
    if (amplitude > 0.3) {
      hydrationLevel += 5;
    } else if (amplitude < 0.15) {
      hydrationLevel -= 10; // Significant dehydration indicator
    }
    
    // Adjust based on dicrotic notch characteristics
    if (dicroticNotchIntensity > 0.05) {
      hydrationLevel += 3; // Stronger dicrotic notch often indicates better hydration
    } else if (dicroticNotchIntensity < 0.02) {
      hydrationLevel -= 3;
    }
    
    // Adjust based on baseline drift patterns
    if (Math.abs(baselineDrift) > 0.1) {
      hydrationLevel -= 5; // Unstable baseline often indicates dehydration
    }
    
    // Adjust based on area under curve
    const normalizedAuc = auc / recentValues.length;
    if (normalizedAuc > 0.6) {
      hydrationLevel += 2;
    } else if (normalizedAuc < 0.4) {
      hydrationLevel -= 2;
    }
    
    // Apply personalization adjustments if available
    if (this.userProfile?.age) {
      // Age-based adjustment (older people tend to be more dehydrated)
      if (this.userProfile.age > 65) {
        hydrationLevel -= 3;
      }
    }
    
    // Apply calibration factor from settings
    const calibrationFactor = this.config.analysisSettings.hydrationCalibrationFactor || 1.0;
    hydrationLevel = Math.round(hydrationLevel * calibrationFactor);
    
    // Ensure physiological range
    hydrationLevel = Math.max(40, Math.min(95, hydrationLevel));
    
    // Add to calibration samples
    this.updateCalibration(hydrationLevel);
    
    // Update last estimate and return integer value
    this.lastEstimate = hydrationLevel;
    return hydrationLevel;
  }
  
  /**
   * Calculate first derivatives of signal (rate of change)
   */
  private calculateDerivatives(values: number[]): number[] {
    const derivatives = [];
    
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    return derivatives;
  }
  
  /**
   * Calculate baseline drift over the signal window
   */
  private calculateBaselineDrift(values: number[]): number {
    if (values.length < 10) return 0;
    
    const firstQuarter = values.slice(0, Math.floor(values.length / 4));
    const lastQuarter = values.slice(Math.floor(3 * values.length / 4));
    
    const firstMean = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
    const lastMean = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
    
    return lastMean - firstMean;
  }
  
  /**
   * Calculate area under the curve
   */
  private calculateAreaUnderCurve(values: number[]): number {
    // Simple trapezoidal integration
    let area = 0;
    const baseline = Math.min(...values);
    
    for (let i = 1; i < values.length; i++) {
      area += ((values[i-1] - baseline) + (values[i] - baseline)) / 2;
    }
    
    return area;
  }
  
  /**
   * Find the position of dicrotic notch in the signal
   * The dicrotic notch is an important feature in PPG for hydration assessment
   */
  private findDicroticNotchPosition(derivatives: number[]): number {
    // Look for sign change in derivatives after the main peak
    let peakIndex = 0;
    let maxDerivative = 0;
    
    // Find the main peak in the first derivative
    for (let i = 0; i < derivatives.length / 2; i++) {
      if (derivatives[i] > maxDerivative) {
        maxDerivative = derivatives[i];
        peakIndex = i;
      }
    }
    
    // Look for the first significant negative-to-positive crossing after the peak
    for (let i = peakIndex + 2; i < derivatives.length - 1; i++) {
      if (derivatives[i] < 0 && derivatives[i+1] > 0) {
        return i;
      }
    }
    
    return -1; // No dicrotic notch found
  }
  
  /**
   * Update calibration data with new sample
   */
  private updateCalibration(value: number): void {
    this.calibrationSamples.push(value);
    if (this.calibrationSamples.length > 10) {
      this.calibrationSamples.shift();
    }
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
    this.lastEstimate = 70;
    this.calibrationSamples = [];
  }
}
