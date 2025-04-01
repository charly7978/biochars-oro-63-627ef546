
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptive thresholding techniques for improved peak detection
 */

/**
 * Configuration for adaptive threshold calculation
 */
export interface AdaptiveThresholdConfig {
  baseMultiplier: number;         // Base multiplier for standard deviation
  minThreshold: number;           // Minimum threshold value
  maxThreshold: number;           // Maximum threshold value
  adaptationRate: number;         // Rate of adaptation to new signals (0-1)
  signalQualityInfluence: number; // How much signal quality affects threshold
}

/**
 * Default configuration for adaptive thresholding
 */
export const DEFAULT_THRESHOLD_CONFIG: AdaptiveThresholdConfig = {
  baseMultiplier: 1.2,            // Multiplier for standard deviation
  minThreshold: 0.05,             // Minimum threshold
  maxThreshold: 0.8,              // Maximum threshold
  adaptationRate: 0.15,           // Adaptation rate (slow adaptation)
  signalQualityInfluence: 0.3     // Moderate influence of signal quality
};

/**
 * Calculate an adaptive threshold based on signal statistics
 * and optional signal quality metrics
 */
export function getAdaptiveThreshold(
  values: number[], 
  currentThreshold: number = 0,
  signalQuality: number = 0.5,
  config: AdaptiveThresholdConfig = DEFAULT_THRESHOLD_CONFIG
): number {
  if (values.length < 5) {
    return Math.max(config.minThreshold, currentThreshold > 0 ? currentThreshold : config.minThreshold);
  }
  
  // Calculate mean and standard deviation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Adjust multiplier based on signal quality
  const qualityAdjustedMultiplier = 
    config.baseMultiplier * (1 - config.signalQualityInfluence + config.signalQualityInfluence * signalQuality);
  
  // Calculate new threshold
  const newThreshold = mean + stdDev * qualityAdjustedMultiplier;
  
  // If there's a current threshold, adapt gradually
  let adaptedThreshold = newThreshold;
  if (currentThreshold > 0) {
    adaptedThreshold = currentThreshold * (1 - config.adaptationRate) + newThreshold * config.adaptationRate;
  }
  
  // Clamp to configured min/max
  return Math.max(config.minThreshold, Math.min(config.maxThreshold, adaptedThreshold));
}

/**
 * A more advanced adaptive threshold calculator that continuously adapts
 * based on recent signal history and detected peaks
 */
export class AdaptiveThresholdCalculator {
  private recentValues: number[] = [];
  private recentPeakValues: number[] = [];
  private currentThreshold: number = 0;
  private readonly maxBufferSize = 30;
  private readonly maxPeakBufferSize = 10;
  private readonly config: AdaptiveThresholdConfig;
  private signalQuality: number = 0.5;
  
  constructor(config: Partial<AdaptiveThresholdConfig> = {}) {
    this.config = {
      ...DEFAULT_THRESHOLD_CONFIG,
      ...config
    };
  }
  
  /**
   * Update the threshold calculator with a new value
   */
  public update(value: number, isPeak: boolean = false, signalQuality: number = 0.5): void {
    // Update signal quality
    this.signalQuality = signalQuality;
    
    // Add to recent values
    this.recentValues.push(value);
    if (this.recentValues.length > this.maxBufferSize) {
      this.recentValues.shift();
    }
    
    // If this is a peak, add to peak values
    if (isPeak) {
      this.recentPeakValues.push(value);
      if (this.recentPeakValues.length > this.maxPeakBufferSize) {
        this.recentPeakValues.shift();
      }
    }
    
    // Recalculate threshold
    this.recalculateThreshold();
  }
  
  /**
   * Get the current adaptive threshold
   */
  public getThreshold(): number {
    return this.currentThreshold;
  }
  
  /**
   * Recalculate the threshold based on recent values and peaks
   */
  private recalculateThreshold(): void {
    if (this.recentValues.length < 5) {
      this.currentThreshold = this.config.minThreshold;
      return;
    }
    
    // Calculate statistics from recent values
    const mean = this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
    const variance = this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // If we have detected peaks, use them to adjust the threshold
    let peakAdjustedMultiplier = this.config.baseMultiplier;
    
    if (this.recentPeakValues.length >= 3) {
      // Calculate average peak value
      const avgPeakValue = this.recentPeakValues.reduce((sum, val) => sum + val, 0) / 
                          this.recentPeakValues.length;
      
      // If average peak is much higher than mean, reduce multiplier to make threshold more sensitive
      if (avgPeakValue > mean + stdDev * 2) {
        peakAdjustedMultiplier = Math.max(0.8, this.config.baseMultiplier * 0.9);
      } 
      // If average peak is close to mean, increase multiplier to avoid false positives
      else if (avgPeakValue < mean + stdDev) {
        peakAdjustedMultiplier = Math.min(1.8, this.config.baseMultiplier * 1.2);
      }
    }
    
    // Adjust multiplier based on signal quality
    const qualityAdjustedMultiplier = 
      peakAdjustedMultiplier * (1 - this.config.signalQualityInfluence + 
                               this.config.signalQualityInfluence * this.signalQuality);
    
    // Calculate new threshold
    const newThreshold = mean + stdDev * qualityAdjustedMultiplier;
    
    // Adapt gradually to new threshold
    if (this.currentThreshold > 0) {
      this.currentThreshold = this.currentThreshold * (1 - this.config.adaptationRate) + 
                             newThreshold * this.config.adaptationRate;
    } else {
      this.currentThreshold = newThreshold;
    }
    
    // Clamp to configured min/max
    this.currentThreshold = Math.max(
      this.config.minThreshold, 
      Math.min(this.config.maxThreshold, this.currentThreshold)
    );
  }
  
  /**
   * Reset the threshold calculator
   */
  public reset(): void {
    this.recentValues = [];
    this.recentPeakValues = [];
    this.currentThreshold = 0;
    this.signalQuality = 0.5;
  }
}
