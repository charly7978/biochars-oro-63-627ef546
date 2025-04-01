/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Adaptive control utilities for heart rate processing
 * Provides signal enhancement, prediction, and quality estimation
 */

import { 
  getAdaptivePredictor, 
  resetAdaptivePredictor, 
  AdaptiveModelState 
} from '../../../modules/signal-processing/utils/adaptive-predictor';
import {
  getMixedModel,
  resetMixedModel,
  MixedModelPrediction
} from '../../../modules/signal-processing/utils/mixed-model';
import {
  BayesianOptimizer,
  createDefaultPPGOptimizer,
  OptimizationResult
} from '../../../modules/signal-processing/utils/bayesian-optimization';
import {
  GaussianProcessModel,
  GPPrediction
} from '../../../modules/signal-processing/utils/gaussian-process';

// Keep history of signal values for processing
const signalHistory: {time: number, value: number, quality: number}[] = [];
const MAX_HISTORY_LENGTH = 30;

// Bayesian optimization for parameter tuning
let bayesianOptimizer: BayesianOptimizer | null = null;

// Gaussian process model for uncertainty estimation
let gaussianProcess: GaussianProcessModel | null = null;

// Window-based statistics
let windowMean = 0;
let windowStd = 0;
let lastAnomalyDetectionTime = 0;
const ANOMALY_DETECTION_INTERVAL = 1000; // ms

/**
 * Reset the adaptive control system
 */
export function resetAdaptiveControl(): void {
  signalHistory.length = 0;
  windowMean = 0;
  windowStd = 0;
  lastAnomalyDetectionTime = 0;
  
  resetAdaptivePredictor();
  resetMixedModel();
  
  if (bayesianOptimizer) {
    bayesianOptimizer.reset();
  }
  
  if (gaussianProcess) {
    gaussianProcess.reset();
  }
  
  console.log("AdaptiveControl: System reset");
}

/**
 * Get the current state of the adaptive model
 */
export function getAdaptiveModelState(): AdaptiveModelState {
  return getAdaptivePredictor().getState();
}

/**
 * Apply adaptive filtering to a signal value
 */
export function applyAdaptiveFilter(value: number, time: number, quality: number): number {
  // Add to history
  signalHistory.push({time, value, quality});
  if (signalHistory.length > MAX_HISTORY_LENGTH) {
    signalHistory.shift();
  }
  
  // Update window statistics
  if (signalHistory.length >= 5) {
    const values = signalHistory.map(h => h.value);
    windowMean = values.reduce((sum, v) => sum + v, 0) / values.length;
    windowStd = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - windowMean, 2), 0) / values.length
    );
  }
  
  // Update the adaptive predictor
  getAdaptivePredictor().update(time, value, quality);
  
  // Apply adaptive filtering based on signal quality
  if (signalHistory.length < 3) return value;
  
  // For high quality signals, apply minimal filtering
  if (quality > 0.8) {
    return value;
  }
  
  // For medium quality, apply moderate filtering
  if (quality > 0.5) {
    const recent = signalHistory.slice(-3);
    const weightedSum = recent.reduce((sum, h, i) => {
      // More weight to more recent values
      const weight = i === 2 ? 0.6 : i === 1 ? 0.3 : 0.1;
      return sum + h.value * weight;
    }, 0);
    
    return weightedSum;
  }
  
  // For low quality, apply stronger filtering
  const recent = signalHistory.slice(-5);
  const weightedSum = recent.reduce((sum, h, i) => {
    // Exponential weighting
    const weight = Math.pow(0.8, 4 - i);
    return sum + h.value * weight;
  }, 0);
  
  const weights = recent.reduce((sum, _, i) => sum + Math.pow(0.8, 4 - i), 0);
  return weightedSum / weights;
}

/**
 * Predict the next value in the signal
 */
export function predictNextValue(time: number): {
  prediction: number;
  confidence: number;
} {
  // If not enough history, return simple prediction
  if (signalHistory.length < 5) {
    return {
      prediction: signalHistory.length > 0 ? signalHistory[signalHistory.length - 1].value : 0,
      confidence: 0.1
    };
  }
  
  // Get prediction from adaptive predictor
  const prediction = getAdaptivePredictor().predict(time);
  
  return {
    prediction: prediction.predictedValue,
    confidence: prediction.confidence
  };
}

/**
 * Detect and correct anomalies in the signal
 */
export function correctSignalAnomalies(value: number, time: number, quality: number): {
  correctedValue: number;
  anomalyDetected: boolean;
  anomalyProbability: number;
} {
  // If not enough history, return original value
  if (signalHistory.length < 5) {
    return {
      correctedValue: value,
      anomalyDetected: false,
      anomalyProbability: 0
    };
  }
  
  // Only run expensive anomaly detection periodically
  const now = Date.now();
  const runFullDetection = now - lastAnomalyDetectionTime > ANOMALY_DETECTION_INTERVAL;
  
  if (runFullDetection) {
    lastAnomalyDetectionTime = now;
  }
  
  // Quick anomaly check: deviation from recent mean
  const deviationFromMean = Math.abs(value - windowMean);
  const quickAnomalyScore = windowStd > 0 ? deviationFromMean / (windowStd * 3) : 0;
  const quickAnomalyThreshold = 1.0;
  
  // For high quality signals, apply minimal correction
  if (quality > 0.7 && quickAnomalyScore < quickAnomalyThreshold) {
    return {
      correctedValue: value,
      anomalyDetected: false,
      anomalyProbability: quickAnomalyScore
    };
  }
  
  // For suspected anomalies, use adaptive predictor
  const correctedValue = getAdaptivePredictor().correctAnomaly(time, value, quality);
  const anomalyProbability = runFullDetection ? 
    getAdaptivePredictor().calculateArtifactProbability() : 
    quickAnomalyScore;
  
  const anomalyDetected = correctedValue !== value || anomalyProbability > 0.5;
  
  if (anomalyDetected) {
    console.log("AdaptiveControl: Anomaly detected", {
      original: value.toFixed(2),
      corrected: correctedValue.toFixed(2),
      probability: anomalyProbability.toFixed(2),
      quality
    });
  }
  
  return {
    correctedValue,
    anomalyDetected,
    anomalyProbability
  };
}

/**
 * Update signal quality based on prediction accuracy
 */
export function updateQualityWithPrediction(
  value: number, 
  quality: number, 
  time: number
): number {
  // If not enough history, return original quality
  if (signalHistory.length < 5) {
    return quality;
  }
  
  // Get the most recent prediction
  const lastPrediction = predictNextValue(time);
  
  // Compare prediction with actual value
  const predictionError = Math.abs(value - lastPrediction.prediction);
  const normalizedError = windowStd > 0 ? 
    predictionError / (windowStd * 3) : 
    predictionError / (Math.abs(value) + 0.01);
  
  // Compute quality factor based on prediction accuracy
  const accuracyFactor = Math.max(0, 1 - normalizedError);
  
  // Only decrease quality based on prediction, never increase
  if (accuracyFactor < quality) {
    const adaptationRate = 0.3;
    const updatedQuality = quality * (1 - adaptationRate) + accuracyFactor * adaptationRate;
    
    if (Math.abs(updatedQuality - quality) > 0.2) {
      console.log("AdaptiveControl: Significant quality reduction based on prediction", {
        original: quality.toFixed(2),
        updated: updatedQuality.toFixed(2),
        error: normalizedError.toFixed(2)
      });
    }
    
    return updatedQuality;
  }
  
  return quality;
}

/**
 * Apply Bayesian optimization to signal processing parameters
 */
export function applyBayesianOptimization(
  parameters: Record<string, number>,
  qualityScore: number
): OptimizationResult {
  if (!bayesianOptimizer) {
    // Create optimizer with default parameters
    bayesianOptimizer = createDefaultPPGOptimizer();
  }
  
  // Add observation to optimizer
  bayesianOptimizer.addObservation(parameters, qualityScore);
  
  // Get suggestion for next parameters
  return bayesianOptimizer.suggestNextParameters();
}

/**
 * Apply Gaussian process modeling to the signal
 */
export function applyGaussianProcessModeling(
  time: number, 
  value: number, 
  uncertainty: number
): GPPrediction {
  if (!gaussianProcess) {
    gaussianProcess = new GaussianProcessModel();
  }
  
  // Add observation to GP model
  gaussianProcess.addObservation({
    time,
    value,
    uncertainty
  });
  
  // Update GP parameters periodically
  if (signalHistory.length % 5 === 0) {
    gaussianProcess.updateParameters();
  }
  
  // Predict using GP
  return gaussianProcess.predict(time);
}

/**
 * Apply the mixed model (deep learning + Bayesian) to signal processing
 */
export function applyMixedModelPrediction(
  features: number[],
  targetTime: number
): Promise<MixedModelPrediction> {
  const mixedModel = getMixedModel();
  
  // If we have a recent value to train with
  if (signalHistory.length > 0) {
    const lastPoint = signalHistory[signalHistory.length - 1];
    mixedModel.update(features, lastPoint.value).catch(err => {
      console.error("Error updating mixed model:", err);
    });
  }
  
  // Make prediction
  return mixedModel.predict(features);
}
