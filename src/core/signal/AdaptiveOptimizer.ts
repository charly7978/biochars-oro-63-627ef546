
/**
 * Enhanced Adaptive Optimizer
 * Dynamically adjusts processing parameters based on signal quality feedback
 */

export interface AdaptiveOptimizerConfig {
  learningRate: number;
  adaptationWindow: number;
  thresholds: {
    signalQuality: number;
    signalAmplitude: number;
    signalStability: number;
    [key: string]: number;
  };
}

export interface OptimizationParameters {
  signalQuality: number;
  signalAmplitude: number;
  signalStability: number;
  [key: string]: number;
}

export class AdaptiveOptimizer {
  private config: AdaptiveOptimizerConfig;
  private history: OptimizationParameters[] = [];
  private optimizedParameters: {[key: string]: number} = {};
  private optimizedWeights: {[key: string]: number} = {};
  
  constructor(config: AdaptiveOptimizerConfig) {
    this.config = config;
    
    // Initialize optimized parameters
    this.optimizedParameters = {
      filterStrength: 0.5,
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.5,
      detectionThreshold: 0.25,
      weightDecay: 0.01
    };
    
    // Initialize optimized weights for quality assessment
    this.optimizedWeights = {
      signalQuality: 0.4,
      signalAmplitude: 0.3,
      signalStability: 0.3
    };
  }
  
  /**
   * Update optimization parameters with new signal metrics
   */
  public updateParameters(params: OptimizationParameters): void {
    // Store parameters in history
    this.history.push({...params});
    
    // Limit history size
    if (this.history.length > this.config.adaptationWindow) {
      this.history.shift();
    }
    
    // Skip optimization if not enough data
    if (this.history.length < 5) return;
    
    // Calculate average values over the adaptation window
    const avgParams: {[key: string]: number} = {};
    
    Object.keys(params).forEach(key => {
      avgParams[key] = this.history.reduce((sum, p) => sum + (p[key] || 0), 0) / this.history.length;
    });
    
    // Adapt parameters based on signal quality
    this.adaptFilterStrength(avgParams.signalQuality, avgParams.signalStability);
    this.adaptAmplificationFactor(avgParams.signalAmplitude);
    this.adaptNoiseReductionLevel(avgParams.signalQuality);
    this.adaptDetectionThreshold(avgParams.signalQuality, avgParams.signalStability);
    
    // Adapt weights for quality assessment
    this.adaptQualityWeights(avgParams);
  }
  
  /**
   * Adapt filter strength based on signal quality and stability
   */
  private adaptFilterStrength(signalQuality: number, signalStability: number): void {
    const qualityFactor = Math.max(0, 1 - signalQuality);
    const stabilityFactor = Math.max(0, 1 - signalStability);
    
    // Higher filter strength for lower quality and stability
    let newFilterStrength = 0.3 + (0.5 * (qualityFactor + stabilityFactor) / 2);
    
    // Apply learning rate
    newFilterStrength = this.applyLearningRate(this.optimizedParameters.filterStrength, newFilterStrength);
    
    // Update parameter
    this.optimizedParameters.filterStrength = Math.min(0.9, Math.max(0.1, newFilterStrength));
  }
  
  /**
   * Adapt amplification factor based on signal amplitude
   */
  private adaptAmplificationFactor(signalAmplitude: number): void {
    // Lower amplitude signals need more amplification
    const amplitudeFactor = Math.max(0, 1 - signalAmplitude);
    let newAmplificationFactor = 1.0 + amplitudeFactor;
    
    // Apply learning rate
    newAmplificationFactor = this.applyLearningRate(
      this.optimizedParameters.amplificationFactor, 
      newAmplificationFactor
    );
    
    // Update parameter
    this.optimizedParameters.amplificationFactor = Math.min(2.5, Math.max(0.8, newAmplificationFactor));
  }
  
  /**
   * Adapt noise reduction level based on signal quality
   */
  private adaptNoiseReductionLevel(signalQuality: number): void {
    // Higher noise reduction for lower quality signals
    const qualityFactor = Math.max(0, 1 - signalQuality);
    let newNoiseReductionLevel = 0.3 + (0.6 * qualityFactor);
    
    // Apply learning rate
    newNoiseReductionLevel = this.applyLearningRate(
      this.optimizedParameters.noiseReductionLevel, 
      newNoiseReductionLevel
    );
    
    // Update parameter
    this.optimizedParameters.noiseReductionLevel = Math.min(0.9, Math.max(0.1, newNoiseReductionLevel));
  }
  
  /**
   * Adapt detection threshold based on signal quality and stability
   */
  private adaptDetectionThreshold(signalQuality: number, signalStability: number): void {
    const qualityFactor = Math.max(0, 1 - signalQuality);
    const stabilityFactor = Math.max(0, 1 - signalStability);
    
    // Higher threshold for lower quality and stability
    let newDetectionThreshold = 0.2 + (0.3 * (qualityFactor + stabilityFactor) / 2);
    
    // Apply learning rate
    newDetectionThreshold = this.applyLearningRate(
      this.optimizedParameters.detectionThreshold, 
      newDetectionThreshold
    );
    
    // Update parameter
    this.optimizedParameters.detectionThreshold = Math.min(0.5, Math.max(0.1, newDetectionThreshold));
  }
  
  /**
   * Adapt weights for quality assessment
   */
  private adaptQualityWeights(avgParams: {[key: string]: number}): void {
    // Determine most reliable metrics based on their consistency
    const metrics = ['signalQuality', 'signalAmplitude', 'signalStability'];
    const variances: {[key: string]: number} = {};
    
    // Calculate variance for each metric
    metrics.forEach(metric => {
      const values = this.history.map(p => p[metric] || 0);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      variances[metric] = variance;
    });
    
    // Calculate total inverse variance (lower variance = higher weight)
    const totalInverseVariance = metrics.reduce((sum, metric) => {
      return sum + (1 / (variances[metric] + 0.01)); // Add small constant to avoid division by zero
    }, 0);
    
    // Update weights based on inverse variance (more stable metrics get higher weights)
    metrics.forEach(metric => {
      const inverseVariance = 1 / (variances[metric] + 0.01);
      const targetWeight = inverseVariance / totalInverseVariance;
      
      // Apply learning rate to weight update
      this.optimizedWeights[metric] = this.applyLearningRate(
        this.optimizedWeights[metric],
        targetWeight
      );
    });
    
    // Normalize weights to sum to 1
    const sum = metrics.reduce((total, metric) => total + this.optimizedWeights[metric], 0);
    metrics.forEach(metric => {
      this.optimizedWeights[metric] /= sum;
    });
  }
  
  /**
   * Apply learning rate to parameter updates
   */
  private applyLearningRate(currentValue: number, targetValue: number): number {
    return currentValue + (this.config.learningRate * (targetValue - currentValue));
  }
  
  /**
   * Get optimized parameters
   */
  public getOptimizedParameters(): {[key: string]: number} {
    return {...this.optimizedParameters};
  }
  
  /**
   * Get optimized weights for quality assessment
   */
  public getOptimizedWeights(): {[key: string]: number} {
    return {...this.optimizedWeights};
  }
  
  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.history = [];
    
    // Reset optimized parameters to defaults
    this.optimizedParameters = {
      filterStrength: 0.5,
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.5,
      detectionThreshold: 0.25,
      weightDecay: 0.01
    };
    
    // Reset optimized weights to defaults
    this.optimizedWeights = {
      signalQuality: 0.4,
      signalAmplitude: 0.3,
      signalStability: 0.3
    };
  }
}
