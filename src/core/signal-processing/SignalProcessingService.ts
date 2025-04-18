
/**
 * Centralized Signal Processing Service
 * Manages multiple specialized signal channels for different vital signs
 * ONLY processes real data, no simulations
 */
import { SignalCoreProcessor, SignalProcessingConfig } from './SignalCoreProcessor';
import { SignalChannel } from './SignalChannel'; // Add the import for SignalChannel
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
  
  // Lower threshold for finger detection to improve sensitivity
  private readonly MIN_RED_THRESHOLD = 0.05; // Reduced from original value
  private readonly MAX_RED_THRESHOLD = 0.95; // Increased to cover more cases
  
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
    this.fingerDetectionBuffer = []; // Reset finger detection buffer
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
    
    // Process the signal through the core processor with debug logging
    console.log("Processing signal value:", value, "Quality:", quality, "Finger detected:", isFingerDetected);
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
   * Process a frame from the camera
   * Extract ROI and calculate PPG signal
   */
  public processFrame(imageData: ImageData): ProcessedSignal | null {
    if (!this.isProcessing) return null;
    
    // Calculate PPG signal from image data
    const roiData = this.extractROI(imageData);
    if (!roiData) {
      console.log("SignalProcessingService: Could not extract ROI");
      return null;
    }
    
    const { signal, quality, isFingerDetected, roi } = roiData;
    
    // Process the extracted signal
    const processedSignal = this.processSignal(signal, quality, isFingerDetected);
    
    if (processedSignal) {
      processedSignal.roi = roi;
    }
    
    return processedSignal;
  }
  
  /**
   * Extract ROI from image and calculate PPG signal
   * Uses real-time analysis of the red channel for finger detection
   */
  private extractROI(imageData: ImageData): { 
    signal: number; 
    quality: number; 
    isFingerDetected: boolean;
    roi: { x: number; y: number; width: number; height: number; }
  } | null {
    try {
      // Focus on the center portion of the image
      const centerX = Math.floor(imageData.width / 2);
      const centerY = Math.floor(imageData.height / 2);
      const roiSize = Math.min(80, Math.floor(Math.min(imageData.width, imageData.height) * 0.25));
      
      const roi = {
        x: Math.max(0, centerX - roiSize / 2),
        y: Math.max(0, centerY - roiSize / 2),
        width: roiSize,
        height: roiSize
      };
      
      let totalRed = 0;
      let totalGreen = 0;
      let totalBlue = 0;
      let pixelCount = 0;
      
      // Extract RGB values from ROI
      for (let y = roi.y; y < roi.y + roi.height; y++) {
        for (let x = roi.x; x < roi.x + roi.width; x++) {
          const idx = (y * imageData.width + x) * 4;
          
          if (idx >= 0 && idx < imageData.data.length - 3) {
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            
            totalRed += r;
            totalGreen += g;
            totalBlue += b;
            pixelCount++;
          }
        }
      }
      
      if (pixelCount === 0) {
        console.log("SignalProcessingService: No pixels in ROI");
        return null;
      }
      
      // Calculate average color values in ROI
      const avgRed = totalRed / pixelCount / 255;
      const avgGreen = totalGreen / pixelCount / 255;
      const avgBlue = totalBlue / pixelCount / 255;
      
      // Check if a finger is detected based on red channel
      // Fingers cause high red values when illuminated by flash
      const isFingerDetected = avgRed > this.MIN_RED_THRESHOLD && avgRed < this.MAX_RED_THRESHOLD;
      
      // Use smoothed red channel as PPG signal
      const signal = avgRed;
      
      // Calculate signal quality based on signal stability
      // This is a real measure of the signal quality
      const quality = this.calculateFrameQuality(avgRed, avgGreen, avgBlue);
      
      return { signal, quality, isFingerDetected, roi };
    } catch (error) {
      console.error("SignalProcessingService: Error extracting ROI", error);
      return null;
    }
  }
  
  /**
   * Calculate quality of the frame data
   * Based on real signal characteristics
   */
  private calculateFrameQuality(red: number, green: number, blue: number): number {
    // Calculate quality based on color balance and range
    // A finger on the camera with proper illumination has specific characteristics
    
    // Check if red channel is dominant (typical for PPG)
    const redDominance = red / (green + blue + 0.001);
    
    // Calculate standard PPG quality score (0-100)
    let quality = 0;
    
    // Red should be higher than other channels but not saturated
    if (red > 0.1 && red < 0.95 && redDominance > 1.0) {
      quality = 50 + (redDominance - 1.0) * 25;
    }
    
    return Math.min(100, Math.max(0, quality));
  }
  
  /**
   * Get stable finger detection status by averaging recent detections
   */
  private getStableFingerDetection(current: boolean): boolean {
    // Keep a buffer of recent detections for stability
    this.fingerDetectionBuffer.push(current);
    
    // Limit buffer size
    if (this.fingerDetectionBuffer.length > 10) {
      this.fingerDetectionBuffer.shift();
    }
    
    // Calculate the percentage of positive detections
    const positiveRatio = this.fingerDetectionBuffer.filter(d => d).length / 
                          Math.max(1, this.fingerDetectionBuffer.length);
    
    // Return true if more than 50% of recent frames detected a finger
    return positiveRatio > 0.5;
  }
  
  /**
   * Get the signal observable for subscribing to processed signals
   */
  public getSignalObservable(): Observable<ProcessedSignal | null> {
    return this.processingSubject.asObservable();
  }
  
  /**
   * Get the metrics observable for subscribing to processing metrics
   */
  public getMetricsObservable(): Observable<ProcessingMetrics> {
    return this.metricsSubject.asObservable();
  }
  
  /**
   * Get metrics snapshot
   */
  public getMetrics(): ProcessingMetrics {
    return this.metricsSubject.value;
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    console.log("SignalProcessingService: Resetting processor");
    this.processor.reset();
    this.fingerDetectionBuffer = [];
    this.processingSubject.next(null);
  }
  
  /**
   * Get a signal channel by name
   */
  public getChannel(name: string): SignalChannel | undefined {
    return this.processor.getChannel(name);
  }
  
  /**
   * Get all channels
   */
  public getAllChannels(): Map<string, SignalChannel> {
    return this.processor.getAllChannels();
  }
}

// Create singleton instance
export const signalProcessingService = SignalProcessingService.getInstance();
