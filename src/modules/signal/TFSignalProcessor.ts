/**
 * TensorFlow-based signal processor for extracting and analyzing PPG signals
 * Enhanced with robust error handling, performance monitoring, and optimization
 */

import * as tf from '@tensorflow/tfjs';
import { initializeTensorFlow, runWithMemoryManagement, disposeTensors } from '../../utils/tfModelInitializer';
import { ProcessedSignal, ProcessingError } from '../../types/signal';
import { logSignalProcessing, LogLevel, trackPerformance, trackPerformanceAsync } from '../../utils/signalLogging';
import { normalizeSignalValue, adaptiveFilter, calculateSignalQuality } from '../../utils/signalNormalization';

export class TFSignalProcessor {
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;
  private signalBuffer: number[] = [];
  private rawBuffer: number[] = [];
  private readonly bufferSize: number = 30;
  private modelInitialized: boolean = false;
  private signalQualityScore: number = 0;
  private lastProcessedTime: number = 0;
  private processingInterval: number = 30; // ms between processing calls
  private errorCounter: number = 0;
  private consecutiveErrorCounter: number = 0;
  private lastErrorTime: number = 0;
  private recoveryMode: boolean = false;
  private recoveryStartTime: number = 0;
  private processingModel: tf.Sequential | null = null;
  private signalQualityHistory: Array<{
    timestamp: number;
    quality: number;
    noise: number;
    stability: number;
    periodicity: number;
  }> = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Created new instance');
    this.initialize();
  }
  
  /**
   * Initialize TensorFlow and prepare the processor
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }
      
      logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Initializing');
      
      // Initialize TensorFlow.js
      const tfInitialized = await trackPerformanceAsync(
        'TFSignalProcessor', 
        'tfInitialization', 
        async () => await initializeTensorFlow()
      );
      
      if (!tfInitialized) {
        this.handleError("INIT_ERROR", "Failed to initialize TensorFlow");
        return;
      }
      
      this.isInitialized = true;
      this.signalBuffer = [];
      this.rawBuffer = [];
      this.errorCounter = 0;
      this.consecutiveErrorCounter = 0;
      this.recoveryMode = false;
      
      // Create a simple TF model for signal processing
      await this.initializeModel();
      
      logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Initialization complete');
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'TFSignalProcessor', 
        'Initialization error', 
        { error }
      );
      this.handleError("INIT_ERROR", "Error during initialization");
    }
  }
  
  /**
   * Initialize TensorFlow model for signal processing
   */
  private async initializeModel(): Promise<void> {
    try {
      await trackPerformanceAsync('TFSignalProcessor', 'modelInitialization', async () => {
        // Create a simple model for signal enhancement
        this.processingModel = tf.sequential();
        
        // Add a 1D convolutional layer with 16 filters
        this.processingModel.add(tf.layers.conv1d({
          inputShape: [this.bufferSize, 1],
          filters: 16,
          kernelSize: 5,
          strides: 1,
          padding: 'same',
          activation: 'relu',
          kernelInitializer: 'glorotNormal'
        }));
        
        // Add a max pooling layer
        this.processingModel.add(tf.layers.maxPooling1d({
          poolSize: 2,
          strides: 1,
          padding: 'same'
        }));
        
        // Add another convolutional layer
        this.processingModel.add(tf.layers.conv1d({
          filters: 8,
          kernelSize: 3,
          strides: 1,
          padding: 'same',
          activation: 'relu'
        }));
        
        // Add a global average pooling layer to reduce dimensionality
        this.processingModel.add(tf.layers.globalAveragePooling1d());
        
        // Add a dense layer for output
        this.processingModel.add(tf.layers.dense({
          units: 1,
          activation: 'linear'
        }));
        
        // Compile the model
        this.processingModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'meanSquaredError'
        });
      });
      
      this.modelInitialized = true;
      logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Model initialized successfully');
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'TFSignalProcessor', 
        'Model initialization error', 
        { error }
      );
      this.handleError("MODEL_ERROR", "Failed to initialize ML model");
    }
  }
  
  /**
   * Start signal processing
   */
  public start(): void {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    this.isProcessing = true;
    this.signalBuffer = [];
    this.rawBuffer = [];
    this.errorCounter = 0;
    this.consecutiveErrorCounter = 0;
    this.recoveryMode = false;
    
    logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Processing started');
  }
  
  /**
   * Stop signal processing and clean up resources
   */
  public stop(): void {
    this.isProcessing = false;
    // Clean up TensorFlow resources
    if (this.processingModel) {
      this.processingModel.dispose();
      this.processingModel = null;
    }
    disposeTensors();
    logSignalProcessing(LogLevel.INFO, 'TFSignalProcessor', 'Processing stopped');
  }
  
  /**
   * Process a single frame of image data
   */
  public async processFrame(imageData: ImageData): Promise<void> {
    if (!this.isProcessing || !this.isInitialized) {
      return;
    }
    
    // Handle recovery mode
    if (this.recoveryMode) {
      const now = Date.now();
      if (now - this.recoveryStartTime < 3000) {
        // Still in recovery period, don't process
        return;
      }
      
      // Exit recovery mode
      this.recoveryMode = false;
      logSignalProcessing(
        LogLevel.INFO, 
        'TFSignalProcessor', 
        'Exited recovery mode after error'
      );
    }
    
    // Throttle processing for performance
    const now = Date.now();
    if (now - this.lastProcessedTime < this.processingInterval) {
      return;
    }
    this.lastProcessedTime = now;
    
    try {
      await trackPerformanceAsync('TFSignalProcessor', 'frameProcessing', async () => {
        // Extract red channel from image
        const redValue = this.extractRedChannel(imageData);
        
        // Store the raw value
        this.rawBuffer.push(redValue);
        if (this.rawBuffer.length > this.bufferSize * 2) {
          this.rawBuffer.shift();
        }
        
        // Process the signal with TensorFlow
        let processed: number;
        
        if (this.modelInitialized && this.signalBuffer.length >= this.bufferSize) {
          // Use TensorFlow model if available
          processed = await this.processTensorFlow(redValue);
        } else {
          // Fallback to simple filtering
          processed = this.applySimpleFilter(redValue);
        }
        
        // Add processed value to buffer
        this.signalBuffer.push(processed);
        if (this.signalBuffer.length > this.bufferSize) {
          this.signalBuffer.shift();
        }
        
        // Calculate signal quality metrics
        const qualityMetrics = calculateSignalQuality(this.signalBuffer);
        this.signalQualityScore = qualityMetrics.overall;
        
        // Store quality history
        this.signalQualityHistory.push({
          timestamp: now,
          quality: qualityMetrics.overall,
          noise: qualityMetrics.noise,
          stability: qualityMetrics.stability,
          periodicity: qualityMetrics.periodicity
        });
        
        // Limit history size
        if (this.signalQualityHistory.length > 100) {
          this.signalQualityHistory.shift();
        }
        
        // Detect finger presence based on signal characteristics
        const isFingerDetected = this.signalQualityScore > 40 && 
                                 this.hasValidAmplitude(this.signalBuffer);
        
        // Calculate perfusion index
        const perfusionIndex = this.calculatePerfusionIndex(this.signalBuffer);
        
        // Create processed result
        const processedSignal: ProcessedSignal = {
          timestamp: now,
          rawValue: redValue,
          filteredValue: processed,
          quality: Math.round(this.signalQualityScore),
          fingerDetected: isFingerDetected,
          roi: this.detectROI(imageData),
          perfusionIndex: perfusionIndex
        };
        
        // Reset consecutive error counter on success
        this.consecutiveErrorCounter = 0;
        
        // Invoke callback with the processed signal
        this.onSignalReady?.(processedSignal);
      });
    } catch (error) {
      this.handleProcessingError(error);
    }
  }
  
  /**
   * Process signal with TensorFlow
   */
  private async processTensorFlow(value: number): Promise<number> {
    return runWithMemoryManagement(async () => {
      // If buffer is too short, just return the value
      if (this.signalBuffer.length < 10) {
        return value;
      }
      
      // Apply adaptive filtering and normalization
      const filteredValue = adaptiveFilter(value, this.signalBuffer);
      const normalizedValue = normalizeSignalValue(filteredValue, this.signalBuffer);
      
      // If model is not ready, return filtered value
      if (!this.processingModel) {
        return filteredValue;
      }
      
      try {
        // Feed value through the ML model
        // Copy recent buffer and add new value
        const inputBuffer = [...this.signalBuffer.slice(-this.bufferSize + 1), normalizedValue];
        const paddedBuffer = this.padOrTruncate(inputBuffer, this.bufferSize);
        
        // Create input tensor
        const inputTensor = tf.tensor2d(paddedBuffer, [1, this.bufferSize])
                              .expandDims(2) as tf.Tensor3D; // Shape: [1, bufferSize, 1]
        
        // Get model prediction
        const predictionTensor = this.processingModel.predict(inputTensor) as tf.Tensor;
        const predictionValue = predictionTensor.dataSync()[0];
        
        // Apply final transformation to get back to signal range
        const meanSignal = this.signalBuffer.reduce((sum, val) => sum + val, 0) / 
                          this.signalBuffer.length;
        
        // Scale prediction and add to mean for final value
        return meanSignal + (predictionValue * 2); // Scale factor can be adjusted
      } catch (tfError) {
        logSignalProcessing(
          LogLevel.WARN, 
          'TFSignalProcessor', 
          'TensorFlow processing error, using simple filter fallback', 
          { error: tfError }
        );
        
        // Fallback to simple filtering when TensorFlow fails
        return filteredValue;
      }
    }, 'signalProcessing');
  }
  
  /**
   * Apply simple fallback filter when TensorFlow fails
   */
  private applySimpleFilter(value: number): number {
    if (this.signalBuffer.length < 5) return value;
    
    // Adaptive filter based on buffer values
    return adaptiveFilter(value, this.signalBuffer);
  }
  
  /**
   * Pad or truncate array to specific length
   */
  private padOrTruncate(array: number[], length: number): number[] {
    if (array.length === length) return array;
    if (array.length > length) return array.slice(-length);
    
    // Pad with the first value if too short
    const padding = Array(length - array.length).fill(array[0] || 0);
    return [...padding, ...array];
  }
  
  /**
   * Extract red channel from image data for PPG
   */
  private extractRedChannel(imageData: ImageData): number {
    return trackPerformance('TFSignalProcessor', 'extractRedChannel', () => {
      if (!imageData || !imageData.data) {
        return 0;
      }
      
      const data = imageData.data;
      let redSum = 0;
      let count = 0;
      
      try {
        // Analyze center of image (40% central area)
        const startX = Math.floor(imageData.width * 0.3);
        const endX = Math.floor(imageData.width * 0.7);
        const startY = Math.floor(imageData.height * 0.3);
        const endY = Math.floor(imageData.height * 0.7);
        
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const i = (y * imageData.width + x) * 4;
            if (i >= 0 && i < data.length) {
              redSum += data[i]; // Red channel
              count++;
            }
          }
        }
        
        return count > 0 ? redSum / count : 0;
      } catch (error) {
        logSignalProcessing(
          LogLevel.ERROR, 
          'TFSignalProcessor', 
          'Error extracting red channel', 
          { error }
        );
        
        // Fallback to simple average if error
        let sum = 0;
        let cnt = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          sum += data[i];
          cnt++;
        }
        
        return cnt > 0 ? sum / cnt : 0;
      }
    });
  }
  
  /**
   * Check if signal has valid amplitude for finger detection
   */
  private hasValidAmplitude(buffer: number[]): boolean {
    if (buffer.length < 10) return false;
    
    const recentValues = buffer.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Higher threshold for better reliability
    return amplitude > 0.4 && amplitude < 50;
  }
  
  /**
   * Calculate perfusion index from recent values
   */
  private calculatePerfusionIndex(buffer: number[]): number {
    if (buffer.length < 10) return 0;
    
    try {
      const recentValues = buffer.slice(-10);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      
      // Avoid division by zero
      if (min === max) return 0;
      
      const dc = (max + min) / 2;
      if (dc === 0) return 0;
      
      const ac = max - min;
      return (ac / dc);
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'TFSignalProcessor', 
        'Error calculating perfusion index', 
        { error }
      );
      return 0;
    }
  }
  
  /**
   * Detect region of interest in the image
   */
  private detectROI(imageData: ImageData): ProcessedSignal['roi'] {
    // Simple ROI centered in the middle of the image
    const centerX = Math.floor(imageData.width * 0.3);
    const centerY = Math.floor(imageData.height * 0.3);
    const width = Math.floor(imageData.width * 0.4);
    const height = Math.floor(imageData.height * 0.4);
    
    return {
      x: centerX,
      y: centerY,
      width,
      height
    };
  }
  
  /**
   * Handle processing errors
   */
  private handleProcessingError(error: any): void {
    this.errorCounter++;
    this.consecutiveErrorCounter++;
    this.lastErrorTime = Date.now();
    
    logSignalProcessing(
      LogLevel.ERROR, 
      'TFSignalProcessor', 
      'Processing error', 
      { 
        error, 
        errorCount: this.errorCounter,
        consecutiveErrors: this.consecutiveErrorCounter 
      }
    );
    
    // If too many consecutive errors, enter recovery mode
    if (this.consecutiveErrorCounter >= 5) {
      this.recoveryMode = true;
      this.recoveryStartTime = Date.now();
      
      // Try to dispose and reinitialize resources
      if (this.processingModel) {
        this.processingModel.dispose();
        this.processingModel = null;
      }
      
      disposeTensors();
      this.modelInitialized = false;
      
      // Reinitialize in background
      this.initializeModel().catch(error => {
        logSignalProcessing(
          LogLevel.ERROR, 
          'TFSignalProcessor', 
          'Failed to reinitialize model in recovery mode', 
          { error }
        );
      });
      
      logSignalProcessing(
        LogLevel.WARN, 
        'TFSignalProcessor', 
        'Entered recovery mode due to consecutive errors', 
        { consecutiveErrors: this.consecutiveErrorCounter }
      );
    }
    
    if (this.onError) {
      this.onError({
        code: "PROCESSING_ERROR",
        message: "Error during signal processing",
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle general errors
   */
  private handleError(code: string, message: string): void {
    logSignalProcessing(LogLevel.ERROR, 'TFSignalProcessor', message);
    
    if (this.onError) {
      this.onError({
        code,
        message,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Get diagnostics about the processor state
   */
  public getDiagnostics(): Record<string, any> {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      modelInitialized: this.modelInitialized,
      bufferSize: this.signalBuffer.length,
      rawBufferSize: this.rawBuffer.length,
      currentQuality: this.signalQualityScore,
      errorCount: this.errorCounter,
      consecutiveErrorCount: this.consecutiveErrorCounter,
      lastErrorTime: this.lastErrorTime,
      recoveryMode: this.recoveryMode,
      recoveryTime: this.recoveryMode ? Date.now() - this.recoveryStartTime : 0,
      qualityHistory: this.signalQualityHistory.slice(-5) // Just the most recent entries
    };
  }
}
