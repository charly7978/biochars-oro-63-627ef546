
import { TensorFlowService } from './tensorflow-service';
import { ProcessorConfig } from '../config/ProcessorConfig';

// Define model types
export type ModelType = 'heartRate' | 'spo2' | 'bloodPressure' | 'arrhythmia' | 'glucose';

// Neural network configuration
interface ModelConfig {
  key: string;
  url: string;
  inputLength: number;
  outputLength: number;
}

/**
 * Unified neural network processor for all vital signs
 * Single entry point for all ML operations with dependency injection
 */
export class NeuralNetworkProcessor {
  private tfService: TensorFlowService;
  private isInitialized: boolean = false;
  private modelConfigs: Map<ModelType, ModelConfig> = new Map();
  
  // Buffer for signal history to improve prediction stability
  private signalBuffer: Map<ModelType, number[]> = new Map();
  private readonly bufferSizes: Map<ModelType, number> = new Map([
    ['heartRate', 150],
    ['spo2', 100],
    ['bloodPressure', 200],
    ['arrhythmia', 120],
    ['glucose', 250]
  ]);
  
  constructor(tfService: TensorFlowService, config: ProcessorConfig) {
    this.tfService = tfService;
    this.setupModelConfigs(config);
  }
  
  /**
   * Configure all neural network models
   */
  private setupModelConfigs(config: ProcessorConfig): void {
    // Setup model configurations from provided configuration
    this.modelConfigs.set('heartRate', {
      key: 'heartRate',
      url: config.neuralNetworks.heartRateModelUrl,
      inputLength: 150,
      outputLength: 2 // BPM and confidence
    });
    
    this.modelConfigs.set('spo2', {
      key: 'spo2',
      url: config.neuralNetworks.spo2ModelUrl,
      inputLength: 100,
      outputLength: 1
    });
    
    this.modelConfigs.set('bloodPressure', {
      key: 'bloodPressure',
      url: config.neuralNetworks.bloodPressureModelUrl,
      inputLength: 200,
      outputLength: 2 // Systolic and diastolic
    });
    
    this.modelConfigs.set('arrhythmia', {
      key: 'arrhythmia',
      url: config.neuralNetworks.arrhythmiaModelUrl,
      inputLength: 120,
      outputLength: 1 // Probability of arrhythmia
    });
    
    this.modelConfigs.set('glucose', {
      key: 'glucose',
      url: config.neuralNetworks.glucoseModelUrl,
      inputLength: 250,
      outputLength: 1
    });
    
    // Initialize signal buffers
    for (const modelType of this.modelConfigs.keys()) {
      this.signalBuffer.set(modelType, []);
    }
  }
  
  /**
   * Initialize all models
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Initialize TensorFlow service
      await this.tfService.initialize();
      
      // Preload models
      const loadPromises = Array.from(this.modelConfigs.entries()).map(
        async ([type, config]) => {
          return this.tfService.loadModel(config.key, config.url);
        }
      );
      
      await Promise.all(loadPromises);
      
      this.isInitialized = true;
      console.log('Neural network processor initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize neural network processor:', error);
      return false;
    }
  }
  
  /**
   * Update signal buffer for a specific model type
   */
  public updateSignalBuffer(modelType: ModelType, value: number): void {
    const buffer = this.signalBuffer.get(modelType) || [];
    buffer.push(value);
    
    const maxSize = this.bufferSizes.get(modelType) || 100;
    if (buffer.length > maxSize) {
      buffer.shift();
    }
    
    this.signalBuffer.set(modelType, buffer);
  }
  
  /**
   * Process signal for a specific vital sign
   */
  public async processSignal(modelType: ModelType, value: number): Promise<number[] | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Update buffer for this model type
    this.updateSignalBuffer(modelType, value);
    
    const buffer = this.signalBuffer.get(modelType) || [];
    const config = this.modelConfigs.get(modelType);
    
    if (!config) {
      console.error(`No configuration for model type: ${modelType}`);
      return null;
    }
    
    // Check if we have enough data
    if (buffer.length < config.inputLength) {
      // Not enough data yet
      return null;
    }
    
    // Get the required number of values from the buffer
    const inputData = buffer.slice(-config.inputLength);
    
    // Process through TensorFlow
    const resultArray = await this.tfService.processSignal(
      inputData,
      config.key,
      [1, config.inputLength]
    );
    
    if (!resultArray) {
      return null;
    }
    
    // Convert to regular array and return
    return Array.from(resultArray).slice(0, config.outputLength);
  }
  
  /**
   * Reset all signal buffers
   */
  public reset(): void {
    for (const modelType of this.modelConfigs.keys()) {
      this.signalBuffer.set(modelType, []);
    }
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.tfService.dispose();
    this.isInitialized = false;
    this.reset();
  }
}
