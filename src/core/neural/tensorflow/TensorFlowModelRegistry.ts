
import { ModelRegistry } from '../ModelRegistry';

/**
 * TensorFlow Model Type definition
 */
export interface TensorFlowModel {
  id: string;
  name: string;
  version: string;
  architecture: string;
}

/**
 * TensorFlow Model Registry
 * Manages loading and initialization of TensorFlow.js models
 */
class TensorFlowModelRegistry implements ModelRegistry {
  private models: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  private modelInitialized: Map<string, boolean> = new Map();
  
  /**
   * Initialize TensorFlow.js models
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log("TensorFlowModelRegistry: Already initialized");
      return true;
    }
    
    try {
      console.log("TensorFlowModelRegistry: Initializing models");
      
      // Simulate model loading for now
      await new Promise(resolve => setTimeout(resolve, 200));
      
      this.isInitialized = true;
      console.log("TensorFlowModelRegistry: Models initialized successfully");
      return true;
    } catch (error) {
      console.error("TensorFlowModelRegistry: Error initializing models", error);
      return false;
    }
  }
  
  /**
   * Get a model by ID
   */
  getModel<T>(id: string): T | null {
    if (!this.isInitialized) {
      console.warn("TensorFlowModelRegistry: Models not initialized");
      return null;
    }
    
    return this.models.get(id) as T || null;
  }
  
  /**
   * Register a model
   */
  registerModel(id: string, model: any): void {
    this.models.set(id, model);
  }
  
  /**
   * Check if the registry is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Get all available models
   */
  getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }
  
  /**
   * Get all models with their metadata
   */
  getAllModels(): TensorFlowModel[] {
    return Array.from(this.models.entries()).map(([id, model]) => ({
      id,
      name: model?.name || "Unknown model",
      version: model?.version || "1.0.0",
      architecture: model?.architecture || "TensorFlow.js"
    }));
  }
  
  /**
   * Reset models
   */
  resetModels(specificId?: string): void {
    if (specificId) {
      this.models.delete(specificId);
      this.modelInitialized.set(specificId, false);
    } else {
      this.models.clear();
      this.modelInitialized.clear();
      this.isInitialized = false;
    }
  }
  
  /**
   * Get model info
   */
  getModelInfo(): Array<{
    id: string;
    name: string;
    version: string;
    initialized: boolean;
    architecture: string;
  }> {
    return Array.from(this.models.entries()).map(([id, model]) => ({
      id,
      name: model?.name || "Unknown model",
      version: model?.version || "1.0.0",
      initialized: this.modelInitialized.get(id) || false,
      architecture: model?.architecture || "TensorFlow.js"
    }));
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.models.clear();
    this.modelInitialized.clear();
    this.isInitialized = false;
  }
}

// Create singleton instance
const tensorFlowModelRegistry = new TensorFlowModelRegistry();
export default tensorFlowModelRegistry;
