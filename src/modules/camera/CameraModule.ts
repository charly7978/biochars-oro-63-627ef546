
/**
 * Camera Module
 * Responsible for accessing the camera, managing streams and extracting raw frame data
 */

import { EventType, eventBus } from '../events/EventBus';
import { CameraConfig, ProcessingError, RawSignalFrame } from '../types/signal';

export class CameraModule {
  private stream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private imageCapture: ImageCapture | null = null;
  private isProcessing: boolean = false;
  private processingCanvas: HTMLCanvasElement;
  private processingContext: CanvasRenderingContext2D | null = null;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private targetFrameRate: number = 30;
  private readonly FRAME_INTERVAL_MS: number = 1000 / 30;
  
  constructor(private config: CameraConfig = {
    facingMode: 'environment',
    width: 640,
    height: 480,
    frameRate: 30,
    torch: false
  }) {
    // Create offscreen canvas for processing
    this.processingCanvas = document.createElement('canvas');
    this.processingContext = this.processingCanvas.getContext('2d', { willReadFrequently: true });
    
    // Set canvas dimensions
    this.processingCanvas.width = 320; // Processing size reduced for performance
    this.processingCanvas.height = 240;
    
    // Set target frame rate
    this.targetFrameRate = config.frameRate;
    this.FRAME_INTERVAL_MS = 1000 / this.targetFrameRate;
  }
  
  /**
   * Start the camera with the specified configuration
   */
  async start(): Promise<void> {
    try {
      if (this.stream) {
        this.stop();
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      
      // Configure camera constraints
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: this.config.frameRate }
        }
      };
      
      // Access camera
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoTrack = this.stream.getVideoTracks()[0];
      
      // Create ImageCapture for grabbing frames
      if (this.videoTrack) {
        this.imageCapture = new ImageCapture(this.videoTrack);
        
        // Apply additional camera settings if available
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid && this.videoTrack.getCapabilities) {
          const capabilities = this.videoTrack.getCapabilities();
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // Enable optimal settings for PPG
          if (capabilities.exposureMode) {
            advancedConstraints.push({ exposureMode: 'continuous' });
          }
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }
          
          // Enable torch if requested and available
          if (this.config.torch && capabilities.torch) {
            try {
              await this.videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              console.log('Camera torch activated');
            } catch (err) {
              console.warn('Failed to activate torch:', err);
            }
          }
          
          // Apply all advanced constraints
          if (advancedConstraints.length > 0) {
            try {
              await this.videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
              console.log('Applied advanced camera constraints');
            } catch (err) {
              console.warn('Failed to apply some camera optimizations:', err);
            }
          }
        }
        
        // Notify that camera is ready
        eventBus.publish(EventType.CAMERA_READY, {
          stream: this.stream,
          track: this.videoTrack
        });
        
        console.log('Camera initialized successfully');
      } else {
        throw new Error('No video track available');
      }
    } catch (error) {
      console.error('Camera initialization error:', error);
      const processingError: ProcessingError = {
        code: 'CAMERA_INIT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to initialize camera',
        timestamp: Date.now(),
        source: 'CameraModule'
      };
      eventBus.publish(EventType.CAMERA_ERROR, processingError);
      throw error;
    }
  }
  
  /**
   * Stop the camera and release resources
   */
  stop(): void {
    this.isProcessing = false;
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
      this.videoTrack = null;
      this.imageCapture = null;
    }
    
    console.log('Camera stopped and resources released');
  }
  
  /**
   * Start processing frames from the camera
   */
  startProcessing(): void {
    if (!this.stream || !this.imageCapture) {
      const error: ProcessingError = {
        code: 'CAMERA_NOT_READY',
        message: 'Camera not initialized',
        timestamp: Date.now(),
        source: 'CameraModule'
      };
      eventBus.publish(EventType.CAMERA_ERROR, error);
      return;
    }
    
    this.isProcessing = true;
    this.processNextFrame();
    console.log('Started camera frame processing');
  }
  
  /**
   * Stop processing frames
   */
  stopProcessing(): void {
    this.isProcessing = false;
    console.log('Stopped camera frame processing');
  }
  
  /**
   * Process the next frame from the camera
   */
  private async processNextFrame(): Promise<void> {
    if (!this.isProcessing || !this.imageCapture) return;
    
    const now = Date.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    
    // Control frame rate
    if (timeSinceLastFrame >= this.FRAME_INTERVAL_MS) {
      try {
        const frame = await this.imageCapture.grabFrame();
        this.frameCount++;
        this.lastFrameTime = now;
        
        // Extract signal from frame
        const signalFrame = this.extractSignalFromFrame(frame);
        
        // Publish the extracted signal
        eventBus.publish(EventType.CAMERA_FRAME, signalFrame);
        
        // Performance logging every 30 frames
        if (this.frameCount % 30 === 0) {
          const fps = 1000 / (timeSinceLastFrame || 1);
          console.log(`Camera processing at ${fps.toFixed(1)} FPS`);
        }
      } catch (error) {
        console.error('Error processing camera frame:', error);
        const processingError: ProcessingError = {
          code: 'FRAME_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Frame processing error',
          timestamp: Date.now(),
          source: 'CameraModule'
        };
        eventBus.publish(EventType.ERROR_OCCURRED, processingError);
      }
    }
    
    // Schedule next frame
    requestAnimationFrame(() => this.processNextFrame());
  }
  
  /**
   * Extract signal data from a video frame
   */
  private extractSignalFromFrame(frame: ImageBitmap): RawSignalFrame {
    if (!this.processingContext) {
      throw new Error('Processing context not available');
    }
    
    // Clear canvas and draw frame
    this.processingContext.clearRect(0, 0, this.processingCanvas.width, this.processingCanvas.height);
    this.processingContext.drawImage(
      frame, 
      0, 0, frame.width, frame.height,
      0, 0, this.processingCanvas.width, this.processingCanvas.height
    );
    
    // Get image data from the central area (30% of frame)
    const centerX = Math.floor(this.processingCanvas.width * 0.35);
    const centerY = Math.floor(this.processingCanvas.height * 0.35);
    const centerWidth = Math.floor(this.processingCanvas.width * 0.3);
    const centerHeight = Math.floor(this.processingCanvas.height * 0.3);
    
    const imageData = this.processingContext.getImageData(
      centerX, centerY, centerWidth, centerHeight
    );
    
    // Extract RGB channels
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      redSum += data[i];
      greenSum += data[i + 1];
      blueSum += data[i + 2];
      pixelCount++;
    }
    
    // Calculate averages
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calculate simple frame quality metric (0-100)
    const brightness = (avgRed + avgGreen + avgBlue) / 3;
    const contrast = Math.abs(avgRed - avgGreen) + Math.abs(avgRed - avgBlue) + Math.abs(avgGreen - avgBlue);
    const frameQuality = Math.min(100, Math.max(0, 
      (brightness > 20 && brightness < 240) ? 80 : 40 + 
      (contrast > 5 ? 20 : 0)
    ));
    
    return {
      timestamp: Date.now(),
      redChannel: avgRed,
      greenChannel: avgGreen,
      blueChannel: avgBlue,
      frameQuality
    };
  }
  
  /**
   * Update camera configuration
   */
  async updateConfig(newConfig: Partial<CameraConfig>): Promise<void> {
    // Merge new config with current config
    this.config = { ...this.config, ...newConfig };
    
    // If camera is active, restart with new config
    if (this.stream) {
      const wasProcessing = this.isProcessing;
      this.stopProcessing();
      this.stop();
      await this.start();
      if (wasProcessing) {
        this.startProcessing();
      }
    }
  }
  
  /**
   * Toggle torch/flashlight
   */
  async toggleTorch(enable: boolean): Promise<boolean> {
    if (!this.videoTrack) return false;
    
    try {
      const capabilities = this.videoTrack.getCapabilities();
      if (capabilities.torch) {
        await this.videoTrack.applyConstraints({
          advanced: [{ torch: enable }]
        });
        this.config.torch = enable;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error toggling torch:', error);
      return false;
    }
  }
  
  /**
   * Get current camera status
   */
  getStatus(): {
    active: boolean;
    processing: boolean;
    config: CameraConfig;
    frameCount: number;
  } {
    return {
      active: !!this.stream,
      processing: this.isProcessing,
      config: { ...this.config },
      frameCount: this.frameCount
    };
  }
}

// Export singleton instance
export const cameraModule = new CameraModule();
