/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Advanced adaptive prediction for signal processing
 * Integrates Bayesian optimization and Gaussian process modeling
 */

import { BayesianOptimizer, createDefaultPPGOptimizer } from './bayesian-optimization';
import { GaussianProcessModel, DataPoint, GPPrediction } from './gaussian-process';
import { SignalProcessingOptions } from '../types';

/**
 * State of the adaptive model
 */
export interface AdaptiveModelState {
  // Buffer statistics
  bufferSize: number;
  
  // Quality statistics
  averageQuality: number;
  qualityStability: number;
  
  // Prediction statistics
  averagePredictionError: number;
  predictionConfidence: number;
  
  // Parameter optimization
  optimizedParameters: Record<string, number>;
  improvementRate: number;
}

/**
 * Prediction result
 */
export interface PredictionResult {
  predictedValue: number;
  confidence: number;
  anomalyScore: number;
  correctedValue: number | null;
}

/**
 * Advanced adaptive predictor for PPG signal
 * Combines multiple models for robust prediction
 */
export class AdaptivePredictor {
  // Signal buffer and statistics
  private readonly buffer: {time: number, value: number, quality: number}[] = [];
  private readonly MAX_BUFFER_SIZE = 30;
  
  // Recent anomaly statistics
  private anomalyCount = 0;
  private anomalyThreshold = 0.5;
  
  // Advanced modeling components
  private gaussianProcess: GaussianProcessModel;
  private bayesianOptimizer: BayesianOptimizer;
  
  // Statistics tracking
  private predictionErrors: number[] = [];
  private readonly MAX_ERRORS_TRACKED = 20;
  private lastPrediction: number | null = null;
  private adaptationRate = 0.1;
  
  // Configuration
  private options: SignalProcessingOptions = {
    amplificationFactor: 2.0,
    filterStrength: 1.0,
    qualityThreshold: 0.7,
    fingerDetectionSensitivity: 0.8,
    useAdaptiveControl: true,
    qualityEnhancedByPrediction: true,
    predictionHorizon: 5,
    adaptationRate: 0.15
  };

  constructor() {
    this.gaussianProcess = new GaussianProcessModel();
    this.bayesianOptimizer = createDefaultPPGOptimizer();
    
    console.log("AdaptivePredictor: Initialized with GP and Bayesian optimization");
  }

  /**
   * Update the adaptive model with a new signal value
   */
  public update(time: number, value: number, quality: number): void {
    // Add to buffer
    this.buffer.push({time, value, quality});
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Update GP model
    this.gaussianProcess.addObservation({
      time,
      value,
      uncertainty: 1.0 - quality
    });
    
    // Check prediction error if we had a previous prediction
    if (this.lastPrediction !== null) {
      const error = Math.abs(value - this.lastPrediction);
      this.predictionErrors.push(error);
      
      if (this.predictionErrors.length > this.MAX_ERRORS_TRACKED) {
        this.predictionErrors.shift();
      }
      
      // Use prediction error to optimize parameters
      if (this.predictionErrors.length >= 5) {
        const avgError = this.predictionErrors.reduce((sum, e) => sum + e, 0) / 
                        this.predictionErrors.length;
        const score = Math.max(0, 1.0 - avgError / 10.0);
        
        this.bayesianOptimizer.addObservation({
          qualityThreshold: this.options.qualityThreshold || 0.7,
          amplificationFactor: this.options.amplificationFactor || 2.0,
          adaptationRate: this.options.adaptationRate || 0.15,
          filterStrength: this.options.filterStrength || 1.0,
          predictionHorizon: this.options.predictionHorizon || 5
        }, score);
        
        // Every 10 updates, see if we can improve parameters
        if (this.buffer.length % 10 === 0) {
          this.optimizeParameters();
        }
      }
    }
    
    // Update GP kernel parameters occasionally
    if (this.buffer.length % 5 === 0) {
      this.gaussianProcess.updateParameters();
    }
  }

  /**
   * Predict the next value
   */
  public predict(time: number): PredictionResult {
    if (this.buffer.length < 3) {
      return {
        predictedValue: 0,
        confidence: 0,
        anomalyScore: 0,
        correctedValue: null
      };
    }
    
    // Use GP to predict
    const gpPrediction = this.gaussianProcess.predict(time);
    
    // Calculate linear prediction as fallback
    const recent = this.buffer.slice(-3);
    const linearPrediction = this.predictLinear(time);
    
    // Detect if the GP prediction might be an anomaly
    const recentValues = this.buffer.slice(-5).map(b => b.value);
    const recentMean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const recentStd = Math.sqrt(
      recentValues.reduce((sum, v) => sum + Math.pow(v - recentMean, 2), 0) / recentValues.length
    );
    
    // Anomaly detection
    const deviationFromRecent = Math.abs(gpPrediction.mean - recentMean);
    const anomalyScore = recentStd > 0 ? deviationFromRecent / (recentStd * 3) : 0;
    
    // Final prediction is weighted average
    const gpWeight = Math.max(0.3, Math.min(0.9, gpPrediction.confidence));
    const predictedValue = gpPrediction.mean * gpWeight + linearPrediction * (1 - gpWeight);
    
    // Correct if anomaly detected
    let correctedValue = null;
    if (anomalyScore > this.anomalyThreshold) {
      this.anomalyCount++;
      correctedValue = linearPrediction;
    } else {
      this.anomalyCount = Math.max(0, this.anomalyCount - 1);
    }
    
    // Store for error tracking
    this.lastPrediction = predictedValue;
    
    return {
      predictedValue,
      confidence: gpPrediction.confidence,
      anomalyScore,
      correctedValue
    };
  }

  /**
   * Simple linear prediction based on recent values
   */
  private predictLinear(time: number): number {
    if (this.buffer.length < 2) return 0;
    
    const recent = this.buffer.slice(-2);
    const deltaTime = recent[1].time - recent[0].time;
    const deltaValue = recent[1].value - recent[0].value;
    
    if (deltaTime === 0) return recent[1].value;
    
    const slope = deltaValue / deltaTime;
    const timeFromLatest = time - recent[1].time;
    
    return recent[1].value + slope * timeFromLatest;
  }

  /**
   * Optimize parameters using Bayesian optimization
   */
  private optimizeParameters(): void {
    const nextParams = this.bayesianOptimizer.suggestNextParameters();
    
    // Only update if expected improvement is significant
    if (nextParams.expectedImprovement > 0.2) {
      const currentParams = {
        qualityThreshold: this.options.qualityThreshold || 0.7,
        amplificationFactor: this.options.amplificationFactor || 2.0,
        adaptationRate: this.options.adaptationRate || 0.15,
        filterStrength: this.options.filterStrength || 1.0,
        predictionHorizon: this.options.predictionHorizon || 5
      };
      
      // Gradually adapt parameters
      Object.keys(nextParams.parameters).forEach(key => {
        const current = currentParams[key];
        const suggested = nextParams.parameters[key];
        
        // Use adaptation rate to smooth changes
        this.options[key] = current * (1 - this.adaptationRate) + 
                           suggested * this.adaptationRate;
      });
      
      console.log("AdaptivePredictor: Updated parameters", {
        qualityThreshold: this.options.qualityThreshold?.toFixed(2),
        amplificationFactor: this.options.amplificationFactor?.toFixed(2),
        adaptationRate: this.options.adaptationRate?.toFixed(3),
        filterStrength: this.options.filterStrength?.toFixed(2),
        predictionHorizon: this.options.predictionHorizon
      });
    }
  }

  /**
   * Detect and correct anomalies in a signal value
   */
  public correctAnomaly(time: number, value: number, quality: number): number {
    if (this.buffer.length < 5) return value;
    
    // Predict what the value should be
    const prediction = this.predict(time);
    
    // If high anomaly score and low quality, correct the value
    if (prediction.anomalyScore > this.anomalyThreshold && quality < 0.6) {
      console.log("AdaptivePredictor: Correcting anomaly", {
        original: value.toFixed(2),
        corrected: prediction.predictedValue.toFixed(2),
        anomalyScore: prediction.anomalyScore.toFixed(2),
        quality
      });
      
      // Blend original and prediction based on quality
      const correctionStrength = 1.0 - quality;
      return value * (1 - correctionStrength) + prediction.predictedValue * correctionStrength;
    }
    
    return value;
  }

  /**
   * Calculate the probability that a signal contains an artifact
   */
  public calculateArtifactProbability(): number {
    if (this.buffer.length < 10) return 0;
    
    // Use recent prediction errors and anomaly count
    const avgPredictionError = this.predictionErrors.length > 0 ? 
      this.predictionErrors.reduce((sum, e) => sum + e, 0) / this.predictionErrors.length : 0;
    
    // Normalize and combine factors
    const errorFactor = Math.min(1, avgPredictionError / 10);
    const anomalyFactor = Math.min(1, this.anomalyCount / 5);
    
    return (errorFactor * 0.6 + anomalyFactor * 0.4);
  }

  /**
   * Get the current state of the adaptive model
   */
  public getState(): AdaptiveModelState {
    const avgQuality = this.buffer.length > 0 ? 
      this.buffer.reduce((sum, b) => sum + b.quality, 0) / this.buffer.length : 0;
    
    const qualityVariation = this.buffer.length > 1 ? 
      Math.sqrt(this.buffer.reduce((sum, b) => sum + Math.pow(b.quality - avgQuality, 2), 0) / this.buffer.length) : 0;
    
    const avgPredictionError = this.predictionErrors.length > 0 ? 
      this.predictionErrors.reduce((sum, e) => sum + e, 0) / this.predictionErrors.length : 0;
    
    // Calculate confidence in prediction
    const errorNormalized = Math.min(1, avgPredictionError / 10);
    const predictionConfidence = 1.0 - errorNormalized;
    
    // Get latest optimized parameters
    const bestParams = this.bayesianOptimizer.getBestParameters() || {};
    
    return {
      bufferSize: this.buffer.length,
      averageQuality: avgQuality,
      qualityStability: 1.0 - Math.min(1, qualityVariation),
      averagePredictionError: avgPredictionError,
      predictionConfidence,
      optimizedParameters: bestParams,
      improvementRate: this.adaptationRate
    };
  }

  /**
   * Configure the predictor
   */
  public configure(options: SignalProcessingOptions): void {
    this.options = {...this.options, ...options};
    
    // Update related parameters
    if (options.adaptationRate !== undefined) {
      this.adaptationRate = options.adaptationRate;
    }
    
    console.log("AdaptivePredictor: Configured with options", this.options);
  }

  /**
   * Reset the predictor state
   */
  public reset(): void {
    this.buffer.length = 0;
    this.predictionErrors.length = 0;
    this.lastPrediction = null;
    this.anomalyCount = 0;
    
    this.gaussianProcess.reset();
    this.bayesianOptimizer.reset();
    
    console.log("AdaptivePredictor: Reset");
  }
}

/**
 * Singleton instance for global use
 */
let globalAdaptivePredictor: AdaptivePredictor | null = null;

/**
 * Get the global adaptive predictor instance
 */
export function getAdaptivePredictor(): AdaptivePredictor {
  if (!globalAdaptivePredictor) {
    globalAdaptivePredictor = new AdaptivePredictor();
  }
  return globalAdaptivePredictor;
}

/**
 * Reset the global adaptive predictor
 */
export function resetAdaptivePredictor(): void {
  if (globalAdaptivePredictor) {
    globalAdaptivePredictor.reset();
  }
}
