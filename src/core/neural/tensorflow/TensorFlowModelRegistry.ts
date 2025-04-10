
/**
 * TensorFlow Model Registry
 * Manages TensorFlow.js models for various vital signs processing
 */
export interface TensorFlowModel {
  id: string;
  name: string;
  version: string;
  architecture: string;
  loaded: boolean;
}

class TensorFlowModelRegistry {
  private models: Map<string, TensorFlowModel> = new Map();
  private isInitialized: boolean = false;
  
  constructor() {
    // Initialize with default models
    this.registerModel({
      id: 'ppg-processor',
      name: 'PPG Signal Processor',
      version: '1.0',
      architecture: 'CNN',
      loaded: false
    });
    
    this.registerModel({
      id: 'arrhythmia-detector',
      name: 'Arrhythmia Detector',
      version: '1.0',
      architecture: 'LSTM',
      loaded: false
    });
  }
  
  /**
   * Register a new model in the registry
   */
  registerModel(model: TensorFlowModel): void {
    this.models.set(model.id, model);
  }
  
  /**
   * Get a model by ID
   */
  getModel(id: string): TensorFlowModel | undefined {
    return this.models.get(id);
  }
  
  /**
   * Get all registered models
   */
  getAllModels(): TensorFlowModel[] {
    return Array.from(this.models.values());
  }
  
  /**
   * Initialize all models
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    console.log("TensorFlowModelRegistry: Initializing models");
    
    // Mark all models as loaded for now (actual loading would happen here)
    for (const model of this.models.values()) {
      model.loaded = true;
    }
    
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Check if all models are loaded
   */
  isReady(): boolean {
    return this.isInitialized && 
      Array.from(this.models.values()).every(model => model.loaded);
  }
}

// Singleton instance
export const tensorFlowModelRegistry = new TensorFlowModelRegistry();
export default tensorFlowModelRegistry;
