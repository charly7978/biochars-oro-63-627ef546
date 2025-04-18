/**
 * Centralized Signal Processing Service
 * Manages multiple specialized signal channels for different vital signs
 */
import { SignalCoreProcessor, SignalProcessingConfig } from './SignalCoreProcessor';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProcessedSignal } from '../../types/signal';

export interface ProcessingMetrics {
  fps: number;
  quality: number;
  fingerDetected: boolean;
  startTime: number | null;
  processedFrames: number;
}

export interface ChannelData {
  name: string;
  values: number[];
  metadata: Record<string, any>;
}

export class SignalProcessingService {
  private static instance: SignalProcessingService;
  private processor: SignalCoreProcessor;
  private isProcessing: boolean = false;
  private processingSubject = new BehaviorSubject<ProcessedSignal | null>(null);
  private metricsSubject = new BehaviorSubject<ProcessingMetrics>({
    fps: 0,
    quality: 0,
    fingerDetected: false,
    startTime: null,
    processedFrames: 0
  });
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateInterval: number = 500; // Update FPS every 500ms
  private lastFpsUpdateTime: number = 0;
  private fingerDetectionBuffer: boolean[] = [];
  
  private constructor() {
    console.log("SignalProcessingService: Initializing centralized signal processor");
    this.processor = new SignalCoreProcessor({
      bufferSize: 300,
      sampleRate: 30,
      channels: [
        'heartbeat',
        'spo2',
        'bloodPressure',
        'arrhythmia',
        'glucose',
        'lipids',
        'hemoglobin',
        'hydration'
      ]
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): SignalProcessingService {
    if (!SignalProcessingService.instance) {
      SignalProcessingService.instance = new SignalProcessingService();
    }
    return SignalProcessingService.instance;
  }
  
  /**
   * Start processing signals
   */
  public startProcessing(): void {
    if (this.isProcessing) return;
    
    console.log("SignalProcessingService: Starting processing");
    this.isProcessing = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.lastFpsUpdateTime = performance.now();
    this.metricsSubject.next({
      ...this.metricsSubject.value,
      startTime: Date.now(),
      processedFrames: 0,
      fps: 0
    });
  }
  
  /**
   * Stop processing signals
   */
  public stopProcessing(): void {
    if (!this.isProcessing) return;
    
    console.log("SignalProcessingService: Stopping processing");
    this.isProcessing = false;
    this.metricsSubject.next({
      ...this.metricsSubject.value,
      startTime: null
    });
    this.processor.reset();
  }
  
  /**
   * Process a new signal value from camera or sensor
   */
  public processSignal(value: number, quality: number, isFingerDetected: boolean): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    // Update FPS calculation
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastFpsUpdateTime >= this.fpsUpdateInterval) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdateTime));
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
      
      this.metricsSubject.next({
        ...this.metricsSubject.value,
        fps,
        quality,
        fingerDetected: this.getStableFingerDetection(isFingerDetected),
        processedFrames: this.metricsSubject.value.processedFrames + 1
      });
    }
    
    // Process the signal through the core processor
    const channels = this.processor.processSignal(value);
    
    // Create processed signal object
    const processedSignal: ProcessedSignal = {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue: value, // Will be updated below
      quality,
      fingerDetected: this.getStableFingerDetection(isFingerDetected),
      roi: { x: 0, y: 0, width: 0, height: 0 }
    };
    
    // Extract filtered value from heartbeat channel
    const heartbeatChannel = channels.get('heartbeat');
    if (heartbeatChannel) {
      const values = heartbeatChannel.getValues();
      if (values.length > 0) {
        processedSignal.filteredValue = values[values.length - 1];
      }
    }
    
    // Broadcast the processed signal
    this.processingSubject.next(processedSignal);
    
    return processedSignal;
  }
  
  /**
   * Process a frame from camera
   */
  public processFrame(imageData: ImageData): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    // Simple red channel extraction for PPG signal
    // In a real app, more sophisticated algorithms would be used
    let redSum = 0;
    let pixelCount = 0;
    
    // Process only the center region for better signal
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const regionSize = Math.min(100, Math.min(imageData.width, imageData.height) / 3);
    
    for (let y = centerY - regionSize/2; y < centerY + regionSize/2; y++) {
      for (let x = centerX - regionSize/2; x < centerX + regionSize/2; x++) {
        if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
          const idx = (y * imageData.width + x) * 4;
          redSum += imageData.data[idx]; // Red channel
          pixelCount++;
        }
      }
    }
    
    // Calculate average red value and normalize to 0-1
    const redAvg = pixelCount > 0 ? redSum / pixelCount / 255 : 0;
    
    // Detect finger presence (basic threshold-based detection)
    // In a real app, more sophisticated detection would be used
    const minThreshold = 0.15; // Minimum brightness for finger detection
    const maxThreshold = 0.90; // Maximum brightness (too bright suggests no finger)
    const isFingerDetected = redAvg > minThreshold && redAvg < maxThreshold;
    
    // Estimate signal quality based on brightness
    // In a real app, more sophisticated quality estimation would be used
    let quality = 0;
    if (isFingerDetected) {
      // Linear quality scaling between min and optimal brightness
      const optimalBrightness = 0.4;
      const normalizedBrightness = Math.min(redAvg, optimalBrightness) / optimalBrightness;
      quality = Math.round(normalizedBrightness * 100);
    }
    
    return this.processSignal(redAvg, quality, isFingerDetected);
  }
  
  /**
   * Get stable finger detection status using a buffer
   * to avoid flicker
   */
  private getStableFingerDetection(currentStatus: boolean): boolean {
    this.fingerDetectionBuffer.push(currentStatus);
    if (this.fingerDetectionBuffer.length > 5) {
      this.fingerDetectionBuffer.shift();
    }
    
    // Count true values in buffer
    const trueCount = this.fingerDetectionBuffer.filter(Boolean).length;
    
    // Require majority for state change
    if (trueCount >= 3) {
      return true;
    } else if (trueCount <= 1) {
      return false;
    } else {
      // Maintain previous state for borderline cases
      return this.metricsSubject.value.fingerDetected;
    }
  }
  
  /**
   * Get observable for processed signals
   */
  public getSignalObservable(): Observable<ProcessedSignal | null> {
    return this.processingSubject.asObservable();
  }
  
  /**
   * Get observable for processing metrics
   */
  public getMetricsObservable(): Observable<ProcessingMetrics> {
    return this.metricsSubject.asObservable();
  }
  
  /**
   * Get the last processed signal
   */
  public getLastSignal(): ProcessedSignal | null {
    return this.processingSubject.value;
  }
  
  /**
   * Get all channels data
   */
  public getAllChannels(): Map<string, ChannelData> {
    const channelsData = new Map<string, ChannelData>();
    
    const processorChannels = this.processor.getAllChannels();
    processorChannels.forEach((channel, name) => {
      channelsData.set(name, {
        name,
        values: channel.getValues(),
        metadata: channel.getAllMetadata()
      });
    });
    
    return channelsData;
  }
  
  /**
   * Get a specific channel
   */
  public getChannel(name: string): ChannelData | undefined {
    const channel = this.processor.getChannel(name);
    if (!channel) return undefined;
    
    return {
      name,
      values: channel.getValues(),
      metadata: channel.getAllMetadata()
    };
  }
  
  /**
   * Reset all processing state
   */
  public reset(): void {
    console.log("SignalProcessingService: Resetting processor");
    this.processor.reset();
    this.fingerDetectionBuffer = [];
    this.processingSubject.next(null);
    this.metricsSubject.next({
      fps: 0,
      quality: 0,
      fingerDetected: false,
      startTime: this.isProcessing ? Date.now() : null,
      processedFrames: 0
    });
  }
}

// Export singleton instance for easy imports
export const signalProcessingService = SignalProcessingService.getInstance();
