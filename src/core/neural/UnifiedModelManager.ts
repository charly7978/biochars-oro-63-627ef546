
import { BaseNeuralModel } from './NeuralNetworkBase';
import { HeartRateNeuralModel } from './HeartRateModel';
import { SpO2NeuralModel } from './SpO2Model';
import { BloodPressureNeuralModel } from './BloodPressureModel';
import { ArrhythmiaNeuralModel } from './ArrhythmiaModel';
import { GlucoseNeuralModel } from './GlucoseModel';
import { TensorFlowService } from '../ml/tensorflow-service';
import { ProcessorConfig } from '../config/ProcessorConfig';
import { container } from '../di/service-container';

/**
 * Unified Neural Model Manager
 * Provides centralized management for all neural network models
 * with WebGPU acceleration and consistent interface
 */
export class UnifiedModelManager {
  private static instance: UnifiedModelManager;
  private models: Map<string, BaseNeuralModel> = new Map();
  private modelInitialized: Map<string, boolean> = new Map();
  private tfService: TensorFlowService | null = null;
  private config: ProcessorConfig;
  
  private constructor(config: ProcessorConfig) {
    this.config = config;
    
    // Register available models
    this.registerModel('heartRate', () => new HeartRateNeuralModel());
    this.registerModel('spo2', () => new SpO2NeuralModel());
    this.registerModel('bloodPressure', () => new BloodPressureNeuralModel());
    this.registerModel('arrhythmia', () => new ArrhythmiaNeuralModel());
    this.registerModel('glucose', () => new GlucoseNeuralModel());
  }
  
  /**
   * Get singleton instance of the model manager
   */
  public static getInstance(config?: ProcessorConfig): UnifiedModelManager {
    if (!UnifiedModelManager.instance) {
      if (!config) {
        throw new Error('Configuration required for initial model manager creation');
      }
      UnifiedModelManager.instance = new UnifiedModelManager(config);
    }
    return UnifiedModelManager.instance;
  }
  
  /**
   * Initialize TensorFlow service
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create TensorFlow service if not already available
      if (!this.tfService) {
        this.tfService = new TensorFlowService(this.config);
        await this.tfService.initialize();
        
        // Register in container
        container.register('tensorflowService', this.tfService);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow services:', error);
      return false;
    }
  }
  
  /**
   * Preload all models to improve startup performance
   */
  public async preloadModels(): Promise<boolean> {
    if (!this.tfService) {
      await this.initialize();
    }
    
    if (!this.tfService) {
      return false;
    }
    
    try {
      const modelUrls = {
        'heartRate': this.config.neuralNetworks.heartRateModelUrl,
        'spo2': this.config.neuralNetworks.spo2ModelUrl,
        'bloodPressure': this.config.neuralNetworks.bloodPressureModelUrl,
        'arrhythmia': this.config.neuralNetworks.arrhythmiaModelUrl,
        'glucose': this.config.neuralNetworks.glucoseModelUrl
      };
      
      // Load models in parallel
      const loadPromises = Object.entries(modelUrls).map(
        async ([key, url]) => {
          return this.tfService!.loadModel(key, url);
        }
      );
      
      await Promise.all(loadPromises);
      
      // Mark all models as initialized
      for (const key of Object.keys(modelUrls)) {
        this.modelInitialized.set(key, true);
      }
      
      console.log('All neural models preloaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to preload neural models:', error);
      return false;
    }
  }
  
  /**
   * Register a model factory
   */
  private registerModel(id: string, factory: () => BaseNeuralModel): void {
    this.models.set(id, factory());
    this.modelInitialized.set(id, false);
  }
  
  /**
   * Get a model by ID, initializing if necessary
   */
  public getModel<T extends BaseNeuralModel>(id: string): T | null {
    const model = this.models.get(id) as T;
    if (!model) return null;
    
    // Initialize model if first use
    if (!this.modelInitialized.get(id)) {
      console.log(`Initializing model: ${id}`);
      this.modelInitialized.set(id, true);
    }
    
    return model;
  }
  
  /**
   * Process data through a neural model
   */
  public async processData(
    id: string, 
    signalData: number[]
  ): Promise<Float32Array | null> {
    if (!this.tfService) {
      await this.initialize();
    }
    
    if (!this.tfService) {
      return null;
    }
    
    // Get model URL from config
    const modelUrls: {[key: string]: string} = {
      'heartRate': this.config.neuralNetworks.heartRateModelUrl,
      'spo2': this.config.neuralNetworks.spo2ModelUrl,
      'bloodPressure': this.config.neuralNetworks.bloodPressureModelUrl,
      'arrhythmia': this.config.neuralNetworks.arrhythmiaModelUrl,
      'glucose': this.config.neuralNetworks.glucoseModelUrl
    };
    
    const url = modelUrls[id];
    if (!url) {
      console.error(`No URL configured for model: ${id}`);
      return null;
    }
    
    // Auto-load model if not already loaded
    await this.tfService.loadModel(id, url);
    
    // Process data through TensorFlow
    return this.tfService.processSignal(signalData, id);
  }
  
  /**
   * Reset specific model or all models
   */
  public resetModels(specificId?: string): void {
    if (specificId) {
      const model = this.models.get(specificId);
      if (model) {
        console.log(`Resetting specific model: ${specificId}`);
        this.models.set(specificId, new (Object.getPrototypeOf(model).constructor)());
        this.modelInitialized.set(specificId, false);
      }
    } else {
      // Reset all models
      console.log('Resetting all models');
      const modelIds = Array.from(this.models.keys());
      for (const id of modelIds) {
        const model = this.models.get(id);
        if (model) {
          this.models.set(id, new (Object.getPrototypeOf(model).constructor)());
          this.modelInitialized.set(id, false);
        }
      }
    }
  }
  
  /**
   * Get information about all registered models
   */
  public getModelInfo(): Array<{
    id: string;
    name: string;
    version: string;
    initialized: boolean;
    architecture: string;
    accelerated: boolean;
  }> {
    const isWebGPU = this.tfService?.getBackend?.() === 'webgpu';
    
    return Array.from(this.models.entries()).map(([id, model]) => ({
      id,
      name: model.getModelInfo().name,
      version: model.getModelInfo().version,
      initialized: this.modelInitialized.get(id) || false,
      architecture: model.architecture,
      accelerated: isWebGPU
    }));
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProcessorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update TensorFlow service if already initialized
    if (this.tfService) {
      // We can't update the existing service, but we can mark models 
      // for reinitialization on next use
      for (const id of this.models.keys()) {
        this.modelInitialized.set(id, false);
      }
    }
  }
  
  /**
   * Release resources
   */
  public dispose(): void {
    // Clean up models
    this.models.clear();
    this.modelInitialized.clear();
    
    // Dispose TensorFlow service
    if (this.tfService) {
      this.tfService.dispose();
      this.tfService = null;
    }
  }
}

/**
 * Utility function for quick access to models
 */
export function getModel<T extends BaseNeuralModel>(id: string): T | null {
  const manager = container.get<UnifiedModelManager>('modelManager');
  if (!manager) {
    console.warn('Model manager not initialized in container');
    return null;
  }
  return manager.getModel<T>(id);
}

/**
 * Utility function for directly processing data through a model
 */
export async function processWithModel(
  id: string, 
  signalData: number[]
): Promise<Float32Array | null> {
  const manager = container.get<UnifiedModelManager>('modelManager');
  if (!manager) {
    console.warn('Model manager not initialized in container');
    return null;
  }
  return manager.processData(id, signalData);
}
