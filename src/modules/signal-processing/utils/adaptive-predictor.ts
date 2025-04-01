/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptive prediction utilities for signal processing
 */

/**
 * State of the adaptive model
 */
export interface AdaptiveModelState {
  historySize: number;
  predictiveAccuracy: number;
  adaptationRate: number;
  lastPrediction?: number;
}

/**
 * Class representing an adaptive predictor
 */
class AdaptivePredictor {
  private history: number[] = [];
  private timestamps: number[] = [];
  private qualityHistory: number[] = [];
  private lastPrediction: number | null = null;
  private adaptationRate: number = 0.3;
  private maxHistorySize: number = 30;
  private anomalyProbability: number = 0;

  /**
   * Update the predictor with a new value
   */
  update(time: number, value: number, quality: number): void {
    this.history.push(value);
    this.timestamps.push(time);
    this.qualityHistory.push(quality);
    
    // Keep history at a reasonable size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.timestamps.shift();
      this.qualityHistory.shift();
    }
  }

  /**
   * Predict the next value
   */
  predict(time: number): { predictedValue: number; confidence: number } {
    if (this.history.length < 3) {
      return {
        predictedValue: this.history.length > 0 ? this.history[this.history.length - 1] : 0,
        confidence: 0.1
      };
    }

    // Simple linear prediction based on last few values
    const lastValue = this.history[this.history.length - 1];
    const prevValue = this.history[this.history.length - 2];
    const trend = lastValue - prevValue;
    
    // Adjust prediction based on trend and recent history
    const predictedValue = lastValue + trend * 0.7;
    this.lastPrediction = predictedValue;

    // Calculate confidence based on recent signal quality
    const avgQuality = this.qualityHistory.slice(-3).reduce((sum, q) => sum + q, 0) / 3;
    const confidence = Math.min(avgQuality, 0.95);

    return { predictedValue, confidence };
  }

  /**
   * Correct anomalies in the signal
   */
  correctAnomaly(time: number, value: number, quality: number): number {
    if (this.history.length < 5) {
      return value;
    }

    // Calculate recent mean and standard deviation
    const recentValues = this.history.slice(-5);
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length
    );
    
    // Check if value is an outlier (more than 3 standard deviations from mean)
    const deviation = Math.abs(value - mean);
    const isOutlier = stdDev > 0 && deviation > stdDev * 3;
    
    if (isOutlier) {
      // Update anomaly probability
      this.anomalyProbability = 0.8;
      
      // Use mean as corrected value
      const corrected = mean + Math.sign(value - mean) * Math.min(deviation, stdDev * 2);
      return corrected;
    }
    
    // Value is not an outlier, gradually reduce anomaly probability
    this.anomalyProbability = Math.max(0, this.anomalyProbability - 0.2);
    return value;
  }

  /**
   * Calculate the probability that the current signal contains artifacts
   */
  calculateArtifactProbability(): number {
    return this.anomalyProbability;
  }

  /**
   * Get the current state of the model
   */
  getState(): AdaptiveModelState {
    return {
      historySize: this.history.length,
      predictiveAccuracy: 1 - this.anomalyProbability,
      adaptationRate: this.adaptationRate,
      lastPrediction: this.lastPrediction || undefined
    };
  }

  /**
   * Reset the predictor
   */
  reset(): void {
    this.history = [];
    this.timestamps = [];
    this.qualityHistory = [];
    this.lastPrediction = null;
    this.anomalyProbability = 0;
  }
}

// Singleton instance
let adaptivePredictor: AdaptivePredictor | null = null;

/**
 * Get the adaptive predictor instance
 */
export function getAdaptivePredictor(): AdaptivePredictor {
  if (!adaptivePredictor) {
    adaptivePredictor = new AdaptivePredictor();
  }
  return adaptivePredictor;
}

/**
 * Reset the adaptive predictor
 */
export function resetAdaptivePredictor(): void {
  if (adaptivePredictor) {
    adaptivePredictor.reset();
  } else {
    adaptivePredictor = new AdaptivePredictor();
  }
}

/**
 * Apply adaptive filtering to a signal value
 */
export function applyAdaptiveFilter(value: number, history: number[], adaptationRate: number = 0.3): number {
  if (history.length < 2) return value;
  
  const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
  const filtered = (1 - adaptationRate) * mean + adaptationRate * value;
  
  return filtered;
}

/**
 * Predict the next value based on recent history
 */
export function predictNextValue(history: number[], options?: { horizon?: number }): number {
  if (history.length < 2) return 0;
  
  // Use linear prediction based on last few samples
  const last = history[history.length - 1];
  const prevLast = history[history.length - 2];
  const delta = last - prevLast;
  
  return last + delta * 0.8; // Slightly damped prediction
}

/**
 * Correct anomalies in the signal
 */
export function correctSignalAnomalies(value: number, history: number[], threshold: number = 0.5): number {
  if (history.length < 3) return value;
  
  const mean = history.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
  const deviation = Math.abs(value - mean);
  
  // If the deviation is too high, limit it
  if (deviation > threshold) {
    return mean + (value > mean ? threshold : -threshold);
  }
  
  return value;
}

/**
 * Update signal quality based on prediction accuracy
 */
export function updateQualityWithPrediction(
  currentQuality: number, 
  predictedValue: number, 
  actualValue: number,
  maxDeviation: number = 0.2
): number {
  const deviation = Math.abs(predictedValue - actualValue);
  const predictionAccuracy = Math.max(0, 1 - (deviation / maxDeviation));
  
  // Weight the current quality with prediction accuracy
  return currentQuality * 0.8 + predictionAccuracy * 0.2;
}
