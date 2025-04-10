
import { ModelRegistry } from '../ModelRegistry';

/**
 * TensorFlow Model Registry
 * Manages loading and initialization of TensorFlow.js models
 */
class TensorFlowModelRegistry implements ModelRegistry {
  private models: Map<string, any> = new Map();
  private isInitialized: boolean = false;
  
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
}

// Create singleton instance
const tensorFlowModelRegistry = new TensorFlowModelRegistry();
export default tensorFlowModelRegistry;
