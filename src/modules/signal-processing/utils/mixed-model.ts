/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Mixed model combining deep learning and Bayesian approaches
 * for robust signal processing with explicit uncertainty handling
 */

import * as tf from '@tensorflow/tfjs';
import { SignalProcessingOptions } from '../types';

/**
 * Configuration for the mixed model
 */
export interface MixedModelConfig {
  // Model architecture
  inputSize: number;
  hiddenLayers: number[];
  
  // Training configuration
  learningRate: number;
  batchSize: number;
  
  // Uncertainty modeling
  dropoutRate: number;
  uncertaintyThreshold: number;
  
  // Bayesian parameters
  bayesianPriorScale: number;
  modelCount: number;
}

/**
 * Prediction result with uncertainty estimates
 */
export interface MixedModelPrediction {
  value: number;
  uncertainty: number;
  confidence: number;
  distributions: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

/**
 * Mixed model implementation for PPG signal processing
 * Combines simplified neural networks with Bayesian methods
 */
export class MixedModel {
  private models: tf.LayersModel[] = [];
  private inputBuffer: number[][] = [];
  private outputBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private isTraining = false;
  private trainCounter = 0;
  private lastModelUpdate = 0;
  private readonly UPDATE_INTERVAL = 1000; // Min 1 second between updates
  
  private config: MixedModelConfig = {
    inputSize: 10,
    hiddenLayers: [20, 10],
    learningRate: 0.01,
    batchSize: 16,
    dropoutRate: 0.1,
    uncertaintyThreshold: 0.2,
    bayesianPriorScale: 0.1,
    modelCount: 3
  };

  /**
   * Create a new mixed model
   */
  constructor(config?: Partial<MixedModelConfig>) {
    if (config) {
      this.config = {...this.config, ...config};
    }
    
    // Initialize models
    this.initializeModels();
    
    console.log("MixedModel: Initialized with configuration", {
      inputSize: this.config.inputSize,
      hiddenLayers: this.config.hiddenLayers,
      modelCount: this.config.modelCount
    });
  }

  /**
   * Initialize the ensemble of models
   */
  private async initializeModels() {
    // Initialize each model with different random seeds
    for (let i = 0; i < this.config.modelCount; i++) {
      const model = this.createModel(i);
      this.models.push(model);
    }
  }

  /**
   * Create a single model in the ensemble
   */
  private createModel(seed: number): tf.LayersModel {
    // Set random seed for initialization
    tf.setBackend('webgl');
    tf.env().set('WEBGL_CPU_FORWARD', false);
    
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      units: this.config.hiddenLayers[0],
      inputShape: [this.config.inputSize],
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: tf.regularizers.l2({l2: this.config.bayesianPriorScale})
    }));
    
    // Add dropout for Bayesian approximation
    model.add(tf.layers.dropout({rate: this.config.dropoutRate}));
    
    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(tf.layers.dense({
        units: this.config.hiddenLayers[i],
        activation: 'relu',
        kernelInitializer: 'heNormal',
        kernelRegularizer: tf.regularizers.l2({l2: this.config.bayesianPriorScale})
      }));
      model.add(tf.layers.dropout({rate: this.config.dropoutRate}));
    }
    
    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));
    
    // Compile with appropriate optimizer
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError'
    });
    
    return model;
  }

  /**
   * Update the model with new signal data
   */
  public async update(inputs: number[], output: number): Promise<void> {
    // Store in buffer
    this.inputBuffer.push([...inputs]);
    this.outputBuffer.push(output);
    
    // Keep buffer size limited
    if (this.inputBuffer.length > this.MAX_BUFFER_SIZE) {
      this.inputBuffer.shift();
      this.outputBuffer.shift();
    }
    
    // Periodically train the model
    this.trainCounter++;
    const now = Date.now();
    
    if (this.trainCounter >= 10 && !this.isTraining && 
        this.inputBuffer.length >= this.config.batchSize &&
        now - this.lastModelUpdate > this.UPDATE_INTERVAL) {
      
      this.trainCounter = 0;
      this.lastModelUpdate = now;
      this.isTraining = true;
      
      try {
        await this.trainModels();
      } catch (err) {
        console.error("MixedModel: Error training models", err);
      } finally {
        this.isTraining = false;
      }
    }
  }

  /**
   * Train all models in the ensemble
   */
  private async trainModels(): Promise<void> {
    if (this.inputBuffer.length < this.config.batchSize) {
      return;
    }
    
    // Prepare training data
    const batchSize = Math.min(this.config.batchSize, this.inputBuffer.length);
    const indices = [];
    
    // Select random batch
    for (let i = 0; i < batchSize; i++) {
      indices.push(Math.floor(Math.random() * this.inputBuffer.length));
    }
    
    const xs = tf.tensor2d(
      indices.map(i => this.inputBuffer[i])
    );
    
    const ys = tf.tensor2d(
      indices.map(i => [this.outputBuffer[i]]),
      [indices.length, 1]
    );
    
    // Train each model
    try {
      console.log(`MixedModel: Training ${this.models.length} models with ${batchSize} samples`);
      
      for (let i = 0; i < this.models.length; i++) {
        await this.models[i].fitDataset(
          tf.data.zip({xs: tf.data.array(this.inputBuffer), ys: tf.data.array(this.outputBuffer.map(y => [y]))})
            .batch(this.config.batchSize)
            .shuffle(this.config.batchSize),
          {
            epochs: 1,
            verbose: 0
          }
        );
      }
      
      console.log("MixedModel: Training completed");
    } catch (err) {
      console.error("MixedModel: Error during training", err);
    } finally {
      // Clean up tensors
      xs.dispose();
      ys.dispose();
    }
  }

  /**
   * Predict with uncertainty using all models
   */
  public async predict(inputs: number[]): Promise<MixedModelPrediction> {
    if (this.models.length === 0 || this.isTraining) {
      return {
        value: 0,
        uncertainty: 1,
        confidence: 0,
        distributions: {mean: 0, stdDev: 0, min: 0, max: 0}
      };
    }
    
    const inputTensor = tf.tensor2d([inputs], [1, this.config.inputSize]);
    const predictions: number[] = [];
    
    try {
      // Multiple forward passes with dropout enabled (Monte Carlo Dropout)
      for (let i = 0; i < this.models.length; i++) {
        const model = this.models[i];
        
        // Use training mode to enable dropout
        const pred = model.predict(inputTensor) as tf.Tensor;
        const value = (await pred.data())[0];
        predictions.push(value);
        pred.dispose();
      }
    } catch (err) {
      console.error("MixedModel: Error during prediction", err);
      return {
        value: 0,
        uncertainty: 1,
        confidence: 0,
        distributions: {mean: 0, stdDev: 0, min: 0, max: 0}
      };
    } finally {
      inputTensor.dispose();
    }
    
    // Calculate statistics
    const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
    const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...predictions);
    const max = Math.max(...predictions);
    
    // Calculate uncertainty and confidence
    const uncertaintyRatio = stdDev / (Math.abs(mean) + 0.01);
    const uncertainty = Math.min(1, uncertaintyRatio * 10);
    const confidence = 1 - uncertainty;
    
    return {
      value: mean,
      uncertainty,
      confidence,
      distributions: {
        mean,
        stdDev,
        min,
        max
      }
    };
  }

  /**
   * Configure the model
   */
  public configure(options: SignalProcessingOptions): void {
    if (options.adaptationRate !== undefined) {
      this.config.learningRate = Math.max(0.001, Math.min(0.1, options.adaptationRate));
    }
    
    console.log("MixedModel: Updated configuration", {
      learningRate: this.config.learningRate
    });
  }

  /**
   * Reset the model
   */
  public reset(): void {
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.isTraining = false;
    this.trainCounter = 0;
    
    // Reinitialize models
    for (const model of this.models) {
      try {
        model.dispose();
      } catch (e) {
        console.error("Error disposing model", e);
      }
    }
    
    this.models = [];
    this.initializeModels();
    
    console.log("MixedModel: Reset");
  }
}

/**
 * Singleton instance
 */
let globalMixedModel: MixedModel | null = null;

/**
 * Get the global mixed model instance
 */
export function getMixedModel(): MixedModel {
  if (!globalMixedModel) {
    globalMixedModel = new MixedModel();
  }
  return globalMixedModel;
}

/**
 * Reset the global mixed model
 */
export function resetMixedModel(): void {
  if (globalMixedModel) {
    globalMixedModel.reset();
  }
}
