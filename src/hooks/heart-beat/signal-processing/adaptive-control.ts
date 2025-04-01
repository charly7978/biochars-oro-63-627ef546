
/**
 * Adaptive Control and Predictive Modeling for PPG Signal Processing
 * Implements real-time parameter adaptation and predictive signal correction
 */

// Constants for adaptive control parameters
const LEARNING_RATE_MIN = 0.01;
const LEARNING_RATE_MAX = 0.2;
const PREDICTION_WINDOW = 5;
const ADAPTATION_THRESHOLD = 0.08;

/**
 * Signal state and prediction model
 */
interface AdaptiveModelState {
  // Adaptive filter coefficients
  coefficients: number[];
  // Learning rate (adaptation speed)
  learningRate: number;
  // Error history for gradient calculation
  recentErrors: number[];
  // Signal history for prediction
  signalHistory: number[];
  // Prediction history for evaluation
  predictionHistory: number[];
  // Baseline noise estimation
  noiseEstimate: number;
  // Signal quality trend
  qualityTrend: number[];
}

// Initialize the adaptive model state
let modelState: AdaptiveModelState = {
  coefficients: [0.7, 0.2, 0.1], // Initial filter coefficients
  learningRate: 0.05,            // Initial learning rate
  recentErrors: [],              // Empty error history
  signalHistory: [],             // Empty signal history
  predictionHistory: [],         // Empty prediction history
  noiseEstimate: 0.1,            // Initial noise estimate
  qualityTrend: []               // Empty quality trend
};

/**
 * Reset the adaptive control system
 */
export function resetAdaptiveControl(): void {
  modelState = {
    coefficients: [0.7, 0.2, 0.1],
    learningRate: 0.05,
    recentErrors: [],
    signalHistory: [],
    predictionHistory: [],
    noiseEstimate: 0.1,
    qualityTrend: []
  };
}

/**
 * Adaptive filter that automatically adjusts to signal characteristics
 * @param value Current signal value
 * @param signalBuffer Recent signal history
 * @returns Filtered value
 */
export function applyAdaptiveFilter(value: number, signalBuffer: number[]): number {
  if (signalBuffer.length < 3) return value;
  
  // Update signal history
  modelState.signalHistory.push(value);
  if (modelState.signalHistory.length > 20) {
    modelState.signalHistory.shift();
  }
  
  // Apply current filter coefficients
  let filteredValue = 0;
  const historyLength = Math.min(modelState.coefficients.length, signalBuffer.length);
  
  for (let i = 0; i < historyLength; i++) {
    filteredValue += modelState.coefficients[i] * signalBuffer[signalBuffer.length - 1 - i];
  }
  
  // Calculate prediction error
  const error = value - filteredValue;
  
  // Update error history
  modelState.recentErrors.push(error);
  if (modelState.recentErrors.length > 10) {
    modelState.recentErrors.shift();
  }
  
  // Update noise estimate
  modelState.noiseEstimate = 0.95 * modelState.noiseEstimate + 0.05 * Math.abs(error);
  
  // Adapt filter coefficients using LMS (Least Mean Squares) algorithm
  // Only adapt if error is significant compared to noise
  if (Math.abs(error) > modelState.noiseEstimate * ADAPTATION_THRESHOLD) {
    // Update learning rate based on error variance
    updateLearningRate();
    
    // Update coefficients
    for (let i = 0; i < historyLength; i++) {
      const signalValue = signalBuffer[signalBuffer.length - 1 - i];
      modelState.coefficients[i] += modelState.learningRate * error * signalValue;
    }
    
    // Normalize coefficients to prevent divergence
    const sum = modelState.coefficients.reduce((a, b) => a + Math.abs(b), 0);
    if (sum > 0) {
      modelState.coefficients = modelState.coefficients.map(c => c / sum);
    }
  }
  
  return filteredValue;
}

/**
 * Dynamically adjust learning rate based on recent errors
 */
function updateLearningRate(): void {
  if (modelState.recentErrors.length < 5) return;
  
  // Calculate error variance
  const meanError = modelState.recentErrors.reduce((sum, val) => sum + val, 0) / modelState.recentErrors.length;
  const errorVariance = modelState.recentErrors.reduce((sum, val) => sum + Math.pow(val - meanError, 2), 0) / modelState.recentErrors.length;
  
  // Adjust learning rate - higher for stable signals, lower for noisy signals
  if (errorVariance > 0.1) {
    // Decrease learning rate for noisy signals
    modelState.learningRate = Math.max(LEARNING_RATE_MIN, modelState.learningRate * 0.95);
  } else {
    // Increase learning rate for stable signals
    modelState.learningRate = Math.min(LEARNING_RATE_MAX, modelState.learningRate * 1.05);
  }
}

/**
 * Predict future signal value based on current trend
 * @param signalBuffer Recent signal history
 * @returns Predicted next value
 */
export function predictNextValue(signalBuffer: number[]): number {
  if (signalBuffer.length < PREDICTION_WINDOW) return signalBuffer[signalBuffer.length - 1] || 0;
  
  // Use autoregressive modeling for prediction
  const recentValues = signalBuffer.slice(-PREDICTION_WINDOW);
  
  // Simple linear prediction model
  const diff1 = recentValues[recentValues.length - 1] - recentValues[recentValues.length - 2];
  const diff2 = recentValues[recentValues.length - 2] - recentValues[recentValues.length - 3];
  
  // Weighted combination of recent differences for prediction
  const predictedDiff = 0.7 * diff1 + 0.3 * diff2;
  const prediction = recentValues[recentValues.length - 1] + predictedDiff;
  
  // Update prediction history
  modelState.predictionHistory.push(prediction);
  if (modelState.predictionHistory.length > 10) {
    modelState.predictionHistory.shift();
  }
  
  return prediction;
}

/**
 * Correct signal anomalies using predictive model
 * @param value Current signal value
 * @param signalBuffer Recent signal history
 * @returns Corrected value
 */
export function correctSignalAnomalies(value: number, signalBuffer: number[]): number {
  if (signalBuffer.length < PREDICTION_WINDOW || modelState.predictionHistory.length < 2) {
    return value;
  }
  
  // Get latest prediction (made on previous step)
  const lastPrediction = modelState.predictionHistory[modelState.predictionHistory.length - 1];
  
  // Calculate prediction error
  const predictionError = Math.abs(value - lastPrediction);
  
  // Calculate typical signal variation
  const recentValues = signalBuffer.slice(-PREDICTION_WINDOW);
  const meanValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  const typicalVariation = recentValues.reduce((sum, val) => sum + Math.abs(val - meanValue), 0) / recentValues.length;
  
  // If current value deviates too much from prediction, apply correction
  if (predictionError > typicalVariation * 2.5) {
    // Blend actual value with prediction based on deviation magnitude
    const blendFactor = Math.min(0.8, predictionError / (typicalVariation * 5));
    return (1 - blendFactor) * value + blendFactor * lastPrediction;
  }
  
  return value;
}

/**
 * Update signal quality based on prediction accuracy
 * @param actualValue Current actual signal value
 * @param qualityEstimate Current quality estimate
 * @returns Updated quality estimate
 */
export function updateQualityWithPrediction(actualValue: number, qualityEstimate: number): number {
  if (modelState.predictionHistory.length < 2) return qualityEstimate;
  
  // Get prediction made in previous step
  const prediction = modelState.predictionHistory[modelState.predictionHistory.length - 2];
  
  // Calculate normalized prediction error
  const error = Math.abs(actualValue - prediction);
  const normalizedError = error / (modelState.noiseEstimate + 0.001);
  
  // Calculate prediction accuracy factor (0-1)
  const predictionAccuracy = Math.max(0, 1 - Math.min(1, normalizedError / 3));
  
  // Update quality trend
  modelState.qualityTrend.push(predictionAccuracy);
  if (modelState.qualityTrend.length > 10) {
    modelState.qualityTrend.shift();
  }
  
  // Calculate trend-based quality modifier
  const trendQuality = modelState.qualityTrend.reduce((sum, val) => sum + val, 0) / 
                       modelState.qualityTrend.length;
  
  // Blend current quality with prediction-based quality
  const updatedQuality = 0.7 * qualityEstimate + 0.3 * (trendQuality * 100);
  
  return Math.min(100, Math.max(0, updatedQuality));
}

/**
 * Get the current state of the adaptive model
 * Useful for debugging and visualization
 */
export function getAdaptiveModelState(): {
  coefficients: number[],
  learningRate: number,
  noiseEstimate: number,
  qualityTrend: number[]
} {
  return {
    coefficients: [...modelState.coefficients],
    learningRate: modelState.learningRate,
    noiseEstimate: modelState.noiseEstimate,
    qualityTrend: [...modelState.qualityTrend]
  };
}
