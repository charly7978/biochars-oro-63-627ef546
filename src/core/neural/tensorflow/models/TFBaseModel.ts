
import * as tf from '@tensorflow/tfjs';

/**
 * Options for TensorFlow model configuration
 */
export interface TFModelOptions {
  inputSize: number;
  useWebGL?: boolean;
  useBatchNorm?: boolean;
  useQuantization?: boolean;
  useRegularization?: boolean;
}

/**
 * Base class for TensorFlow.js models
 */
export abstract class TFBaseModel {
  protected model: tf.LayersModel | null = null;
  protected isLoaded: boolean = false;
  protected inputSize: number;
  protected options: TFModelOptions;
  protected lastPredictionTime: number = 0;
  
  constructor(options: TFModelOptions) {
    this.options = options;
    this.inputSize = options.inputSize;
  }
  
  /**
   * Initialize model - load or create
   */
  public async initialize(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      console.log(`Initializing ${this.getModelName()} model with input size ${this.inputSize}`);
      
      // Attempt to load pretrained model
      const model = await this.loadModel();
      
      if (model) {
        this.model = model;
        console.log(`Loaded pretrained ${this.getModelName()} model`);
      } else {
        // Create model architecture if no pretrained model available
        this.model = await this.createModel();
        console.log(`Created new ${this.getModelName()} model`);
      }
      
      // Compile the model
      this.compileModel();
      
      this.isLoaded = true;
      
      // Log model summary
      this.logModelSummary();
    } catch (error) {
      console.error(`Error initializing ${this.getModelName()} model:`, error);
      throw error;
    }
  }
  
  /**
   * Get the name of the model
   */
  abstract getModelName(): string;
  
  /**
   * Create model architecture
   */
  protected abstract createModel(): Promise<tf.LayersModel>;
  
  /**
   * Load pretrained model weights
   */
  protected abstract loadModel(): Promise<tf.LayersModel | null>;
  
  /**
   * Compile the model with appropriate optimizer and loss
   */
  protected abstract compileModel(): void;
  
  /**
   * Make prediction with the model
   */
  public abstract predict(input: number[]): Promise<number[]>;
  
  /**
   * Log model summary information
   */
  protected logModelSummary(): void {
    if (!this.model) return;
    
    const totalParams = this.getTotalParams();
    
    console.log(`${this.getModelName()} model summary:`);
    console.log(`- Total parameters: ${totalParams}`);
    console.log(`- Input shape: ${JSON.stringify(this.model.inputs[0].shape)}`);
    console.log(`- Output shape: ${JSON.stringify(this.model.outputs[0].shape)}`);
  }
  
  /**
   * Get total parameter count
   */
  protected getTotalParams(): number {
    let total = 0;
    if (this.model) {
      this.model.weights.forEach(w => {
        total += w.shape.reduce((a, b) => a * b, 1);
      });
    }
    return total;
  }
  
  /**
   * Dispose of model resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isLoaded = false;
  }
}
