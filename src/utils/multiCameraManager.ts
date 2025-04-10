
/**
 * Multi-camera manager for enhancing PPG signal quality
 * Enables using multiple cameras simultaneously for better signal capture
 */

import { logSignalProcessing, LogLevel } from './signalNormalization';

export interface CameraDevice {
  deviceId: string;
  label: string;
  facing: 'user' | 'environment' | 'unknown';
  active: boolean;
  stream: MediaStream | null;
  element: HTMLVideoElement | null;
  signalQuality: number;
}

export interface CameraSetting {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export interface MultiCameraManagerOptions {
  maxCameras?: number;
  preferredFacing?: 'user' | 'environment';
  cameraSettings?: CameraSetting;
}

export interface ProcessedFrame {
  timestamp: number;
  source: string;
  imageData: ImageData;
  signalValue: number;
  quality: number;
}

export class MultiCameraManager {
  private devices: CameraDevice[] = [];
  private isInitialized: boolean = false;
  private readonly maxCameras: number;
  private readonly preferredFacing: 'user' | 'environment';
  private readonly cameraSettings: CameraSetting;
  private frameProcessor: ((frame: ProcessedFrame) => void) | null = null;
  private processingActive: boolean = false;
  private animationFrameIds: Record<string, number> = {};
  private errorCount: Record<string, number> = {};
  private canvasContexts: Record<string, { canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }> = {};

  /**
   * Create a new multi-camera manager
   */
  constructor(options: MultiCameraManagerOptions = {}) {
    this.maxCameras = options.maxCameras || 2;
    this.preferredFacing = options.preferredFacing || 'user';
    this.cameraSettings = options.cameraSettings || {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
      facingMode: this.preferredFacing
    };
    
    logSignalProcessing(
      LogLevel.INFO, 
      'MultiCamera', 
      'MultiCameraManager created',
      { maxCameras: this.maxCameras, preferredFacing: this.preferredFacing }
    );
  }

  /**
   * Initialize the camera manager and detect available devices
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }
      
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        logSignalProcessing(
          LogLevel.ERROR, 
          'MultiCamera', 
          'MediaDevices API not supported'
        );
        return false;
      }
      
      // Get permission to access camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        logSignalProcessing(
          LogLevel.ERROR, 
          'MultiCamera', 
          'Failed to get camera permission',
          { error }
        );
        return false;
      }
      
      // Enumerate available camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        logSignalProcessing(
          LogLevel.ERROR, 
          'MultiCamera', 
          'No video input devices found'
        );
        return false;
      }
      
      // Reset devices array
      this.devices = [];
      
      // Create device entries
      for (const device of videoDevices) {
        // Try to determine camera facing
        let facing: 'user' | 'environment' | 'unknown' = 'unknown';
        
        if (device.label.toLowerCase().includes('front') || 
            device.label.toLowerCase().includes('face') ||
            device.label.toLowerCase().includes('user')) {
          facing = 'user';
        } else if (device.label.toLowerCase().includes('back') ||
                  device.label.toLowerCase().includes('rear') ||
                  device.label.toLowerCase().includes('environment')) {
          facing = 'environment';
        }
        
        this.devices.push({
          deviceId: device.deviceId,
          label: device.label || `Camera ${this.devices.length + 1}`,
          facing,
          active: false,
          stream: null,
          element: null,
          signalQuality: 0
        });
      }
      
      logSignalProcessing(
        LogLevel.INFO, 
        'MultiCamera', 
        'Detected camera devices',
        { count: this.devices.length, devices: this.devices.map(d => ({ label: d.label, facing: d.facing })) }
      );
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Error initializing MultiCameraManager',
        { error }
      );
      return false;
    }
  }

  /**
   * Get list of available camera devices
   */
  public getDevices(): CameraDevice[] {
    return [...this.devices];
  }

  /**
   * Start camera stream for a specific device
   */
  public async startCamera(deviceId: string): Promise<boolean> {
    try {
      const device = this.devices.find(d => d.deviceId === deviceId);
      if (!device) {
        logSignalProcessing(
          LogLevel.ERROR, 
          'MultiCamera', 
          'Device not found',
          { deviceId }
        );
        return false;
      }
      
      if (device.active && device.stream) {
        return true; // Already active
      }
      
      // Create constraints
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: deviceId },
          width: this.cameraSettings.width,
          height: this.cameraSettings.height,
          frameRate: this.cameraSettings.frameRate
        }
      };
      
      // Get stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      device.stream = stream;
      device.active = true;
      
      // Create video element if needed
      if (!device.element) {
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.style.display = 'none'; // Hidden from view
        document.body.appendChild(video);
        device.element = video;
      }
      
      // Set stream to element
      device.element.srcObject = stream;
      await device.element.play();
      
      // Create processing canvas for this device
      this.createProcessingCanvas(deviceId);
      
      // Start processing frames if global processing is active
      if (this.processingActive) {
        this.startFrameProcessing(deviceId);
      }
      
      logSignalProcessing(
        LogLevel.INFO, 
        'MultiCamera', 
        'Camera started',
        { deviceId, label: device.label }
      );
      
      return true;
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Error starting camera',
        { deviceId, error }
      );
      return false;
    }
  }

  /**
   * Stop camera stream for a specific device
   */
  public stopCamera(deviceId: string): boolean {
    try {
      const device = this.devices.find(d => d.deviceId === deviceId);
      if (!device) {
        return false;
      }
      
      // Stop frame processing
      this.stopFrameProcessing(deviceId);
      
      // Stop all tracks in the stream
      if (device.stream) {
        device.stream.getTracks().forEach(track => track.stop());
      }
      
      // Update device status
      device.active = false;
      device.stream = null;
      device.signalQuality = 0;
      
      logSignalProcessing(
        LogLevel.INFO, 
        'MultiCamera', 
        'Camera stopped',
        { deviceId, label: device.label }
      );
      
      return true;
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Error stopping camera',
        { deviceId, error }
      );
      return false;
    }
  }

  /**
   * Start multiple cameras of preferred facing
   */
  public async startCameras(): Promise<number> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      let startedCount = 0;
      
      // First, try to start cameras of preferred facing
      let preferredDevices = this.devices.filter(d => d.facing === this.preferredFacing);
      
      // If no preferred devices, use any available
      if (preferredDevices.length === 0) {
        preferredDevices = this.devices;
      }
      
      // Try to start up to maxCameras
      for (let i = 0; i < Math.min(this.maxCameras, preferredDevices.length); i++) {
        const success = await this.startCamera(preferredDevices[i].deviceId);
        if (success) {
          startedCount++;
        }
      }
      
      // If preferred facing didn't provide enough cameras, try others
      if (startedCount < this.maxCameras) {
        const remainingDevices = this.devices.filter(
          d => d.facing !== this.preferredFacing && !d.active
        );
        
        for (let i = 0; i < Math.min(this.maxCameras - startedCount, remainingDevices.length); i++) {
          const success = await this.startCamera(remainingDevices[i].deviceId);
          if (success) {
            startedCount++;
          }
        }
      }
      
      logSignalProcessing(
        LogLevel.INFO, 
        'MultiCamera', 
        'Started multiple cameras',
        { requested: this.maxCameras, started: startedCount }
      );
      
      return startedCount;
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Error starting multiple cameras',
        { error }
      );
      return 0;
    }
  }

  /**
   * Stop all active cameras
   */
  public stopAllCameras(): void {
    const activeDevices = this.devices.filter(d => d.active);
    
    for (const device of activeDevices) {
      this.stopCamera(device.deviceId);
    }
    
    logSignalProcessing(
      LogLevel.INFO, 
      'MultiCamera', 
      'All cameras stopped',
      { count: activeDevices.length }
    );
  }

  /**
   * Set frame processor function
   */
  public setFrameProcessor(processor: (frame: ProcessedFrame) => void): void {
    this.frameProcessor = processor;
    logSignalProcessing(LogLevel.INFO, 'MultiCamera', 'Frame processor set');
  }

  /**
   * Start processing frames from all active cameras
   */
  public startProcessing(): void {
    if (!this.frameProcessor) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Cannot start processing: No frame processor set'
      );
      return;
    }
    
    this.processingActive = true;
    
    const activeDevices = this.devices.filter(d => d.active);
    
    for (const device of activeDevices) {
      this.startFrameProcessing(device.deviceId);
    }
    
    logSignalProcessing(
      LogLevel.INFO, 
      'MultiCamera', 
      'Processing started',
      { activeCameras: activeDevices.length }
    );
  }

  /**
   * Stop processing frames
   */
  public stopProcessing(): void {
    this.processingActive = false;
    
    const activeDevices = this.devices.filter(d => d.active);
    
    for (const device of activeDevices) {
      this.stopFrameProcessing(device.deviceId);
    }
    
    logSignalProcessing(LogLevel.INFO, 'MultiCamera', 'Processing stopped');
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopProcessing();
    this.stopAllCameras();
    
    // Clean up video elements
    for (const device of this.devices) {
      if (device.element && device.element.parentNode) {
        device.element.parentNode.removeChild(device.element);
      }
    }
    
    // Clean up canvas elements
    for (const id in this.canvasContexts) {
      const { canvas } = this.canvasContexts[id];
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
    
    this.canvasContexts = {};
    this.devices = [];
    this.isInitialized = false;
    
    logSignalProcessing(LogLevel.INFO, 'MultiCamera', 'Disposed');
  }

  /**
   * Create processing canvas for a camera
   */
  private createProcessingCanvas(deviceId: string): void {
    if (this.canvasContexts[deviceId]) {
      return; // Already exists
    }
    
    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      logSignalProcessing(
        LogLevel.ERROR, 
        'MultiCamera', 
        'Could not get canvas context',
        { deviceId }
      );
      return;
    }
    
    this.canvasContexts[deviceId] = { canvas, ctx };
  }

  /**
   * Start processing frames from a specific camera
   */
  private startFrameProcessing(deviceId: string): void {
    if (this.animationFrameIds[deviceId]) {
      return; // Already processing
    }
    
    const device = this.devices.find(d => d.deviceId === deviceId);
    if (!device || !device.active || !device.element || !this.canvasContexts[deviceId]) {
      return;
    }
    
    // Reset error count
    this.errorCount[deviceId] = 0;
    
    const processFrame = () => {
      try {
        const { element: video } = device;
        const { canvas, ctx } = this.canvasContexts[deviceId];
        
        if (!video || video.readyState < 2) {
          // Not ready yet, request next frame
          this.animationFrameIds[deviceId] = requestAnimationFrame(processFrame);
          return;
        }
        
        // Set canvas size to match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data from center region
        const centerX = Math.floor(canvas.width * 0.25);
        const centerY = Math.floor(canvas.height * 0.25);
        const centerWidth = Math.floor(canvas.width * 0.5);
        const centerHeight = Math.floor(canvas.height * 0.5);
        
        const imageData = ctx.getImageData(centerX, centerY, centerWidth, centerHeight);
        
        // Extract red channel for PPG signal
        let redSum = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < imageData.data.length; i += 4) {
          redSum += imageData.data[i]; // Red channel
          pixelCount++;
        }
        
        const redAverage = redSum / pixelCount;
        
        // Simple quality metric based on standard deviation
        let sumSquares = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          sumSquares += Math.pow(imageData.data[i] - redAverage, 2);
        }
        
        const stdDev = Math.sqrt(sumSquares / pixelCount);
        const signalToNoise = redAverage / (stdDev + 1); // Avoid division by zero
        
        // Scale to 0-100 quality score
        const quality = Math.min(100, Math.max(0, signalToNoise * 10));
        
        // Update device quality
        device.signalQuality = quality;
        
        // Process frame
        if (this.frameProcessor && this.processingActive) {
          this.frameProcessor({
            timestamp: Date.now(),
            source: deviceId,
            imageData,
            signalValue: redAverage,
            quality
          });
        }
        
        // Reset error count on success
        this.errorCount[deviceId] = 0;
      } catch (error) {
        this.errorCount[deviceId] = (this.errorCount[deviceId] || 0) + 1;
        
        // Only log errors occasionally to avoid flooding
        if (this.errorCount[deviceId] <= 3 || this.errorCount[deviceId] % 100 === 0) {
          logSignalProcessing(
            LogLevel.ERROR, 
            'MultiCamera', 
            'Error processing frame',
            { deviceId, error, errorCount: this.errorCount[deviceId] }
          );
        }
        
        // If too many errors, stop camera
        if (this.errorCount[deviceId] > 1000) {
          logSignalProcessing(
            LogLevel.ERROR, 
            'MultiCamera', 
            'Too many errors, stopping camera',
            { deviceId }
          );
          this.stopCamera(deviceId);
          return;
        }
      }
      
      // Request next frame if still processing
      if (this.processingActive) {
        this.animationFrameIds[deviceId] = requestAnimationFrame(processFrame);
      }
    };
    
    // Start processing
    this.animationFrameIds[deviceId] = requestAnimationFrame(processFrame);
  }

  /**
   * Stop processing frames from a specific camera
   */
  private stopFrameProcessing(deviceId: string): void {
    if (this.animationFrameIds[deviceId]) {
      cancelAnimationFrame(this.animationFrameIds[deviceId]);
      delete this.animationFrameIds[deviceId];
    }
  }

  /**
   * Get combined signal from all active cameras
   * @returns Combined signal value and quality score
   */
  public getCombinedSignal(): { value: number, quality: number } {
    const activeDevices = this.devices.filter(d => d.active && d.signalQuality > 0);
    
    if (activeDevices.length === 0) {
      return { value: 0, quality: 0 };
    }
    
    // Weight by quality
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const device of activeDevices) {
      // Higher quality = higher weight
      const weight = device.signalQuality;
      weightedSum += weight * device.signalQuality;
      totalWeight += weight;
    }
    
    // Calculate average quality
    const avgQuality = activeDevices.reduce((sum, d) => sum + d.signalQuality, 0) / activeDevices.length;
    
    return {
      value: totalWeight > 0 ? weightedSum / totalWeight : 0,
      quality: avgQuality
    };
  }
}
