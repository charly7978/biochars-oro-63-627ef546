/**
 * MultiCameraPPGProcessor
 * Experimental module that processes PPG signals from multiple camera sources
 * Uses TensorFlow for enhanced signal processing
 */
import { tensorflowService, ModelType } from '../ai/tensorflow-service';
import { ProcessingPriority } from '../extraction/CombinedExtractor';

export interface CameraDevice {
  deviceId: string;
  label: string;
  facing: 'user' | 'environment';
  index: number;
}

export interface PPGSignalSource {
  deviceId: string;
  stream: MediaStream | null;
  active: boolean;
  quality: number;
  lastValue: number;
  values: number[];
}

export interface MultiCameraPPGResult {
  timestamp: number;
  combinedValue: number;
  sources: {
    deviceId: string;
    value: number;
    quality: number;
    weight: number;
  }[];
  confidenceScore: number;
  priority: ProcessingPriority;
}

interface MulticameraConfig {
  maxCameras: number;
  useTensorFlow: boolean;
  useFusion: boolean;
  enhanceSignal: boolean;
  priorityThreshold: number;
}

/**
 * Manages multiple camera inputs for PPG signal acquisition
 */
export class MultiCameraPPGProcessor {
  private config: MulticameraConfig;
  private availableCameras: CameraDevice[] = [];
  private activeSources: Map<string, PPGSignalSource> = new Map();
  private isProcessing: boolean = false;
  private isModelLoaded: boolean = false;
  private processingQueue: number[] = [];
  private processingCanvasRef: HTMLCanvasElement | null = null;
  private processingContext: CanvasRenderingContext2D | null = null;
  
  constructor(config?: Partial<MulticameraConfig>) {
    this.config = {
      maxCameras: 2, // Default to front + one back camera
      useTensorFlow: true, 
      useFusion: true,
      enhanceSignal: true,
      priorityThreshold: 0.6,
      ...config
    };
    
    // Initialize canvas for frame processing
    this.initializeProcessingCanvas();
    
    // Load TensorFlow model if enabled
    if (this.config.useTensorFlow) {
      this.loadTensorFlowModel();
    }
    
    console.log("MultiCameraPPGProcessor initialized with config:", this.config);
  }
  
  /**
   * Initialize canvas for efficient image processing
   */
  private initializeProcessingCanvas(): void {
    try {
      this.processingCanvasRef = document.createElement('canvas');
      this.processingCanvasRef.width = 320; // Reasonable size for processing
      this.processingCanvasRef.height = 240;
      this.processingContext = this.processingCanvasRef.getContext('2d', {
        willReadFrequently: true,
        alpha: false
      });
      
      // Hide canvas (used only for processing)
      if (this.processingCanvasRef) {
        this.processingCanvasRef.style.display = 'none';
      }
    } catch (error) {
      console.error("Error initializing processing canvas:", error);
    }
  }
  
  /**
   * Load TensorFlow model for signal enhancement
   */
  private async loadTensorFlowModel(): Promise<void> {
    if (!this.config.useTensorFlow) return;
    
    try {
      // Try to use WebGPU for acceleration
      await tensorflowService.initializeTensorFlow();
      
      // Load denoising model
      const model = await tensorflowService.loadModel(ModelType.DENOISING);
      this.isModelLoaded = !!model;
      console.log("MultiCameraPPGProcessor: TensorFlow model loaded:", this.isModelLoaded);
    } catch (error) {
      console.error("Error loading TensorFlow model:", error);
      this.isModelLoaded = false;
    }
  }
  
  /**
   * Discover available cameras on the device
   */
  public async discoverCameras(): Promise<CameraDevice[]> {
    try {
      // Ensure we have permission to access cameras
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Enumerate all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      this.availableCameras = videoDevices.map((device, index) => {
        // Try to identify camera facing direction from label
        const label = device.label.toLowerCase();
        const facing = label.includes('front') || label.includes('user') ? 'user' : 'environment';
        
        return {
          deviceId: device.deviceId,
          label: device.label,
          facing,
          index
        };
      });
      
      console.log("Available cameras:", this.availableCameras);
      return this.availableCameras;
    } catch (error) {
      console.error("Error discovering cameras:", error);
      return [];
    }
  }
  
  /**
   * Start capturing from selected cameras
   */
  public async startCapture(deviceIds?: string[]): Promise<Map<string, PPGSignalSource>> {
    // Stop any existing capture
    await this.stopCapture();
    
    // If no specific devices requested, use default strategy
    if (!deviceIds || deviceIds.length === 0) {
      // Try to get one front and one back camera
      const frontCamera = this.availableCameras.find(cam => cam.facing === 'user');
      const backCameras = this.availableCameras
        .filter(cam => cam.facing === 'environment')
        .slice(0, this.config.maxCameras - 1);
      
      deviceIds = [
        ...(frontCamera ? [frontCamera.deviceId] : []),
        ...backCameras.map(cam => cam.deviceId)
      ];
    }
    
    // Limit to max cameras
    deviceIds = deviceIds.slice(0, this.config.maxCameras);
    
    // Create and start streams for each camera
    for (const deviceId of deviceIds) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          }
        });
        
        // Try to enable flashlight for rear cameras if possible
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
        }
        
        // Store active source
        this.activeSources.set(deviceId, {
          deviceId,
          stream,
          active: true,
          quality: 0,
          lastValue: 0,
          values: []
        });
      } catch (error) {
        console.error(`Error starting stream for device ${deviceId}:`, error);
      }
    }
    
    // Start processing frames if we have active sources
    if (this.activeSources.size > 0) {
      this.isProcessing = true;
      this.processFrames();
    }
    
    return this.activeSources;
  }
  
  /**
   * Stop capturing from all cameras
   */
  public async stopCapture(): Promise<void> {
    this.isProcessing = false;
    
    // Stop all active streams
    for (const source of this.activeSources.values()) {
      if (source.stream) {
        source.stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.error("Error stopping track:", error);
          }
        });
      }
    }
    
    this.activeSources.clear();
  }
  
  /**
   * Process frames from all active cameras
   */
  private processFrames(): void {
    if (!this.isProcessing) return;
    
    try {
      // Process each active source
      let combinedValue = 0;
      let totalWeight = 0;
      const sourceResults = [];
      
      // Process each active source
      for (const source of this.activeSources.values()) {
        if (!source.active || !source.stream) continue;
        
        // Get video track
        const videoTrack = source.stream.getVideoTracks()[0];
        if (!videoTrack) continue;
        
        // Create ImageCapture if supported
        if ('ImageCapture' in window) {
          const imageCapture = new ImageCapture(videoTrack);
          
          // Capture frame
          imageCapture.grabFrame().then(imageBitmap => {
            // Extract PPG value from frame
            const ppgValue = this.extractPPGFromFrame(imageBitmap, source.deviceId);
            
            // Add to source buffer
            source.lastValue = ppgValue;
            source.values.push(ppgValue);
            
            // Limit buffer size
            if (source.values.length > 100) {
              source.values.shift();
            }
            
            // Calculate signal quality
            source.quality = this.calculateSignalQuality(source.values);
            
            // Add to combined result with quality-based weighting
            const weight = source.quality / 100;
            combinedValue += ppgValue * weight;
            totalWeight += weight;
            
            sourceResults.push({
              deviceId: source.deviceId,
              value: ppgValue,
              quality: source.quality,
              weight
            });
          }).catch(error => {
            console.error(`Error capturing frame from ${source.deviceId}:`, error);
          });
        }
      }
      
      // Normalize combined value
      if (totalWeight > 0) {
        combinedValue = combinedValue / totalWeight;
        
        // Add to processing queue for TensorFlow enhancement
        this.processingQueue.push(combinedValue);
        
        // Keep queue at reasonable size
        if (this.processingQueue.length > 200) {
          this.processingQueue.shift();
        }
        
        // Schedule TensorFlow processing if enabled
        if (this.config.useTensorFlow && this.isModelLoaded && this.processingQueue.length > 30) {
          this.enhanceSignal();
        }
      }
      
      // Continue processing in animation frame
      if (this.isProcessing) {
        requestAnimationFrame(() => this.processFrames());
      }
    } catch (error) {
      console.error("Error in processFrames:", error);
      
      // Continue processing despite errors
      if (this.isProcessing) {
        requestAnimationFrame(() => this.processFrames());
      }
    }
  }
  
  /**
   * Extract PPG value from a video frame
   */
  private extractPPGFromFrame(frame: ImageBitmap, sourceId: string): number {
    try {
      if (!this.processingCanvasRef || !this.processingContext) {
        return 0;
      }
      
      // Draw frame to canvas
      this.processingContext.drawImage(
        frame, 
        0, 0, frame.width, frame.height, 
        0, 0, this.processingCanvasRef.width, this.processingCanvasRef.height
      );
      
      // Get image data
      const imageData = this.processingContext.getImageData(
        0, 0, 
        this.processingCanvasRef.width, 
        this.processingCanvasRef.height
      );
      
      // Calculate average red channel value
      const data = imageData.data;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      const step = 4; // Sample every nth pixel for efficiency
      
      for (let i = 0; i < data.length; i += 4 * step) {
        redSum += data[i];       // Red
        greenSum += data[i + 1]; // Green
        blueSum += data[i + 2];  // Blue
      }
      
      const totalPixels = data.length / (4 * step);
      
      // Normalize to [0, 1]
      const redAvg = redSum / totalPixels / 255;
      const greenAvg = greenSum / totalPixels / 255;
      const blueAvg = blueSum / totalPixels / 255;
      
      // Use red channel primarily with small adjustments from other channels
      // This is a common PPG extraction approach
      const ppgValue = redAvg * 0.8 + greenAvg * 0.15 + blueAvg * 0.05;
      
      return ppgValue;
    } catch (error) {
      console.error(`Error extracting PPG from frame (${sourceId}):`, error);
      return 0;
    }
  }
  
  /**
   * Calculate signal quality based on recent values
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    try {
      // Use recent values for quality calculation
      const recentValues = values.slice(-30);
      
      // Calculate statistics
      const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Calculate signal-to-noise ratio (simplified)
      const snr = avg / (stdDev + 0.0001); // Avoid division by zero
      
      // Check for rapid changes (possible noise)
      let rapidChanges = 0;
      for (let i = 1; i < recentValues.length; i++) {
        const change = Math.abs(recentValues[i] - recentValues[i - 1]);
        if (change > 0.1) rapidChanges++;
      }
      
      // Calculate quality score (0-100)
      let qualityScore = 100 * (snr / (snr + 1)); // Scale SNR to 0-100
      
      // Reduce quality for rapid changes
      qualityScore -= rapidChanges * 2;
      
      // Ensure within bounds
      qualityScore = Math.max(0, Math.min(100, qualityScore));
      
      return qualityScore;
    } catch (error) {
      console.error("Error calculating signal quality:", error);
      return 50; // Return moderate quality on error
    }
  }
  
  /**
   * Enhance signal using TensorFlow if available
   */
  private async enhanceSignal(): Promise<void> {
    if (!this.config.useTensorFlow || !this.isModelLoaded || this.processingQueue.length < 30) {
      return;
    }
    
    try {
      // Get a window of data for processing
      const signalWindow = this.processingQueue.slice(-100);
      
      // Apply TensorFlow enhancement
      const enhancedSignal = await tensorflowService.enhanceSignal(signalWindow);
      
      // Replace processed data with enhanced version
      if (enhancedSignal.length > 0) {
        // Replace last portion of queue with enhanced signal
        const start = Math.max(0, this.processingQueue.length - enhancedSignal.length);
        for (let i = 0; i < enhancedSignal.length; i++) {
          if (start + i < this.processingQueue.length) {
            this.processingQueue[start + i] = enhancedSignal[i];
          }
        }
      }
    } catch (error) {
      console.error("Error enhancing signal with TensorFlow:", error);
    }
  }
  
  /**
   * Get the current combined signal value
   */
  public getCurrentValue(): MultiCameraPPGResult {
    // Calculate combined value with quality weighting
    let combinedValue = 0;
    let totalWeight = 0;
    const sourceResults = [];
    let overallConfidence = 0;
    
    for (const source of this.activeSources.values()) {
      if (!source.active) continue;
      
      // Use quality as weight
      const weight = source.quality / 100;
      combinedValue += source.lastValue * weight;
      totalWeight += weight;
      
      sourceResults.push({
        deviceId: source.deviceId,
        value: source.lastValue,
        quality: source.quality,
        weight
      });
      
      // Accumulate confidence scores
      overallConfidence += source.quality;
    }
    
    // Normalize
    if (totalWeight > 0) {
      combinedValue = combinedValue / totalWeight;
    }
    
    // Normalize overall confidence
    if (this.activeSources.size > 0) {
      overallConfidence = overallConfidence / (this.activeSources.size * 100);
    }
    
    // Determine priority based on confidence
    let priority: ProcessingPriority;
    if (overallConfidence >= this.config.priorityThreshold) {
      priority = 'high' as ProcessingPriority;
    } else if (overallConfidence >= this.config.priorityThreshold / 2) {
      priority = 'medium' as ProcessingPriority;
    } else {
      priority = 'low' as ProcessingPriority;
    }
    
    return {
      timestamp: Date.now(),
      combinedValue,
      sources: sourceResults,
      confidenceScore: overallConfidence,
      priority
    };
  }
  
  /**
   * Get the processing queue (useful for visualization)
   */
  public getProcessingQueue(): number[] {
    return [...this.processingQueue];
  }
  
  /**
   * Set configuration parameters
   */
  public setConfig(config: Partial<MulticameraConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // If TensorFlow was disabled but now enabled, load model
    if (config.useTensorFlow && !this.isModelLoaded) {
      this.loadTensorFlowModel();
    }
    
    console.log("MultiCameraPPGProcessor: Config updated", this.config);
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopCapture();
    this.processingCanvasRef = null;
    this.processingContext = null;
  }
}

// Create and export singleton instance
export const multiCameraPPGProcessor = new MultiCameraPPGProcessor();
