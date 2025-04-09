
import * as tf from '@tensorflow/tfjs';
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * TensorFlow.js service for neural network processing
 * Provides unified interface for all ML operations with WebGPU acceleration
 */
export class TensorFlowService {
  private modelCache: Map<string, tf.LayersModel> = new Map();
  private isInitialized: boolean = false;
  private useWebGPU: boolean = false;
  private config: ProcessorConfig;
  private initPromise: Promise<boolean> | null = null;
  private lastPerformanceLog: number = 0;
  private deviceCalibrationFactor: number = 1.0;
  private realDeviceProfile: {
    name: string;
    performance: number;
    memory: number;
    customParams: Map<string, number>;
  } | null = null;

  constructor(config: ProcessorConfig) {
    this.config = config;
  }

  /**
   * Initialize TensorFlow.js with WebGPU if available
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    // Use promise caching to prevent multiple simultaneous initializations
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._initializeInternal();
    return this.initPromise;
  }
  
  private async _initializeInternal(): Promise<boolean> {
    try {
      console.log('TensorFlow.js initializing...');
      
      // Create a real device profile based on capabilities
      await this.createDeviceProfile();
      
      // Check if WebGPU is available with more reliable detection
      if (this.config.useWebGPU && await this.isWebGPUAvailable()) {
        // Apply optimal memory settings before setting backend
        tf.env().set('WEBGPU_USE_PROGRAM_CACHE', true);
        tf.env().set('WEBGPU_CPU_FORWARD', false);
        
        // Additional WebGPU optimizations based on device profile
        if (this.realDeviceProfile && this.realDeviceProfile.performance > 0.7) {
          // High performance devices get additional optimizations
          tf.env().set('WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE', 8);
        }
        
        await tf.setBackend('webgpu');
        this.useWebGPU = true;
        console.log('TensorFlow.js using WebGPU acceleration with optimized settings');
      } else {
        // WebGL fallback with optimized settings
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_CPU_FORWARD', false);
        tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
        
        await tf.setBackend('webgl');
        console.log('TensorFlow.js using WebGL fallback with optimized settings');
      }
      
      await tf.ready();
      this.isInitialized = true;
      
      // Set device calibration factor based on detected capabilities
      this.setDeviceCalibrationFactor();
      
      console.log(`TensorFlow.js initialized. Version: ${tf.version.tfjs}, Backend: ${this.getBackend()}, Calibration: ${this.deviceCalibrationFactor.toFixed(2)}, Device: ${this.realDeviceProfile?.name || 'Unknown'}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      return false;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Create a real device profile based on hardware capabilities
   */
  private async createDeviceProfile(): Promise<void> {
    const ua = navigator.userAgent;
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 2;
    let deviceName = 'Generic Device';
    let performanceScore = 0.5;
    const customParams = new Map<string, number>();
    
    // Detect device type and capabilities
    if (/iPhone|iPad|iPod/.test(ua)) {
      // iOS device detection with model estimation
      const matches = ua.match(/iPhone OS (\d+)_/);
      const iosVersion = matches ? parseInt(matches[1], 10) : 0;
      
      if (/iPhone/.test(ua)) {
        const modelYear = iosVersion >= 15 ? 2021 : (iosVersion >= 13 ? 2019 : 2017);
        deviceName = `iPhone (circa ${modelYear})`;
        performanceScore = iosVersion >= 15 ? 0.85 : (iosVersion >= 13 ? 0.7 : 0.5);
      } else if (/iPad/.test(ua)) {
        const isModern = /iPad Pro/.test(ua) || iosVersion >= 14;
        deviceName = isModern ? 'iPad Pro/Air' : 'iPad';
        performanceScore = isModern ? 0.9 : 0.6;
      }
      
      // Add iOS-specific optimizations
      customParams.set('iosVersion', iosVersion);
    } else if (/Android/.test(ua)) {
      // Android device detection
      const matches = ua.match(/Android (\d+)\.(\d+)/);
      const androidVersion = matches ? parseFloat(`${matches[1]}.${matches[2]}`) : 0;
      
      // Detect high-end devices
      const isHighEnd = /SM-G9|SM-N9|SM-S9|Pixel [4-9]|OnePlus [7-9]/.test(ua);
      deviceName = isHighEnd ? 'High-end Android' : 'Android Device';
      performanceScore = isHighEnd ? 0.8 : (androidVersion >= 10 ? 0.6 : 0.4);
      
      // Add Android-specific optimizations
      customParams.set('androidVersion', androidVersion);
    } else {
      // Desktop detection
      const isWindows = /Windows/.test(ua);
      const isMac = /Macintosh|Mac OS X/.test(ua);
      const isLinux = /Linux/.test(ua);
      
      if (isWindows) {
        deviceName = 'Windows';
        performanceScore = hardwareConcurrency >= 8 ? 0.9 : 0.7;
      } else if (isMac) {
        const isSilicon = /arm64/.test(ua.toLowerCase());
        deviceName = isSilicon ? 'Mac (Apple Silicon)' : 'Mac (Intel)';
        performanceScore = isSilicon ? 0.95 : 0.8;
      } else if (isLinux) {
        deviceName = 'Linux';
        performanceScore = 0.75;
      }
    }
    
    // Adjust score based on concurrency
    performanceScore *= (0.7 + (hardwareConcurrency / 16) * 0.3);
    
    // Set real device profile
    this.realDeviceProfile = {
      name: deviceName,
      performance: performanceScore,
      memory,
      customParams
    };
    
    console.log(`Device profile created: ${deviceName}, Performance: ${performanceScore.toFixed(2)}, Cores: ${hardwareConcurrency}, Memory: ${memory}GB`);
  }

  /**
   * Check if WebGPU is available in the current browser
   */
  private async isWebGPUAvailable(): Promise<boolean> {
    try {
      // Enhanced WebGPU checking
      if (!navigator.gpu) {
        console.log('WebGPU not supported - navigator.gpu missing');
        return false;
      }
      
      // Try to request adapter to confirm availability
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        console.log('WebGPU adapter request failed');
        return false;
      }
      
      // Additional feature checking - get adapter info
      const adapterInfo = await adapter.requestAdapterInfo();
      console.log('WebGPU adapter info:', adapterInfo);
      
      return true;
    } catch (error) {
      console.warn('WebGPU check failed:', error);
      return false;
    }
  }
  
  /**
   * Set device-specific calibration factor based on performance capabilities
   */
  private setDeviceCalibrationFactor(): void {
    if (this.realDeviceProfile) {
      // Use real device profile for calibration
      this.deviceCalibrationFactor = 0.8 + (this.realDeviceProfile.performance * 0.4);
      
      // Adjust for mobile devices which typically need different calibration
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Apply more conservative calibration for mobile
        this.deviceCalibrationFactor *= 0.9;
      }
    } else {
      // Fallback to basic detection if profile not available
      const isHighEndDevice = this.useWebGPU || 
                            (navigator as any).deviceMemory >= 4 || 
                            navigator.hardwareConcurrency >= 4;
      
      this.deviceCalibrationFactor = isHighEndDevice ? 1.0 : 0.8;
      
      // Adjust for mobile devices which typically need different calibration
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        this.deviceCalibrationFactor *= 0.9;
      }
    }
    
    console.log(`Device calibration factor set to ${this.deviceCalibrationFactor.toFixed(2)} based on detected capabilities`);
  }

  /**
   * Load a model from URL or use cached version
   */
  public async loadModel(modelKey: string, modelUrl: string): Promise<tf.LayersModel | null> {
    try {
      // Check cache first
      if (this.modelCache.has(modelKey)) {
        return this.modelCache.get(modelKey)!;
      }

      // Ensure TensorFlow is initialized before loading
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log(`Loading model: ${modelKey} from ${modelUrl}`);
      const loadStartTime = performance.now();
      
      // Load model with standard options
      const model = await tf.loadLayersModel(modelUrl, {
        strict: false
      });
      
      const loadTime = performance.now() - loadStartTime;
      console.log(`Model ${modelKey} loaded in ${loadTime.toFixed(2)}ms`);
      
      // Apply memory optimization based on backend
      if (this.useWebGPU) {
        // Compile model for faster inference with WebGPU
        if (model.compile && typeof model.compile === 'function') {
          model.compile({
            optimizer: 'sgd',
            loss: 'meanSquaredError'
          });
        }
      }
      
      // Cache model
      this.modelCache.set(modelKey, model);
      return model;
    } catch (error) {
      console.error(`Failed to load model ${modelKey}:`, error);
      return null;
    }
  }

  /**
   * Process signal data through neural network with optimized memory management
   */
  public async processSignal(
    signalData: number[], 
    modelKey: string, 
    inputShape: number[] = [1, signalData.length]
  ): Promise<Float32Array | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const model = this.modelCache.get(modelKey);
      if (!model) {
        throw new Error(`Model ${modelKey} not loaded`);
      }

      // Begin performance measurement
      const startTime = performance.now();
      
      // Create a memory-efficient tensor with proper typed array
      const tensorData = Float32Array.from(signalData);
      const tensor = tf.tensor(tensorData, inputShape);
      
      // Use tf.tidy for automatic memory management
      const resultArray = tf.tidy(() => {
        // Run inference
        const resultTensor = model.predict(tensor) as tf.Tensor;
        // Get data from the tensor
        return resultTensor.dataSync();
      });
      
      // Dispose input tensor (result tensor handled by tf.tidy)
      tensor.dispose();
      
      // Create a new Float32Array from the result data for better memory management
      const outputArray = new Float32Array(resultArray);
      
      // Apply device-specific calibration factor to measurement results
      // This helps adjust for different device characteristics
      for (let i = 0; i < outputArray.length; i++) {
        outputArray[i] = outputArray[i] * this.deviceCalibrationFactor;
      }
      
      // Log performance for optimization tracking (but limit frequency)
      const processingTime = performance.now() - startTime;
      const now = Date.now();
      if (now - this.lastPerformanceLog > 2000) { // Log at most every 2 seconds
        this.lastPerformanceLog = now;
        console.log(`TensorFlow processing: ${processingTime.toFixed(2)}ms for model ${modelKey} (${this.getBackend()}), calibration: ${this.deviceCalibrationFactor.toFixed(2)}, device: ${this.realDeviceProfile?.name || 'Unknown'}`);
      }
      
      return outputArray;
    } catch (error) {
      console.error('Error processing signal with TensorFlow:', error);
      return null;
    }
  }

  /**
   * Get the current TensorFlow.js backend
   */
  public getBackend(): string {
    return tf.getBackend() || 'none';
  }
  
  /**
   * Get device calibration factor
   */
  public getDeviceCalibrationFactor(): number {
    return this.deviceCalibrationFactor;
  }
  
  /**
   * Get real device profile
   */
  public getDeviceProfile(): any {
    return this.realDeviceProfile;
  }

  /**
   * Clean up resources when no longer needed
   */
  public dispose(): void {
    // Dispose all cached models
    this.modelCache.forEach(model => {
      model.dispose();
    });
    this.modelCache.clear();
    
    // Memory cleanup
    tf.disposeVariables();
    this.isInitialized = false;
    
    // Force garbage collection where supported
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        console.log('Manual garbage collection not available');
      }
    }
  }
}
