
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Advanced adaptive prediction for signal processing
 * Modified to be more conservative and transparent
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
  
  // Transparency metrics
  enhancementRate: number;
  averageEnhancementAmount: number;
}

/**
 * Prediction result with transparency info
 */
export interface PredictionResult {
  predictedValue: number;
  filteredValue: number; // Más conservador, con menos modificación
  confidence: number;
  anomalyScore: number;
  correctedValue: number | null;
  signalQuality: number;
  wasEnhanced: boolean;
  enhancementAmount: number;
}

/**
 * Advanced adaptive predictor for PPG signal
 * Modified to be more conservative in data manipulation
 */
export class AdaptivePredictor {
  // Signal buffer and statistics
  private readonly buffer: {time: number, value: number, quality: number}[] = [];
  private readonly MAX_BUFFER_SIZE = 30;
  
  // Recent anomaly statistics
  private anomalyCount = 0;
  private anomalyThreshold = 0.65; // Incrementado para ser más conservador (era 0.5)
  
  // Advanced modeling components
  private gaussianProcess: GaussianProcessModel;
  private bayesianOptimizer: BayesianOptimizer;
  
  // Statistics tracking
  private predictionErrors: number[] = [];
  private readonly MAX_ERRORS_TRACKED = 20;
  private lastPrediction: number | null = null;
  private adaptationRate = 0.08; // Reducido de 0.1 para ser más gradual
  
  // Datos de mejora para auditoría
  private enhancementLog: Array<{
    timestamp: number,
    originalValue: number,
    enhancedValue: number,
    enhancementType: string,
    enhancementAmount: number
  }> = [];
  
  // Configuration
  private options: SignalProcessingOptions = {
    amplificationFactor: 1.0, // Reducido de 2.0
    filterStrength: 0.8, // Reducido de 1.0
    qualityThreshold: 0.7,
    fingerDetectionSensitivity: 0.8,
    useAdaptiveControl: true,
    qualityEnhancedByPrediction: true,
    predictionHorizon: 5,
    adaptationRate: 0.1,
    predictionWeight: 0.3, // Peso más bajo por defecto
    correctionThreshold: 0.7, // Umbral más alto para correcciones
    signalEnhancementAmount: 0.5 // Limitar la mejora a 50%
  };
  
  // Variables para hacer un seguimiento de la mejora de señal
  private valueEnhancedCount: number = 0;
  private totalEnhancementAmount: number = 0;
  private totalProcessedValues: number = 0;

  constructor() {
    this.gaussianProcess = new GaussianProcessModel();
    this.bayesianOptimizer = createDefaultPPGOptimizer();
    
    console.log("AdaptivePredictor: Initialized with more conservative settings");
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
    
    this.totalProcessedValues++;
    
    // Update GP model - más restrictivo en la incertidumbre
    this.gaussianProcess.addObservation({
      time,
      value,
      uncertainty: Math.min(0.9, 1.0 - quality) // Limita la incertidumbre máxima
    });
    
    // Check prediction error if we had a previous prediction
    if (this.lastPrediction !== null) {
      const error = Math.abs(value - this.lastPrediction);
      this.predictionErrors.push(error);
      
      if (this.predictionErrors.length > this.MAX_ERRORS_TRACKED) {
        this.predictionErrors.shift();
      }
      
      // Use prediction error to optimize parameters - menos frecuente
      if (this.predictionErrors.length >= 8 && this.totalProcessedValues % 2 === 0) {
        const avgError = this.predictionErrors.reduce((sum, e) => sum + e, 0) / 
                        this.predictionErrors.length;
        const score = Math.max(0, 1.0 - avgError / 8.0);
        
        this.bayesianOptimizer.addObservation({
          qualityThreshold: this.options.qualityThreshold || 0.7,
          amplificationFactor: this.options.amplificationFactor || 1.0,
          adaptationRate: this.options.adaptationRate || 0.1,
          filterStrength: this.options.filterStrength || 0.8,
          predictionHorizon: this.options.predictionHorizon || 5
        }, score);
        
        // Menos optimización, cada 15 actualizaciones en lugar de 10
        if (this.buffer.length % 15 === 0) {
          this.optimizeParameters();
        }
      }
    }
    
    // Update GP kernel parameters occasionally - menos frecuente
    if (this.buffer.length % 8 === 0) {
      this.gaussianProcess.updateParameters();
    }
  }

  /**
   * Predict the next value - now more conservative
   */
  public predict(time: number): PredictionResult {
    if (this.buffer.length < 3) {
      return {
        predictedValue: 0,
        filteredValue: 0,
        confidence: 0,
        anomalyScore: 0,
        correctedValue: null,
        signalQuality: 0,
        wasEnhanced: false,
        enhancementAmount: 0
      };
    }
    
    // Use GP to predict
    const gpPrediction = this.gaussianProcess.predict(time);
    
    // Calculate linear prediction as fallback
    const recent = this.buffer.slice(-3);
    const linearPrediction = this.predictLinear(time);
    
    // Detect if the GP prediction might be an anomaly
    const recentValues = this.buffer.slice(-5).map(b => b.value);
    const recentMean = recentValues.reduce((sum, v) => sum + val, 0) / recentValues.length;
    const recentStd = Math.sqrt(
      recentValues.reduce((sum, v) => sum + Math.pow(v - recentMean, 2), 0) / recentValues.length
    );
    
    // Anomaly detection - más conservador
    const deviationFromRecent = Math.abs(gpPrediction.mean - recentMean);
    const anomalyScore = recentStd > 0 ? deviationFromRecent / (recentStd * 3) : 0;
    
    // GP weight reduced for more conservative prediction
    const maxGPWeight = Math.min(0.6, this.options.predictionWeight || 0.3); // Máximo reducido a 0.6 (era 0.9)
    const gpWeight = Math.max(0.2, Math.min(maxGPWeight, gpPrediction.confidence));
    
    // Final prediction is weighted average - más conservador
    const originalValue = recent[recent.length - 1].value;
    const predictedValue = gpPrediction.mean * gpWeight + linearPrediction * (1 - gpWeight);
    
    // Signal quality estimate - aproximación estadística conservadora
    const signalQuality = this.estimateSignalQuality(gpPrediction, anomalyScore);
    
    // Filtered value with limited enhancement
    let filteredValue = originalValue;
    let wasEnhanced = false;
    let enhancementAmount = 0;
    
    // Only enhance if quality is good and anomaly score is low
    if (signalQuality > 50 && anomalyScore < 0.3) {
      // Calculate enhancement but limit it
      const enhancementLimit = this.options.signalEnhancementAmount || 0.5;
      const rawDifference = predictedValue - originalValue;
      const limitedDifference = rawDifference * enhancementLimit;
      
      // Apply limited enhancement
      filteredValue = originalValue + limitedDifference;
      
      // Track enhancement metrics
      wasEnhanced = Math.abs(limitedDifference) > 0.001;
      enhancementAmount = Math.abs(limitedDifference / (Math.abs(originalValue) + 0.001));
      
      if (wasEnhanced) {
        this.valueEnhancedCount++;
        this.totalEnhancementAmount += enhancementAmount;
        
        // Log for transparency
        this.enhancementLog.push({
          timestamp: Date.now(),
          originalValue,
          enhancedValue: filteredValue,
          enhancementType: 'predictive_filter',
          enhancementAmount
        });
        
        // Limitar tamaño del log
        if (this.enhancementLog.length > 50) {
          this.enhancementLog.shift();
        }
      }
    }
    
    // Correct if severe anomaly detected
    let correctedValue = null;
    if (anomalyScore > this.anomalyThreshold) {
      this.anomalyCount++;
      correctedValue = linearPrediction; // Usar predicción lineal como corrección
    } else {
      this.anomalyCount = Math.max(0, this.anomalyCount - 1);
    }
    
    // Store for error tracking
    this.lastPrediction = predictedValue;
    
    return {
      predictedValue,
      filteredValue, // Este es el valor con mejora limitada
      confidence: gpPrediction.confidence,
      anomalyScore,
      correctedValue,
      signalQuality,
      wasEnhanced,
      enhancementAmount
    };
  }

  /**
   * Estimate signal quality based on prediction metrics
   */
  private estimateSignalQuality(gpPrediction: GPPrediction, anomalyScore: number): number {
    // Calculate quality based on buffer
    const bufferQuality = this.buffer.length > 0 ? 
      this.buffer.slice(-5).reduce((sum, b) => sum + b.quality, 0) / 
      Math.min(5, this.buffer.length) : 0;
    
    // Calculate confidence penalty based on anomaly score
    const anomalyPenalty = Math.max(0, 1 - anomalyScore * 2);
    
    // Calculate quality from GP prediction confidence
    const gpQuality = gpPrediction.confidence * 0.8;
    
    // Weighted quality estimate
    const quality = (
      bufferQuality * 0.5 + 
      gpQuality * 0.3 + 
      anomalyPenalty * 0.2
    ) * 100;
    
    return Math.min(100, Math.max(0, quality));
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
   * Now more cautious with parameter updates
   */
  private optimizeParameters(): void {
    const nextParams = this.bayesianOptimizer.suggestNextParameters();
    
    // Only update if expected improvement is significant - umbral más alto
    if (nextParams.expectedImprovement > 0.3) { // Era 0.2
      const currentParams = {
        qualityThreshold: this.options.qualityThreshold || 0.7,
        amplificationFactor: this.options.amplificationFactor || 1.0,
        adaptationRate: this.options.adaptationRate || 0.1,
        filterStrength: this.options.filterStrength || 0.8,
        predictionHorizon: this.options.predictionHorizon || 5
      };
      
      // Gradually adapt parameters - más gradual
      Object.keys(nextParams.parameters).forEach(key => {
        const current = currentParams[key];
        const suggested = nextParams.parameters[key];
        
        // Use lower adaptation rate to smooth changes
        this.options[key] = current * (1 - this.adaptationRate * 0.5) + 
                           suggested * this.adaptationRate * 0.5;
      });
      
      console.log("AdaptivePredictor: Updated parameters (conservative mode)", {
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
   * More conservative correction approach
   */
  public correctAnomaly(time: number, value: number, quality: number): number {
    if (this.buffer.length < 5) return value;
    
    // Predict what the value should be
    const prediction = this.predict(time);
    
    // If high anomaly score and low quality, correct the value - más restrictivo
    if (prediction.anomalyScore > this.anomalyThreshold && quality < 0.5) { // Era 0.6
      // Calculate correction but limit its amount
      const correctionLimit = this.options.signalEnhancementAmount || 0.5;
      const rawDifference = prediction.predictedValue - value;
      const limitedDifference = rawDifference * correctionLimit;
      
      // Apply limited correction
      const correctedValue = value + limitedDifference;
      
      console.log("AdaptivePredictor: Correcting anomaly (limited mode)", {
        original: value.toFixed(2),
        corrected: correctedValue.toFixed(2),
        anomalyScore: prediction.anomalyScore.toFixed(2),
        correctionLimit: correctionLimit.toFixed(2),
        quality
      });
      
      // Log for transparency
      this.enhancementLog.push({
        timestamp: Date.now(),
        originalValue: value,
        enhancedValue: correctedValue,
        enhancementType: 'anomaly_correction',
        enhancementAmount: Math.abs(limitedDifference / (Math.abs(value) + 0.001))
      });
      
      return correctedValue;
    }
    
    return value;
  }

  /**
   * Calculate the probability that a signal contains an artifact
   * More conservative assessment
   */
  public calculateArtifactProbability(): number {
    if (this.buffer.length < 10) return 0;
    
    // Use recent prediction errors and anomaly count
    const avgPredictionError = this.predictionErrors.length > 0 ? 
      this.predictionErrors.reduce((sum, e) => sum + e, 0) / this.predictionErrors.length : 0;
    
    // Normalize and combine factors - más conservador
    const errorFactor = Math.min(1, avgPredictionError / 8); // Era 10
    const anomalyFactor = Math.min(1, this.anomalyCount / 8); // Era 5
    
    return (errorFactor * 0.5 + anomalyFactor * 0.5); // Ponderación más equilibrada
  }

  /**
   * Get the current state of the adaptive model with transparency metrics
   */
  public getState(): AdaptiveModelState {
    const avgQuality = this.buffer.length > 0 ? 
      this.buffer.reduce((sum, b) => sum + b.quality, 0) / this.buffer.length : 0;
    
    const qualityVariation = this.buffer.length > 1 ? 
      Math.sqrt(this.buffer.reduce((sum, b) => sum + Math.pow(b.quality - avgQuality, 2), 0) / this.buffer.length) : 0;
    
    const avgPredictionError = this.predictionErrors.length > 0 ? 
      this.predictionErrors.reduce((sum, e) => sum + e, 0) / this.predictionErrors.length : 0;
    
    // Calculate confidence in prediction
    const errorNormalized = Math.min(1, avgPredictionError / 8); // Era 10
    const predictionConfidence = 1.0 - errorNormalized;
    
    // Get latest optimized parameters
    const bestParams = this.bayesianOptimizer.getBestParameters() || {};
    
    // Calculate transparency metrics
    const enhancementRate = this.totalProcessedValues > 0 ? 
      this.valueEnhancedCount / this.totalProcessedValues : 0;
    
    const avgEnhancement = this.valueEnhancedCount > 0 ? 
      this.totalEnhancementAmount / this.valueEnhancedCount : 0;
    
    return {
      bufferSize: this.buffer.length,
      averageQuality: avgQuality,
      qualityStability: 1.0 - Math.min(1, qualityVariation),
      averagePredictionError: avgPredictionError,
      predictionConfidence,
      optimizedParameters: bestParams,
      improvementRate: this.adaptationRate,
      // Nuevas métricas de transparencia
      enhancementRate,
      averageEnhancementAmount: avgEnhancement
    };
  }

  /**
   * Get enhancement log for transparency
   */
  public getEnhancementLog(): Array<{
    timestamp: number,
    originalValue: number,
    enhancedValue: number,
    enhancementType: string,
    enhancementAmount: number
  }> {
    return [...this.enhancementLog];
  }

  /**
   * Configure the predictor with more options for control
   */
  public configure(options: SignalProcessingOptions): void {
    this.options = {...this.options, ...options};
    
    // Update related parameters
    if (options.adaptationRate !== undefined) {
      this.adaptationRate = options.adaptationRate;
    }
    
    // Limit enhancement if requested
    if (options.signalEnhancementAmount !== undefined) {
      this.options.signalEnhancementAmount = Math.max(0.2, Math.min(0.8, options.signalEnhancementAmount));
    }
    
    console.log("AdaptivePredictor: Configured with conservative options", this.options);
  }

  /**
   * Process a value with limited enhancement
   */
  public processValue(value: number): PredictionResult {
    const now = Date.now();
    
    // Update the model with the current value
    this.update(now, value, 0.7); // Calidad conservadora por defecto
    
    // Get prediction
    return this.predict(now);
  }

  /**
   * Reset the predictor state
   */
  public reset(): void {
    this.buffer.length = 0;
    this.predictionErrors.length = 0;
    this.lastPrediction = null;
    this.anomalyCount = 0;
    this.enhancementLog = [];
    this.valueEnhancedCount = 0;
    this.totalEnhancementAmount = 0;
    this.totalProcessedValues = 0;
    
    this.gaussianProcess.reset();
    this.bayesianOptimizer.reset();
    
    console.log("AdaptivePredictor: Reset with conservative settings");
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

/**
 * Crea una nueva instancia con configuración conservadora
 */
export function createAdaptivePredictor(): AdaptivePredictor {
  return new AdaptivePredictor();
}

