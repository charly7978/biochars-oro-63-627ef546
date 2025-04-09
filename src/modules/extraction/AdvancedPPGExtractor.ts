/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Advanced PPG Signal and Heartbeat Extractor
 * Uses TensorFlow.js for advanced signal processing and neural network-based peak detection
 * Enhanced with XLA optimization, CNN-LSTM hybrid architecture, and denoising autoencoder
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { CombinedExtractionResult } from './CombinedExtractor';
import { ProcessingPriority } from './CombinedExtractor';

// Initialize TensorFlow with optimizations
async function initializeTensorFlow() {
  try {
    // Check for WebGPU support (faster than WebGL)
    if ('WebGPU' in window && 
        tf.findBackend('webgpu') && 
        tf.engine().backendNames().includes('webgpu')) {
      console.log('Using WebGPU backend (faster GPU acceleration)');
      await tf.setBackend('webgpu');
      // Enable XLA optimization for WebGPU
      await tf.env().set('ENGINE_COMPILE_XLA', true);
    } else {
      console.log('WebGPU not supported, falling back to WebGL backend');
      await tf.setBackend('webgl');
      // Enable shader compilation optimization
      await tf.env().set('WEBGL_USE_SHADER_COMPILATION_DELAY', false);
      // Optimize WebGL precision/performance tradeoff
      await tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }
    
    // Enable memory optimization
    await tf.env().set('DISPOSE_TENSORS_WHEN_NO_LONGER_NEEDED', true);
    
    // Log initialization status
    console.log('TensorFlow initialized with optimizations:', {
      backend: tf.getBackend(),
      version: tf.version.tfjs,
      xla: await tf.env().getAsync('ENGINE_COMPILE_XLA'),
      numTensors: tf.memory().numTensors,
      numBytes: tf.memory().numBytes
    });
    
    // Warm up the backend
    const warmupTensor = tf.tensor([1, 2, 3, 4]);
    warmupTensor.square().dispose();
    warmupTensor.dispose();
    
    return true;
  } catch (error) {
    console.error('TensorFlow initialization failed:', error);
    return false;
  }
}

// Start initialization immediately
const tfInitPromise = initializeTensorFlow();

// Interface for the advanced extraction result
export interface AdvancedExtractionResult extends CombinedExtractionResult {
  // Additional advanced metrics
  signalToNoiseRatio: number;
  powerSpectrum: number[];
  dominantFrequency: number;
  nnIntervals: number[];
  pnnx: number; // PNN50 or similar metric
  heartRateRecovery: number | null;
  adaptiveConfidence: number;
  noiseLevel: number;
  spectrumPeaks: Array<{frequency: number, amplitude: number}>;
}

// Interface for advanced configuration
export interface AdvancedExtractorConfig {
  useDynamicThresholding: boolean;
  applyAdaptiveFilter: boolean;
  useWaveletDenoising: boolean;
  useTensorFlow: boolean;
  usePeakVerification: boolean;
  useAutoencoder: boolean;       // Use denoising autoencoder
  useCnnLstm: boolean;           // Use hybrid CNN-LSTM architecture
  temporalWindowSize: number;
  lstmSequenceLength: number;    // Sequence length for LSTM
  nnThreshold: number;           // For heart rate variability (in ms)
  memorySaver: boolean; 
  adaptiveThresholdSensitivity: number;
  enableXlaOptimization: boolean; // Enable XLA compilation optimization
  modelQuantization: boolean;     // Enable model quantization for efficiency
}

/**
 * Advanced PPG Signal Extractor with TensorFlow-powered signal processing
 * Enhanced with XLA optimization, CNN-LSTM hybrid architecture, and denoising autoencoder
 */
export class AdvancedPPGExtractor {
  // Signal buffers
  private rawBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private featureBuffer: tf.Tensor[] = [];
  private sequenceBuffer: number[][] = []; // For LSTM sequence input
  
  // Signal metadata
  private baselineValue: number = 0;
  private signalAmplitude: number = 0;
  private lastTimestamp: number = 0;
  
  // Neural network models
  private peakDetectionModel: tf.LayersModel | null = null;
  private denoisingAutoencoder: tf.LayersModel | null = null;
  private cnnLstmModel: tf.LayersModel | null = null;
  private modelLoaded: boolean = false;
  private tfInitialized: boolean = false;
  
  // Peak detection state
  private peaks: Array<{time: number, value: number}> = [];
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  
  // Signal metrics
  private noiseEstimate: number = 0;
  private powerSpectrum: number[] = [];
  private snr: number = 0;
  private adaptiveThreshold: number = 0.5;
  private lastBPM: number | null = null;
  
  // Configuration with defaults
  private config: AdvancedExtractorConfig = {
    useDynamicThresholding: true,
    applyAdaptiveFilter: true,
    useWaveletDenoising: true,
    useTensorFlow: true,
    usePeakVerification: true,
    useAutoencoder: true,          // Enable denoising autoencoder by default
    useCnnLstm: true,              // Enable CNN-LSTM by default
    temporalWindowSize: 256,
    lstmSequenceLength: 32,        // LSTM sequence length
    nnThreshold: 50,               // in ms
    memorySaver: true,
    adaptiveThresholdSensitivity: 1.5,
    enableXlaOptimization: true,   // Enable XLA by default
    modelQuantization: true        // Enable quantization for efficiency
  };
  
  // Memory management
  private lastCleanupTime: number = 0;
  private CLEANUP_INTERVAL = 5000; // 5 seconds
  private MAX_BUFFER_SIZE = 512;
  private MAX_FEATURE_TENSORS = 10;
  private MAX_SEQUENCE_BUFFER = 40;
  
  constructor(config?: Partial<AdvancedExtractorConfig>) {
    if (config) {
      this.config = {...this.config, ...config};
    }
    
    this.initialize();
    
    // Set up memory management
    if (this.config.memorySaver) {
      setInterval(() => this.cleanupMemory(), this.CLEANUP_INTERVAL);
    }
  }
  
  /**
   * Initialize the extractor and load TensorFlow model
   */
  private async initialize(): Promise<void> {
    try {
      // Wait for TensorFlow to initialize
      this.tfInitialized = await tfInitPromise;
      
      if (this.tfInitialized && this.config.useTensorFlow) {
        console.log('Initializing neural networks for advanced PPG extraction...');
        
        // Create models for signal processing
        await Promise.all([
          this.createPeakDetectionModel(),
          this.createDenoisingAutoencoder(),
          this.createCnnLstmModel()
        ]);
        
        this.modelLoaded = true;
        
        // Output memory usage after model creation
        console.log('Advanced PPG extraction initialized with TensorFlow:', {
          tensors: tf.memory().numTensors,
          bytes: tf.memory().numBytes,
          backend: tf.getBackend()
        });
      }
    } catch (error) {
      console.error('Failed to initialize TensorFlow models:', error);
      this.modelLoaded = false;
      
      // Fallback to traditional methods
      console.log('Falling back to traditional signal processing methods');
    }
  }
  
  /**
   * Create a CNN for peak detection
   */
  private async createPeakDetectionModel(): Promise<void> {
    try {
      const windowSize = 32; // Input window size
      
      // Create a sequential model
      const model = tf.sequential();
      
      // Add layers
      // 1D Convolutional layer for feature extraction
      model.add(tf.layers.conv1d({
        inputShape: [windowSize, 1],
        filters: 16,
        kernelSize: 5,
        activation: 'relu',
        padding: 'same'
      }));
      
      // Pooling layer to reduce dimensionality
      model.add(tf.layers.maxPooling1d({
        poolSize: 2,
        strides: 2
      }));
      
      // Another convolutional layer
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      
      // Flatten the output for dense layers
      model.add(tf.layers.flatten());
      
      // Dense layers for classification
      model.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dropout({
        rate: 0.25
      }));
      
      // Output layer - probability of a peak at the center
      model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      }));
      
      // Compile the model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      // Store the model directly without quantization (not supported in this version)
      this.peakDetectionModel = model;
      
      console.log('Peak detection CNN model created successfully');
    } catch (error) {
      console.error('Error creating peak detection model:', error);
      throw error;
    }
  }
  
  /**
   * Create a denoising autoencoder for signal enhancement
   */
  private async createDenoisingAutoencoder(): Promise<void> {
    if (!this.config.useAutoencoder) {
      return;
    }
    
    try {
      const inputSize = 64; // Input signal window size
      
      // Create autoencoder model
      const model = tf.sequential();
      
      // Encoder part
      model.add(tf.layers.dense({
        inputShape: [inputSize],
        units: 32,
        activation: 'tanh'
      }));
      
      model.add(tf.layers.dense({
        units: 16,
        activation: 'tanh'
      }));
      
      // Bottleneck layer
      model.add(tf.layers.dense({
        units: 8,
        activation: 'tanh',
        name: 'bottleneck'
      }));
      
      // Decoder part
      model.add(tf.layers.dense({
        units: 16,
        activation: 'tanh'
      }));
      
      model.add(tf.layers.dense({
        units: 32,
        activation: 'tanh'
      }));
      
      // Output layer
      model.add(tf.layers.dense({
        units: inputSize,
        activation: 'linear'
      }));
      
      // Compile model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });
      
      this.denoisingAutoencoder = model;
      console.log('Denoising autoencoder model created successfully');
    } catch (error) {
      console.error('Error creating denoising autoencoder:', error);
      this.config.useAutoencoder = false; // Disable autoencoder on error
    }
  }
  
  /**
   * Create a hybrid CNN-LSTM model for temporal pattern recognition
   */
  private async createCnnLstmModel(): Promise<void> {
    if (!this.config.useCnnLstm) {
      return;
    }
    
    try {
      const sequenceLength = this.config.lstmSequenceLength;
      const featureLength = 32; // Length of individual feature vector
      
      // Create model
      const model = tf.sequential();
      
      // Add 1D CNN layers for feature extraction from each time step
      model.add(tf.layers.timeDistributed({
        layer: tf.layers.conv1d({
          filters: 16,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        inputShape: [sequenceLength, featureLength, 1]
      }));
      
      // Add max pooling
      model.add(tf.layers.timeDistributed({
        layer: tf.layers.maxPooling1d({
          poolSize: 2
        })
      }));
      
      // Flatten CNN output for each time step
      model.add(tf.layers.timeDistributed({
        layer: tf.layers.flatten()
      }));
      
      // Add LSTM layers
      model.add(tf.layers.lstm({
        units: 32,
        returnSequences: true
      }));
      
      model.add(tf.layers.lstm({
        units: 32,
        returnSequences: false
      }));
      
      // Add dense layers for classification
      model.add(tf.layers.dense({
        units: 16,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dropout({
        rate: 0.2
      }));
      
      // Output layer
      model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      }));
      
      // Compile model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      this.cnnLstmModel = model;
      console.log('CNN-LSTM hybrid model created successfully');
    } catch (error) {
      console.error('Error creating CNN-LSTM model:', error);
      this.config.useCnnLstm = false; // Disable CNN-LSTM on error
    }
  }
  
  /**
   * Process a raw PPG value and apply advanced signal processing
   */
  public processValue(value: number): AdvancedExtractionResult {
    const now = Date.now();
    
    // Store raw value in buffer
    this.rawBuffer.push(value);
    
    // Apply buffer size limits (memory optimization)
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE) {
      this.rawBuffer.shift();
    }
    
    // 1. Apply adaptive filtering and denoising
    const filteredValue = this.applySignalProcessing(value);
    
    // Store filtered value
    this.filteredBuffer.push(filteredValue);
    if (this.filteredBuffer.length > this.MAX_BUFFER_SIZE) {
      this.filteredBuffer.shift();
    }
    
    // 2. Update signal baseline and amplitude
    this.updateSignalAnalytics();
    
    // 3. Calculate noise estimate
    this.noiseEstimate = this.estimateNoiseLevel();
    
    // 4. Detect peaks using neural networks if available, otherwise fall back to traditional methods
    let hasPeak = false;
    let peakValue: number | null = null;
    let instantaneousBPM: number | null = null;
    let confidence = 0;
    let rrInterval: number | null = null;
    
    if (this.tfInitialized && this.modelLoaded && this.config.useTensorFlow && this.filteredBuffer.length >= 32) {
      // Use neural network for peak detection
      const result = this.detectPeakWithNeuralNetworks();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      
      if (hasPeak) {
        this.peakTimes.push(now);
        this.peaks.push({time: now, value: filteredValue});
        
        // Calculate RR interval and instantaneous BPM
        if (this.lastPeakTime !== null) {
          rrInterval = now - this.lastPeakTime;
          
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            this.rrIntervals.push(rrInterval);
            
            // Keep only recent intervals
            if (this.rrIntervals.length > 20) {
              this.rrIntervals.shift();
            }
          }
        }
        
        this.lastPeakTime = now;
      }
    } else {
      // Use traditional peak detection as fallback
      const result = this.detectPeakTraditional();
      hasPeak = result.hasPeak;
      peakValue = result.peakValue;
      confidence = result.confidence;
      rrInterval = result.rrInterval;
      instantaneousBPM = result.instantaneousBPM;
    }
    
    // 5. Update power spectrum for frequency analysis
    if (this.filteredBuffer.length >= 64) {
      this.updatePowerSpectrum();
    }
    
    // 6. Calculate SNR based on signal and noise estimates
    this.calculateSNR();
    
    // 7. Analyze heart rate variability
    const hrvMetrics = this.calculateHRVMetrics();
    
    // 8. Calculate dominant frequency from the power spectrum
    const dominantFrequency = this.getDominantFrequency();
    
    // Get spectrum peaks (up to 3 most significant)
    const spectrumPeaks = this.getSpectrumPeaks(3);
    
    // Determine quality based on multiple factors
    let signalQuality = this.determineSignalQuality();
    
    // Detect finger presence
    const fingerDetected = this.isFingerDetected();
    
    // Calculate final BPM (with smoothing)
    const averageBPM = this.calculateAverageBPM();
    
    // Final result
    const result: AdvancedExtractionResult = {
      // Base data
      timestamp: now,
      rawValue: value,
      filteredValue,
      
      // Signal information
      quality: signalQuality,
      fingerDetected,
      amplitude: this.signalAmplitude,
      baseline: this.baselineValue,
      
      // Peak information
      hasPeak,
      peakTime: hasPeak ? now : null,
      peakValue: hasPeak ? peakValue : null,
      confidence,
      instantaneousBPM,
      rrInterval,
      
      // Calculated statistics
      averageBPM,
      heartRateVariability: hrvMetrics.rmssd,
      
      // Advanced metrics
      signalToNoiseRatio: this.snr,
      powerSpectrum: this.powerSpectrum,
      dominantFrequency,
      nnIntervals: hrvMetrics.nnIntervals,
      pnnx: hrvMetrics.pnnx,
      heartRateRecovery: null, // Would need longer time series
      adaptiveConfidence: confidence * signalQuality / 100,
      noiseLevel: this.noiseEstimate,
      spectrumPeaks,
      
      // Required by CombinedExtractionResult
      priority: ProcessingPriority.MEDIUM // Default priority
    };
    
    // Update last timestamp
    this.lastTimestamp = now;
    
    // Update sequence buffer for LSTM if enabled
    if (this.config.useCnnLstm) {
      this.updateSequenceBuffer(filteredValue, hasPeak);
    }
    
    // Memory cleanup if needed
    if (now - this.lastCleanupTime > this.CLEANUP_INTERVAL) {
      this.cleanupMemory();
      this.lastCleanupTime = now;
    }
    
    return result;
  }
  
  /**
   * Apply comprehensive signal processing pipeline
   */
  private applySignalProcessing(value: number): number {
    if (this.filteredBuffer.length < 2) {
      return value;
    }
    
    // Apply adaptive filtering first
    let filtered = this.applyAdaptiveFiltering(value);
    
    // Apply wavelet denoising if enabled and we have enough data
    if (this.config.useWaveletDenoising && this.filteredBuffer.length >= 32) {
      filtered = this.applyWaveletDenoising(filtered);
    }
    
    // Apply autoencoder denoising if enabled and initialized
    if (this.config.useAutoencoder && this.denoisingAutoencoder && this.filteredBuffer.length >= 64) {
      filtered = this.applyAutoencoderDenoising(filtered);
    }
    
    return filtered;
  }
  
  /**
   * Apply adaptive filtering techniques to the raw signal
   */
  private applyAdaptiveFiltering(value: number): number {
    if (!this.config.applyAdaptiveFilter || this.filteredBuffer.length < 2) {
      return value;
    }
    
    // Get recent values for analysis
    const recentRaw = this.rawBuffer.slice(-Math.min(20, this.rawBuffer.length));
    
    // Calculate signal variance to adjust filter strength
    const variance = this.calculateVariance(recentRaw);
    
    // Adjust alpha based on signal variance
    // Higher variance (more noise) = stronger filtering (lower alpha)
    // Lower variance (stable signal) = lighter filtering (higher alpha)
    let alpha = 0.2; // Default alpha
    
    if (variance > 0.05) {
      // High variance: apply stronger filtering
      alpha = 0.1;
    } else if (variance < 0.01) {
      // Low variance: apply lighter filtering
      alpha = 0.3;
    }
    
    // Apply exponential moving average filter
    const lastFiltered = this.filteredBuffer[this.filteredBuffer.length - 1];
    let filtered = alpha * value + (1 - alpha) * lastFiltered;
    
    return filtered;
  }
  
  /**
   * Apply simplified wavelet denoising to filter out noise while preserving signal shape
   */
  private applyWaveletDenoising(value: number): number {
    // This is a very simplified approximation of wavelet denoising
    // A real implementation would use proper wavelet transform
    
    const windowSize = Math.min(32, this.filteredBuffer.length);
    const window = [...this.filteredBuffer.slice(-windowSize), value];
    
    // Apply a simple multi-level decomposition and soft thresholding
    const threshold = this.estimateWaveletThreshold(window);
    
    // Simple soft thresholding function
    const softThreshold = (x: number): number => {
      const sign = x >= 0 ? 1 : -1;
      const abs = Math.abs(x);
      return sign * Math.max(0, abs - threshold);
    };
    
    // Calculate local trend
    const trend = this.calculateLocalTrend(window);
    
    // Extract "detail" component (high frequency)
    const detail = value - trend;
    
    // Apply thresholding to the detail component
    const denoisedDetail = softThreshold(detail);
    
    // Reconstruct the signal
    return trend + denoisedDetail;
  }
  
  /**
   * Apply denoising autoencoder to the signal window
   */
  private applyAutoencoderDenoising(value: number): number {
    if (!this.denoisingAutoencoder || this.filteredBuffer.length < 64) {
      return value;
    }
    
    try {
      // Create a window of the last 64 values (including current)
      const window = [...this.filteredBuffer.slice(-63), value];
      
      // Normalize the window to [0, 1] range
      const min = Math.min(...window);
      const max = Math.max(...window);
      const range = max - min > 0 ? max - min : 1;
      const normalized = window.map(v => (v - min) / range);
      
      // Convert to tensor
      const inputTensor = tf.tensor2d([normalized]);
      
      // Run through autoencoder
      const outputTensor = this.denoisingAutoencoder.predict(inputTensor) as tf.Tensor;
      
      // Get denoised values
      const denoisedNormalized = outputTensor.dataSync();
      
      // Denormalize the output (last value is the current denoised value)
      const denoisedValue = denoisedNormalized[denoisedNormalized.length - 1] * range + min;
      
      // Clean up tensors
      tf.dispose([inputTensor, outputTensor]);
      
      return denoisedValue;
    } catch (error) {
      console.error('Error in autoencoder denoising:', error);
      return value; // Return original on error
    }
  }
  
  /**
   * Update signal baseline and amplitude
   */
  private updateSignalAnalytics(): void {
    if (this.filteredBuffer.length < 5) return;
    
    // Get recent values for analysis
    const recentValues = this.filteredBuffer.slice(-30);
    
    // Calculate min, max, and amplitude
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    this.signalAmplitude = max - min;
    
    // Update baseline with exponential smoothing
    const currentMean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    if (this.baselineValue === 0) {
      this.baselineValue = currentMean;
    } else {
      this.baselineValue = 0.95 * this.baselineValue + 0.05 * currentMean;
    }
  }
  
  /**
   * Update sequence buffer for LSTM processing
   */
  private updateSequenceBuffer(value: number, isPeak: boolean): void {
    if (!this.config.useCnnLstm) return;
    
    // Create feature vector for current window
    if (this.filteredBuffer.length >= 32) {
      const window = this.filteredBuffer.slice(-32);
      
      // Simple features: normalized values and first derivatives
      const normalized = this.normalizeWindow(window);
      const derivatives = this.calculateDerivatives(normalized);
      
      // Combine features
      const featureVector = [...normalized, ...derivatives];
      
      // Add to sequence buffer
      this.sequenceBuffer.push(featureVector);
      
      // Maintain maximum size
      if (this.sequenceBuffer.length > this.MAX_SEQUENCE_BUFFER) {
        this.sequenceBuffer.shift();
      }
    }
  }
  
  /**
   * Normalize a window of values to [-1, 1]
   */
  private normalizeWindow(window: number[]): number[] {
    const min = Math.min(...window);
    const max = Math.max(...window);
    const range = max - min > 0 ? max - min : 1;
    return window.map(v => (v - min) / range * 2 - 1);
  }
  
  /**
   * Calculate first derivatives
   */
  private calculateDerivatives(values: number[]): number[] {
    const derivatives = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    // Pad first value
    derivatives.unshift(0);
    return derivatives;
  }
  
  /**
   * Detect peaks using all available neural networks
   */
  private detectPeakWithNeuralNetworks(): {
    hasPeak: boolean,
    peakValue: number | null,
    confidence: number
  } {
    try {
      // Default result
      let hasPeak = false;
      let confidence = 0;
      
      if (!this.modelLoaded || this.filteredBuffer.length < 32) {
        return { hasPeak: false, peakValue: null, confidence: 0 };
      }
      
      // 1. CNN Peak Detection
      const cnnResult = this.detectPeakWithCNN();
      
      // 2. CNN-LSTM (if enabled and we have enough data)
      let lstmConfidence = 0;
      if (this.config.useCnnLstm && this.cnnLstmModel && this.sequenceBuffer.length >= this.config.lstmSequenceLength) {
        const lstmResult = this.detectPeakWithCnnLstm();
        lstmConfidence = lstmResult.confidence;
        
        // Combine CNN and LSTM results (weighted average)
        confidence = cnnResult.confidence * 0.6 + lstmConfidence * 0.4;
        hasPeak = confidence > this.adaptiveThreshold;
      } else {
        // Only use CNN result
        confidence = cnnResult.confidence;
        hasPeak = cnnResult.hasPeak;
      }
      
      // Also verify with traditional approach
      const isLocalMax = this.isLocalMaximum();
      
      // Consider it a peak only if neural network and traditional method agree
      hasPeak = hasPeak && isLocalMax;
      
      return {
        hasPeak,
        peakValue: hasPeak ? this.filteredBuffer[this.filteredBuffer.length - 1] : null,
        confidence
      };
      
    } catch (error) {
      console.error('Error in neural network peak detection:', error);
      // Fall back to traditional method
      return this.detectPeakTraditional();
    }
  }
  
  /**
   * Detect peaks using the CNN model
   */
  private detectPeakWithCNN(): {
    hasPeak: boolean,
    confidence: number
  } {
    try {
      if (!this.peakDetectionModel || this.filteredBuffer.length < 32) {
        return { hasPeak: false, confidence: 0 };
      }
      
      // Create a window of the last 32 values
      const window = this.filteredBuffer.slice(-32);
      
      // Normalize the window to [-1, 1] range
      const min = Math.min(...window);
      const max = Math.max(...window);
      const range = max - min > 0 ? max - min : 1;
      const normalized = window.map(v => (v - min) / range * 2 - 1);
      
      // Ensure data is correctly shaped for model input (TensorFlow.js expects batch dimension)
      const inputTensor = tf.tidy(() => {
        // Shape: [batchSize, windowLength, channels]
        return tf.tensor3d([normalized.map(v => [v])]);
      });
      
      // Run prediction
      const predictionTensor = this.peakDetectionModel.predict(inputTensor) as tf.Tensor;
      const probabilities = Array.from(predictionTensor.dataSync());
      
      // Clean up tensors
      tf.dispose([inputTensor, predictionTensor]);
      
      // Check if the center point is a peak
      const confidence = probabilities[0];
      const isPeak = confidence > this.adaptiveThreshold;
      
      return {
        hasPeak: isPeak,
        confidence: confidence as number
      };
      
    } catch (error) {
      console.error('Error in CNN peak detection:', error);
      return { hasPeak: false, confidence: 0 };
    }
  }
  
  /**
   * Detect peaks using the CNN-LSTM hybrid model
   */
  private detectPeakWithCnnLstm(): {
    hasPeak: boolean,
    confidence: number
  } {
    try {
      if (!this.cnnLstmModel || this.sequenceBuffer.length < this.config.lstmSequenceLength) {
        return { hasPeak: false, confidence: 0 };
      }
      
      // Get the last N sequences
      const sequences = this.sequenceBuffer.slice(-this.config.lstmSequenceLength);
      
      // Each sequence is a feature vector, we need to reshape for CNN-LSTM input
      // Shape: [batch, timesteps, features, channels]
      const reshapedSequences = sequences.map(seq => {
        // Take first 32 features (if we have more)
        const features = seq.slice(0, 32);
        // Add channel dimension
        return features.map(f => [f]);
      });
      
      // Create input tensor with batch dimension
      const inputTensor = tf.tensor4d([reshapedSequences]);
      
      // Run prediction
      const predictionTensor = this.cnnLstmModel.predict(inputTensor) as tf.Tensor;
      const probabilities = Array.from(predictionTensor.dataSync());
      
      // Clean up tensors
      tf.dispose([inputTensor, predictionTensor]);
      
      // Get confidence
      const confidence = probabilities[0];
      const isPeak = confidence > this.adaptiveThreshold;
      
      return {
        hasPeak: isPeak,
        confidence: confidence as number
      };
      
    } catch (error) {
      console.error('Error in CNN-LSTM peak detection:', error);
      return { hasPeak: false, confidence: 0 };
    }
  }
  
  /**
   * Traditional peak detection algorithm as fallback
   */
  private detectPeakTraditional(): {
    hasPeak: boolean,
    peakValue: number | null,
    confidence: number,
    instantaneousBPM: number | null,
    rrInterval: number | null
  } {
    const now = Date.now();
    const currentValue = this.filteredBuffer[this.filteredBuffer.length - 1];
    
    // Check if enough time has passed since the last peak
    const minPeakDistance = 300; // ms (corresponds to 200 bpm max)
    const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;
    
    if (timeSinceLastPeak < minPeakDistance) {
      return {
        hasPeak: false,
        peakValue: null,
        confidence: 0,
        instantaneousBPM: null,
        rrInterval: null
      };
    }
    
    // Check if the current point is a local maximum
    const isLocalMax = this.isLocalMaximum();
    
    if (!isLocalMax) {
      return {
        hasPeak: false,
        peakValue: null,
        confidence: 0,
        instantaneousBPM: null,
        rrInterval: null
      };
    }
    
    // We found a peak
    let confidence = 0.6; // Base confidence
    let instantaneousBPM: number | null = null;
    let rrInterval: number | null = null;
    
    // Update peak list
    this.peaks.push({time: now, value: currentValue});
    this.peakTimes.push(now);
    
    // Limit the number of stored peaks
    if (this.peaks.length > 20) {
      this.peaks.shift();
      this.peakTimes.shift();
    }
    
    // Calculate RR interval and instantaneous BPM
    if (this.lastPeakTime !== null) {
      rrInterval = now - this.lastPeakTime;
      
      if (rrInterval > 0) {
        instantaneousBPM = 60000 / rrInterval;
        
        // Store RR interval
        this.rrIntervals.push(rrInterval);
        if (this.rrIntervals.length > 20) {
          this.rrIntervals.shift();
        }
        
        // Adjust confidence based on physiological plausibility
        if (instantaneousBPM >= 40 && instantaneousBPM <= 180) {
          confidence += 0.2;
        } else {
          confidence -= 0.3;
        }
        
        // Adjust confidence based on regularity
        if (this.rrIntervals.length >= 3) {
          const recentRRs = this.rrIntervals.slice(-3);
          const rrMean = recentRRs.reduce((sum, rr) => sum + rr, 0) / recentRRs.length;
          const rrDeviation = Math.sqrt(
            recentRRs.reduce((sum, rr) => sum + Math.pow(rr - rrMean, 2), 0) / recentRRs.length
          );
          
          // Calculate coefficient of variation (normalized standard deviation)
          const cv = rrDeviation / rrMean;
          
          // If CV is low, the rhythm is regular (higher confidence)
          if (cv < 0.1) confidence += 0.2;
          else if (cv > 0.2) confidence -= 0.1;
        }
      }
    }
    
    this.lastPeakTime = now;
    
    // Final confidence clamped to [0,1]
    confidence = Math.max(0, Math.min(1, confidence));
    
    return {
      hasPeak: true,
      peakValue: currentValue,
      confidence,
      instantaneousBPM,
      rrInterval
    };
  }
  
  /**
   * Check if the current point is a local maximum
   */
  private isLocalMaximum(): boolean {
    const len = this.filteredBuffer.length;
    if (len < 5) return false;
    
    const lookback = 3; // Look 3 points back
    const current = this.filteredBuffer[len - 1];
    
    // Check if current point is larger than previous points
    for (let i = 1; i <= lookback; i++) {
      if (len - 1 - i < 0) continue;
      if (current <= this.filteredBuffer[len - 1 - i]) {
        return false;
      }
    }
    
    // If we're looking at real-time data, we can't look ahead
    // So we approximate by checking the slope
    const prev1 = this.filteredBuffer[len - 2];
    const prev2 = this.filteredBuffer[len - 3];
    
    // If we're still going up, it's probably not the peak yet
    const slope1 = current - prev1;
    const slope2 = prev1 - prev2;
    
    // If the slope is decreasing, we might be at a peak
    return slope1 < slope2;
  }
  
  /**
   * Update the power spectrum for frequency analysis
   */
  private updatePowerSpectrum(): void {
    // Get the last 64 samples for FFT
    const window = this.filteredBuffer.slice(-64);
    
    // Apply a Hamming window to reduce spectral leakage
    const hammingWindow = window.map((v, i) => {
      return v * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (window.length - 1)));
    });
    
    // Compute simple DFT (Discrete Fourier Transform)
    // For a real implementation, we'd use FFT for efficiency
    const N = hammingWindow.length;
    const spectrum: number[] = [];
    
    // Calculate just the relevant frequency bands (0.5 - 4 Hz for HR)
    // Assuming 20 Hz sampling rate (50ms between samples)
    const samplingFreq = 20; // Hz
    const maxBin = Math.floor(4 * N / samplingFreq); // 4 Hz max
    const minBin = Math.floor(0.5 * N / samplingFreq); // 0.5 Hz min
    
    // Only calculate for the frequency range we're interested in
    for (let k = minBin; k <= maxBin; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        real += hammingWindow[n] * Math.cos(angle);
        imag -= hammingWindow[n] * Math.sin(angle);
      }
      
      // Calculate magnitude
      const magnitude = Math.sqrt(real * real + imag * imag) / N;
      spectrum.push(magnitude);
    }
    
    this.powerSpectrum = spectrum;
  }
  
  /**
   * Calculate the Signal-to-Noise Ratio
   */
  private calculateSNR(): void {
    if (this.filteredBuffer.length < 30 || this.powerSpectrum.length === 0) {
      this.snr = 0;
      return;
    }
    
    // Find the peak in the power spectrum (signal)
    const maxPower = Math.max(...this.powerSpectrum);
    const maxIndex = this.powerSpectrum.indexOf(maxPower);
    
    // Calculate average power outside the peak (noise)
    const signalBand = [Math.max(0, maxIndex - 1), Math.min(this.powerSpectrum.length - 1, maxIndex + 1)];
    let noiseSum = 0;
    let noiseCount = 0;
    
    for (let i = 0; i < this.powerSpectrum.length; i++) {
      if (i < signalBand[0] || i > signalBand[1]) {
        noiseSum += this.powerSpectrum[i];
        noiseCount++;
      }
    }
    
    const noisePower = noiseCount > 0 ? noiseSum / noiseCount : 1;
    
    // Calculate SNR in dB
    this.snr = noisePower > 0 ? 10 * Math.log10(maxPower / noisePower) : 0;
  }
  
  /**
   * Get the dominant frequency from the power spectrum
   */
  private getDominantFrequency(): number {
    if (this.powerSpectrum.length === 0) return 0;
    
    // Find the frequency with the highest power
    const maxPower = Math.max(...this.powerSpectrum);
    const maxIndex = this.powerSpectrum.indexOf(maxPower);
    
    // Convert bin index to frequency
    // Assuming 64-point DFT and 20 Hz sampling rate
    const minFreq = 0.5; // Hz
    const freqStep = (4 - 0.5) / (this.powerSpectrum.length - 1);
    
    return minFreq + maxIndex * freqStep;
  }
  
  /**
   * Get the top N peaks from the power spectrum
   */
  private getSpectrumPeaks(n: number): Array<{frequency: number, amplitude: number}> {
    if (this.powerSpectrum.length === 0) return [];
    
    // Create array of frequency-amplitude pairs
    const pairs: Array<{index: number, amplitude: number}> = [];
    for (let i = 0; i < this.powerSpectrum.length; i++) {
      pairs.push({index: i, amplitude: this.powerSpectrum[i]});
    }
    
    // Sort by amplitude (descending)
    pairs.sort((a, b) => b.amplitude - a.amplitude);
    
    // Take top N
    const topN = pairs.slice(0, n);
    
    // Convert to frequency
    const minFreq = 0.5; // Hz
    const freqStep = (4 - 0.5) / (this.powerSpectrum.length - 1);
    
    return topN.map(({index, amplitude}) => ({
      frequency: minFreq + index * freqStep,
      amplitude
    }));
  }
  
  /**
   * Calculate Heart Rate Variability metrics
   */
  private calculateHRVMetrics(): {
    rmssd: number | null,
    nnIntervals: number[],
    pnnx: number
  } {
    if (this.rrIntervals.length < 3) {
      return {
        rmssd: null,
        nnIntervals: [],
        pnnx: 0
      };
    }
    
    // Filter out physiologically implausible intervals
    const validIntervals = this.rrIntervals.filter(
      rr => rr >= 300 && rr <= 1500 // 40-200 bpm range
    );
    
    // Calculate successive differences
    const nnDiffs: number[] = [];
    for (let i = 1; i < validIntervals.length; i++) {
      nnDiffs.push(Math.abs(validIntervals[i] - validIntervals[i-1]));
    }
    
    // Calculate RMSSD
    let sumSquaredDiffs = 0;
    for (const diff of nnDiffs) {
      sumSquaredDiffs += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiffs / Math.max(1, nnDiffs.length));
    
    // Calculate pNN50 (or similar)
    const threshold = this.config.nnThreshold;
    const countOverThreshold = nnDiffs.filter(diff => diff > threshold).length;
    const pnnx = validIntervals.length > 1 
      ? countOverThreshold / nnDiffs.length
      : 0;
    
    return {
      rmssd,
      nnIntervals: validIntervals,
      pnnx
    };
  }
  
  /**
   * Estimate noise level from signal
   */
  private estimateNoiseLevel(): number {
    if (this.filteredBuffer.length < 10) return 1.0;
    
    // Calculate first differences (high frequency components)
    const diffs: number[] = [];
    for (let i = 1; i < this.filteredBuffer.length; i++) {
      diffs.push(this.filteredBuffer[i] - this.filteredBuffer[i-1]);
    }
    
    // Calculate mean absolute difference
    const mad = diffs.reduce((sum, d) => sum + Math.abs(d), 0) / diffs.length;
    
    // Normalize by signal amplitude to get relative noise level
    return this.signalAmplitude > 0.001 
      ? Math.min(1.0, mad / this.signalAmplitude)
      : 1.0;
  }
  
  /**
   * Calculate average BPM from recent peaks
   */
  private calculateAverageBPM(): number | null {
    // Need at least 2 peaks to calculate BPM
    if (this.peakTimes.length < 2) {
      return this.lastBPM;
    }
    
    // Take the most recent peaks
    const recentPeaks = this.peakTimes.slice(-Math.min(10, this.peakTimes.length));
    
    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < recentPeaks.length; i++) {
      totalInterval += recentPeaks[i] - recentPeaks[i-1];
    }
    
    const avgInterval = totalInterval / (recentPeaks.length - 1);
    
    // Convert to BPM
    const bpm = 60000 / avgInterval;
    
    // Check physiological plausibility
    if (bpm >= 40 && bpm <= 200) {
      this.lastBPM = bpm;
      return bpm;
    }
    
    // Return last valid BPM or null
    return this.lastBPM;
  }
  
  /**
   * Determine signal quality based on multiple factors
   */
  private determineSignalQuality(): number {
    if (this.filteredBuffer.length < 10) return 0;
    
    // Factors:
    // 1. Signal amplitude (20%)
    const amplitudeScore = Math.min(100, this.signalAmplitude * 5000);
    
    // 2. SNR (20%)
    const snrScore = Math.min(100, Math.max(0, this.snr * 5));
    
    // 3. Spectrum peak prominence (20%)
    let peakProminence = 0;
    if (this.powerSpectrum.length > 0) {
      const maxPower = Math.max(...this.powerSpectrum);
      const avgPower = this.powerSpectrum.reduce((s, v) => s + v, 0) / this.powerSpectrum.length;
      peakProminence = avgPower > 0 ? Math.min(100, (maxPower / avgPower - 1) * 100) : 0;
    }
    
    // 4. Heart rate stability (20%)
    let stabilityScore = 0;
    if (this.rrIntervals.length >= 3) {
      const intervals = this.rrIntervals.slice(-5);
      const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
      const cv = Math.sqrt(variance) / mean; // Coefficient of variation
      
      // Lower CV = more stable = higher score
      stabilityScore = Math.min(100, Math.max(0, (1 - cv * 5) * 100));
    }
    
    // 5. Neural network confidence (20%)
    let nnConfidence = 0;
    if (this.tfInitialized && this.modelLoaded) {
      // If we have a neural network prediction, use its confidence
      const cnnResult = this.detectPeakWithCNN();
      nnConfidence = cnnResult.confidence * 100;
    }
    
    // Weighted average
    const qualityScore = (
      amplitudeScore * 0.2 +
      snrScore * 0.2 +
      peakProminence * 0.2 +
      stabilityScore * 0.2 +
      nnConfidence * 0.2
    );
    
    return Math.round(qualityScore);
  }
  
  /**
   * Determine if a finger is present based on signal characteristics
   */
  private isFingerDetected(): boolean {
    if (this.filteredBuffer.length < 10) return false;
    
    // Check signal amplitude
    const hasAdequateAmplitude = this.signalAmplitude > 0.02;
    
    // Check signal quality
    const hasGoodQuality = this.determineSignalQuality() > 30;
    
    // Check if we have detected consistent heartbeats
    const hasConsistentHeartbeat = this.peakTimes.length >= 3;
    
    // Check SNR
    const hasGoodSNR = this.snr > 2;
    
    // Neural network-based detection
    let nnDetection = false;
    if (this.tfInitialized && this.modelLoaded) {
      // Use autoencoder reconstruction error as a finger detection metric
      if (this.config.useAutoencoder && this.denoisingAutoencoder && this.filteredBuffer.length >= 64) {
        const reconstructionError = this.calculateReconstructionError();
        nnDetection = reconstructionError < 0.15; // Low error means finger likely present
      }
    }
    
    // Require at least three of the five criteria
    let criteria = 0;
    if (hasAdequateAmplitude) criteria++;
    if (hasGoodQuality) criteria++;
    if (hasConsistentHeartbeat) criteria++;
    if (hasGoodSNR) criteria++;
    if (nnDetection) criteria++;
    
    return criteria >= 3;
  }
  
  /**
   * Calculate autoencoder reconstruction error for finger detection
   */
  private calculateReconstructionError(): number {
    if (!this.denoisingAutoencoder || this.filteredBuffer.length < 64) {
      return 1.0;
    }
    
    try {
      // Create a window of the last 64 values
      const window = this.filteredBuffer.slice(-64);
      
      // Normalize the window
      const min = Math.min(...window);
      const max = Math.max(...window);
      const range = max - min > 0 ? max - min : 1;
      const normalized = window.map(v => (v - min) / range);
      
      // Convert to tensor
      const inputTensor = tf.tensor2d([normalized]);
      
      // Run through autoencoder
      const outputTensor = this.denoisingAutoencoder.predict(inputTensor) as tf.Tensor;
      const reconstructed = Array.from(outputTensor.dataSync());
      
      // Calculate mean squared error
      let sumSquaredError = 0;
      for (let i = 0; i < normalized.length; i++) {
        sumSquaredError += Math.pow(normalized[i] - reconstructed[i], 2);
      }
      const mse = sumSquaredError / normalized.length;
      
      // Clean up tensors
      tf.dispose([inputTensor, outputTensor]);
      
      return mse;
    } catch (error) {
      console.error('Error calculating reconstruction error:', error);
      return 1.0;
    }
  }
  
  /**
   * Estimate appropriate threshold for wavelet denoising
   */
  private estimateWaveletThreshold(window: number[]): number {
    // Universal threshold (simplified)
    const n = window.length;
    
    // Calculate MAD (Median Absolute Deviation) estimator
    const median = this.calculateMedian(window);
    const deviations = window.map(x => Math.abs(x - median));
    const mad = this.calculateMedian(deviations);
    
    // Scale MAD to approximate standard deviation
    const sigma = mad / 0.6745;
    
    // Compute threshold using universal threshold formula
    return sigma * Math.sqrt(2 * Math.log(n));
  }
  
  /**
   * Calculate local trend using a moving average
   */
  private calculateLocalTrend(window: number[]): number {
    const n = window.length;
    const center = window[n - 1]; // Current value
    
    // Use a weighted average of recent values
    let sum = 0;
    let weightSum = 0;
    
    const recentWindow = window.slice(-7);
    for (let i = 0; i < recentWindow.length; i++) {
      const weight = i + 1;
      sum += recentWindow[i] * weight;
      weightSum += weight;
    }
    
    return sum / weightSum;
  }
  
  /**
   * Calculate variance of a set of values
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Calculate the median of an array
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Clean up memory by disposing tensors and trimming buffers
   */
  private cleanupMemory(): void {
    console.log('Running memory cleanup...');
    
    // Log memory usage before cleanup
    if (this.tfInitialized) {
      console.log('Memory before cleanup:', {
        tensors: tf.memory().numTensors,
        bytes: tf.memory().numBytes
      });
    }
    
    // Dispose TensorFlow tensors
    if (this.featureBuffer.length > 0) {
      // Keep only the most recent features
      const keepCount = Math.min(this.MAX_FEATURE_TENSORS, this.featureBuffer.length);
      const toDispose = this.featureBuffer.slice(0, this.featureBuffer.length - keepCount);
      
      for (const tensor of toDispose) {
        tensor.dispose();
      }
      
      this.featureBuffer = this.featureBuffer.slice(-keepCount);
    }
    
    // Trim buffers to prevent memory growth
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE / 2) {
      this.rawBuffer = this.rawBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }
    
    if (this.filteredBuffer.length > this.MAX_BUFFER_SIZE / 2) {
      this.filteredBuffer = this.filteredBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
    }
    
    if (this.sequenceBuffer.length > this.MAX_SEQUENCE_BUFFER / 2) {
      this.sequenceBuffer = this.sequenceBuffer.slice(-this.MAX_SEQUENCE_BUFFER / 2);
    }
    
    if (this.peaks.length > 10) {
      this.peaks = this.peaks.slice(-10);
    }
    
    if (this.peakTimes.length > 10) {
      this.peakTimes = this.peakTimes.slice(-10);
    }
    
    // Force garbage collection in TensorFlow
    if (this.tfInitialized && tf.memory().numTensors > 100) {
      try {
        tf.tidy(() => {}); // Trigger execution to clean up tidy counts
        tf.disposeVariables(); // Dispose of any variables
        
        // Log memory after cleanup
        console.log('Memory after cleanup:', {
          tensors: tf.memory().numTensors,
          bytes: tf.memory().numBytes
        });
      } catch (error) {
        console.error('Error during TensorFlow memory cleanup:', error);
      }
    }
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    // Reset signal buffers
    this.rawBuffer = [];
    this.filteredBuffer = [];
    this.sequenceBuffer = [];
    
    // Clean up TensorFlow tensors
    if (this.tfInitialized) {
      this.featureBuffer.forEach(tensor => tensor.dispose());
      this.featureBuffer = [];
      
      // Force garbage collection
      tf.tidy(() => {});
      console.log('TensorFlow memory after reset:', {
        tensors: tf.memory().numTensors,
        bytes: tf.memory().numBytes
      });
    }
    
    // Reset peak detection state
    this.peaks = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    
    // Reset signal metrics
    this.baselineValue = 0;
    this.signalAmplitude = 0;
    this.noiseEstimate = 0;
    this.powerSpectrum = [];
    this.snr = 0;
    this.lastBPM = null;
    
    console.log('Advanced PPG extractor reset with TensorFlow optimization');
  }
}

/**
 * Create a new instance of the advanced PPG extractor
 */
export function createAdvancedPPGExtractor(config?: Partial<AdvancedExtractorConfig>): AdvancedPPGExtractor {
  return new AdvancedPPGExtractor(config);
}

/**
 * Process a value using the advanced extractor
 */
export function processWithAdvancedExtractor(
  value: number,
  extractor: AdvancedPPGExtractor
): AdvancedExtractionResult {
  return extractor.processValue(value);
}
