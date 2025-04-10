
import * as tf from '@tensorflow/tfjs';
import { initializeTensorFlow, runWithMemoryManagement, disposeTensors } from '../../utils/tfModelInitializer';
import { ProcessedSignal, ProcessingError } from '../../types/signal';

/**
 * TensorFlow-based signal processor for extracting and analyzing PPG signals
 * Provides enhanced signal quality through ML-based filtering and analysis
 */
export class TFSignalProcessor {
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;
  private signalBuffer: number[] = [];
  private readonly bufferSize: number = 30;
  private modelInitialized: boolean = false;
  private signalQualityScore: number = 0;
  private lastProcessedTime: number = 0;
  private processingInterval: number = 30; // ms between processing calls
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    console.log("TFSignalProcessor: Created new instance");
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
      
      console.log("TFSignalProcessor: Initializing");
      
      // Initialize TensorFlow.js
      const tfInitialized = await initializeTensorFlow();
      if (!tfInitialized) {
        this.handleError("INIT_ERROR", "Failed to initialize TensorFlow");
        return;
      }
      
      this.isInitialized = true;
      this.signalBuffer = [];
      
      // Create a simple TF model for signal processing
      this.initializeModel();
      
      console.log("TFSignalProcessor: Initialization complete");
    } catch (error) {
      console.error("TFSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", "Error during initialization");
    }
  }
  
  /**
   * Initialize TensorFlow model for signal processing
   */
  private async initializeModel(): Promise<void> {
    try {
      // Simple ML initialization - can be expanded with actual model loading
      this.modelInitialized = true;
      console.log("TFSignalProcessor: Model initialized");
    } catch (error) {
      console.error("TFSignalProcessor: Model initialization error", error);
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
    console.log("TFSignalProcessor: Processing started");
  }
  
  /**
   * Stop signal processing and clean up resources
   */
  public stop(): void {
    this.isProcessing = false;
    // Clean up TensorFlow resources
    disposeTensors();
    console.log("TFSignalProcessor: Processing stopped");
  }
  
  /**
   * Process a single frame of image data
   */
  public async processFrame(imageData: ImageData): Promise<void> {
    if (!this.isProcessing || !this.isInitialized || !this.modelInitialized) {
      return;
    }
    
    const now = Date.now();
    if (now - this.lastProcessedTime < this.processingInterval) {
      return; // Throttle processing for performance
    }
    this.lastProcessedTime = now;
    
    try {
      await runWithMemoryManagement(async () => {
        // Extract red channel from image
        const redValue = this.extractRedChannel(imageData);
        
        // Process the signal with TensorFlow
        const processed = await this.processTensorFlow(redValue);
        
        // Calculate quality score based on signal characteristics
        this.signalQualityScore = this.calculateSignalQuality(this.signalBuffer);
        
        // Detect finger presence
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
          roi: this.detectROI(),
          perfusionIndex: perfusionIndex
        };
        
        this.onSignalReady?.(processedSignal);
      });
    } catch (error) {
      console.error("TFSignalProcessor: Processing error", error);
      this.handleError("PROCESSING_ERROR", "Error during signal processing");
    }
  }
  
  /**
   * Process signal with TensorFlow
   */
  private async processTensorFlow(value: number): Promise<number> {
    // Add value to buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }
    
    if (this.signalBuffer.length < 10) {
      return value;
    }
    
    try {
      // Convert buffer to tensor
      const inputBuffer = this.signalBuffer.slice(-this.bufferSize);
      const paddedBuffer = this.padOrTruncate(inputBuffer, this.bufferSize);
      
      // Create tensor
      const inputTensor = tf.tensor1d(paddedBuffer);
      
      // Apply moving average filter using TensorFlow
      const kernel = tf.tensor1d(Array(5).fill(1/5));
      // Fix tensor type by explicitly setting shapes
      const expandedInput = inputTensor.expandDims(0).expandDims(2) as tf.Tensor3D;
      const expandedKernel = kernel.expandDims(0).expandDims(1).expandDims(2) as tf.Tensor3D;
      
      // Apply convolution for filtering
      const filtered = tf.conv1d(expandedInput, expandedKernel, 1, 'same')
                          .squeeze()
                          .arraySync() as number[];
      
      // Get last filtered value
      const result = filtered[filtered.length - 1];
      
      // Dispose tensors to prevent memory leaks
      inputTensor.dispose();
      kernel.dispose();
      
      return result;
    } catch (error) {
      console.error("TFSignalProcessor: TensorFlow processing error", error);
      // Fallback to simple filtering when TF fails
      return this.applySimpleFilter(value);
    }
  }
  
  /**
   * Simple fallback filter when TensorFlow fails
   */
  private applySimpleFilter(value: number): number {
    if (this.signalBuffer.length < 5) return value;
    
    // Simple moving average as fallback
    const recentValues = this.signalBuffer.slice(-5);
    return recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
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
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analyze center of image (40% central area)
    const startX = Math.floor(imageData.width * 0.3);
    const endX = Math.floor(imageData.width * 0.7);
    const startY = Math.floor(imageData.height * 0.3);
    const endY = Math.floor(imageData.height * 0.7);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i]; // Red channel
        count++;
      }
    }
    
    return count > 0 ? redSum / count : 0;
  }
  
  /**
   * Calculate signal quality score (0-100)
   */
  private calculateSignalQuality(buffer: number[]): number {
    if (buffer.length < 10) return 0;
    
    try {
      // Get recent values for analysis
      const recentValues = buffer.slice(-10);
      
      // Calculate variation metrics
      const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const variance = recentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Calculate rate of change between adjacent samples
      const changes = recentValues.slice(1).map((val, i) => Math.abs(val - recentValues[i]));
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      
      // Periodicity score (higher is better)
      const periodicityScore = this.calculatePeriodicity(buffer);
      
      // Signal-to-noise ratio estimate
      const snr = mean / (stdDev + 0.001);
      
      // Combine metrics into quality score
      let qualityScore = 0;
      
      // Signal should have some variation but not too much
      if (stdDev > 0.1 && stdDev < 20) {
        qualityScore += 30;
      }
      
      // Signal should have consistent rate of change
      if (avgChange > 0.05 && avgChange < 5) {
        qualityScore += 20;
      }
      
      // Signal should have good SNR
      if (snr > 2) {
        qualityScore += 20;
      }
      
      // Signal should have periodicity
      qualityScore += periodicityScore * 30;
      
      return Math.min(100, Math.max(0, qualityScore));
    } catch (error) {
      console.error("Error calculating signal quality:", error);
      return 0;
    }
  }
  
  /**
   * Calculate periodicity score (0-1)
   */
  private calculatePeriodicity(buffer: number[]): number {
    if (buffer.length < 20) return 0.5;
    
    try {
      // Use autocorrelation to detect periodicity
      const recentValues = buffer.slice(-20);
      const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      
      // Center the values around the mean
      const centered = recentValues.map(v => v - mean);
      
      // Calculate autocorrelation for lags 1 to 10
      const correlations: number[] = [];
      for (let lag = 1; lag <= 10; lag++) {
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < centered.length - lag; i++) {
          numerator += centered[i] * centered[i + lag];
          denominator += centered[i] * centered[i];
        }
        
        correlations.push(denominator !== 0 ? numerator / denominator : 0);
      }
      
      // Find maximum correlation and its lag
      let maxCorr = 0;
      for (const corr of correlations) {
        if (Math.abs(corr) > Math.abs(maxCorr)) {
          maxCorr = corr;
        }
      }
      
      // Convert to periodicity score (0-1)
      return Math.min(1, Math.max(0, Math.abs(maxCorr)));
    } catch (error) {
      console.error("Error calculating periodicity:", error);
      return 0.5;
    }
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
    
    return amplitude > 0.2 && amplitude < 50;
  }
  
  /**
   * Calculate perfusion index from recent values
   */
  private calculatePerfusionIndex(buffer: number[]): number {
    if (buffer.length < 10) return 0;
    
    const recentValues = buffer.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const dc = (max + min) / 2;
    
    // Avoid division by zero
    if (dc === 0) return 0;
    
    const ac = max - min;
    return (ac / dc);
  }
  
  /**
   * Detect region of interest (dummy implementation)
   */
  private detectROI(): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }
  
  /**
   * Handle processing errors
   */
  private handleError(code: string, message: string): void {
    console.error(`TFSignalProcessor: ${message}`);
    
    if (this.onError) {
      this.onError({
        code,
        message,
        timestamp: Date.now()
      });
    }
  }
}
