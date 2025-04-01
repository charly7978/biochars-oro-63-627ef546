/**
 * Adaptive Predictor - Implements adaptive control and predictive modeling
 * for real-time signal processing with dynamic parameter adjustment
 */

// Configuration constants
const ADAPTATION_RATE_MIN = 0.01;
const ADAPTATION_RATE_MAX = 0.25;
const MODEL_ORDER = 4;
const PREDICTION_HORIZON = 3;
const OUTLIER_THRESHOLD = 2.5;

/**
 * Class implementing adaptive signal prediction and correction
 */
export class AdaptivePredictor {
  // AR model coefficients
  private coefficients: number[] = Array(MODEL_ORDER).fill(0);
  
  // Adaptation parameters
  private adaptationRate: number = 0.05;
  private signalHistory: number[] = [];
  private errorHistory: number[] = [];
  private predictionHistory: number[] = [];
  
  // Signal statistics
  private signalVariance: number = 0.1;
  private noiseEstimate: number = 0.1;
  private meanValue: number = 0;
  
  // Performance metrics
  private predictionAccuracy: number = 0;
  private stabilityMetric: number = 0;
  
  /**
   * Process a new signal value using the adaptive model
   * @param value Current signal value
   * @returns Processed value and prediction metrics
   */
  public processValue(value: number): {
    filteredValue: number;
    predictedValue: number;
    signalQuality: number;
  } {
    // Update signal history
    this.signalHistory.push(value);
    if (this.signalHistory.length > MODEL_ORDER * 2) {
      this.signalHistory.shift();
    }
    
    // Update signal statistics
    this.updateSignalStatistics(value);
    
    // Make prediction using current model
    const predictedValue = this.predictValue();
    
    // Calculate prediction error
    const currentError = value - predictedValue;
    
    // Store prediction for future evaluation
    this.predictionHistory.push(predictedValue);
    if (this.predictionHistory.length > PREDICTION_HORIZON * 2) {
      this.predictionHistory.shift();
    }
    
    // Update error history
    this.errorHistory.push(currentError);
    if (this.errorHistory.length > 10) {
      this.errorHistory.shift();
    }
    
    // Check if current value is an outlier
    const isOutlier = Math.abs(currentError) > this.signalVariance * OUTLIER_THRESHOLD;
    
    // Apply correction if needed
    const filteredValue = isOutlier 
      ? this.correctOutlier(value, predictedValue) 
      : value;
    
    // Update prediction accuracy metric
    this.updatePredictionAccuracy();
    
    // Adapt model coefficients using regularized LMS algorithm
    this.adaptModelCoefficients(currentError);
    
    // Calculate signal quality based on prediction performance
    const signalQuality = this.calculateSignalQuality();
    
    return {
      filteredValue,
      predictedValue,
      signalQuality,
    };
  }
  
  /**
   * Predict the next signal value using the AR model
   */
  private predictValue(): number {
    if (this.signalHistory.length < MODEL_ORDER) {
      return this.signalHistory.length > 0 ? this.signalHistory[this.signalHistory.length - 1] : 0;
    }
    
    // Apply AR model
    let prediction = 0;
    for (let i = 0; i < MODEL_ORDER; i++) {
      prediction += this.coefficients[i] * this.signalHistory[this.signalHistory.length - 1 - i];
    }
    
    // Add bias correction (mean)
    prediction += (1 - this.coefficients.reduce((sum, c) => sum + c, 0)) * this.meanValue;
    
    return prediction;
  }
  
  /**
   * Update signal statistics with new value
   */
  private updateSignalStatistics(value: number): void {
    // Update mean using exponential moving average
    this.meanValue = 0.95 * this.meanValue + 0.05 * value;
    
    // Update variance estimate
    if (this.signalHistory.length > 3) {
      const deviation = value - this.meanValue;
      this.signalVariance = 0.95 * this.signalVariance + 0.05 * (deviation * deviation);
    }
    
    // Update noise estimate from error history
    if (this.errorHistory.length > 3) {
      const meanError = this.errorHistory.reduce((sum, e) => sum + e, 0) / this.errorHistory.length;
      const errorVariance = this.errorHistory.reduce((sum, e) => sum + (e - meanError) * (e - meanError), 0) / this.errorHistory.length;
      this.noiseEstimate = 0.9 * this.noiseEstimate + 0.1 * errorVariance;
    }
  }
  
  /**
   * Correct outliers using prediction and historical values
   */
  private correctOutlier(value: number, prediction: number): number {
    // Blend actual value with prediction based on deviation magnitude
    const deviation = Math.abs(value - prediction);
    const relativeDeviation = deviation / (this.signalVariance + 0.001);
    
    // Calculate blend factor (higher deviation = more correction)
    const blendFactor = Math.min(0.8, (relativeDeviation - OUTLIER_THRESHOLD) / 5);
    
    // Weighted average of actual value and prediction
    return (1 - blendFactor) * value + blendFactor * prediction;
  }
  
  /**
   * Adapt model coefficients using regularized LMS algorithm
   */
  private adaptModelCoefficients(error: number): void {
    if (this.signalHistory.length < MODEL_ORDER) return;
    
    // Update adaptation rate based on prediction performance
    this.updateAdaptationRate();
    
    // Regularization factor to prevent overfitting
    const regularization = 0.001;
    
    // Update each coefficient
    for (let i = 0; i < MODEL_ORDER; i++) {
      const signal = this.signalHistory[this.signalHistory.length - 1 - i];
      
      // Regularized LMS update
      this.coefficients[i] = (1 - this.adaptationRate * regularization) * this.coefficients[i] + 
                            this.adaptationRate * error * signal / (this.signalVariance + 0.001);
    }
    
    // Constraint: Ensure stability by keeping sum of coefficients <= 0.95
    const sum = this.coefficients.reduce((total, coef) => total + Math.abs(coef), 0);
    if (sum > 0.95) {
      const scale = 0.95 / sum;
      for (let i = 0; i < this.coefficients.length; i++) {
        this.coefficients[i] *= scale;
      }
    }
  }
  
  /**
   * Update the adaptation rate based on prediction performance
   */
  private updateAdaptationRate(): void {
    // Calculate recent error variance
    if (this.errorHistory.length < 3) return;
    
    const meanError = this.errorHistory.reduce((sum, e) => sum + e, 0) / this.errorHistory.length;
    const errorVariance = this.errorHistory.reduce((sum, e) => sum + (e - meanError) * (e - meanError), 0) / this.errorHistory.length;
    
    // Normalized error variance (compared to signal variance)
    const normalizedErrorVariance = errorVariance / (this.signalVariance + 0.001);
    
    // Adjust adaptation rate - faster for poor performance, slower for good performance
    if (normalizedErrorVariance > 0.5) {
      // Increase adaptation rate for poor model performance
      this.adaptationRate = Math.min(ADAPTATION_RATE_MAX, this.adaptationRate * 1.1);
    } else {
      // Decrease adaptation rate when model performs well
      this.adaptationRate = Math.max(ADAPTATION_RATE_MIN, this.adaptationRate * 0.95);
    }
    
    // Update stability metric
    this.stabilityMetric = 1 - normalizedErrorVariance;
  }
  
  /**
   * Update prediction accuracy metric
   */
  private updatePredictionAccuracy(): void {
    if (this.errorHistory.length < 3 || this.signalVariance < 0.001) return;
    
    // Calculate normalized mean absolute error
    const meanAbsError = this.errorHistory.reduce((sum, e) => sum + Math.abs(e), 0) / this.errorHistory.length;
    const normalizedError = meanAbsError / Math.sqrt(this.signalVariance);
    
    // Convert to accuracy (0-1 scale)
    this.predictionAccuracy = Math.max(0, 1 - Math.min(1, normalizedError));
  }
  
  /**
   * Calculate signal quality based on prediction performance
   */
  private calculateSignalQuality(): number {
    // Weight factors for different components
    const PREDICTION_WEIGHT = 0.6;
    const STABILITY_WEIGHT = 0.3;
    const NOISE_WEIGHT = 0.1;
    
    // Noise factor (lower noise = higher quality)
    const noiseRatio = this.noiseEstimate / (this.signalVariance + 0.001);
    const noiseFactor = Math.max(0, 1 - Math.min(1, noiseRatio * 2));
    
    // Combined quality metric
    const qualityMetric = 
      PREDICTION_WEIGHT * this.predictionAccuracy +
      STABILITY_WEIGHT * this.stabilityMetric + 
      NOISE_WEIGHT * noiseFactor;
    
    // Convert to 0-100 scale
    return Math.round(qualityMetric * 100);
  }
  
  /**
   * Reset the adaptive predictor
   */
  public reset(): void {
    this.coefficients = Array(MODEL_ORDER).fill(0);
    this.adaptationRate = 0.05;
    this.signalHistory = [];
    this.errorHistory = [];
    this.predictionHistory = [];
    this.signalVariance = 0.1;
    this.noiseEstimate = 0.1;
    this.meanValue = 0;
    this.predictionAccuracy = 0;
    this.stabilityMetric = 0;
  }
  
  /**
   * Get current predictor state for debugging
   */
  public getState(): any {
    return {
      coefficients: [...this.coefficients],
      adaptationRate: this.adaptationRate,
      signalVariance: this.signalVariance,
      noiseEstimate: this.noiseEstimate,
      predictionAccuracy: this.predictionAccuracy,
      stabilityMetric: this.stabilityMetric
    };
  }
}

/**
 * Create a new adaptive predictor instance
 */
export function createAdaptivePredictor(): AdaptivePredictor {
  return new AdaptivePredictor();
}

/**
 * Function to reset the adaptive predictor from outside
 */
export function resetAdaptivePredictor(): void {
  console.log("Adaptive predictor reset requested");
  // This is a placeholder for module-level reset
  // Actual reset happens when calling reset() on the predictor instance
}
