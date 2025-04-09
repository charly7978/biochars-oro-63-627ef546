
/**
 * Multi-camera manager for efficient camera management
 */
import { LogLevel, logSignalProcessing } from './signalNormalization';

// Interface for camera settings
export interface CameraSetting {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'environment' | 'user';
}

// Define supported resolutions
const STANDARD_RESOLUTIONS: CameraSetting[] = [
  { width: 640, height: 480, frameRate: 30, facingMode: 'environment' },
  { width: 1280, height: 720, frameRate: 30, facingMode: 'environment' },
  { width: 1920, height: 1080, frameRate: 30, facingMode: 'environment' }
];

/**
 * Multi-camera manager for handling camera streams
 */
export class MultiCameraManager {
  private activeStream: MediaStream | null = null;
  private availableDevices: MediaDeviceInfo[] = [];
  private selectedDeviceId: string | null = null;

  /**
   * Initialize the camera manager
   */
  public async initialize(): Promise<boolean> {
    try {
      logSignalProcessing(LogLevel.INFO, 'CameraManager', 'Initializing camera manager');
      
      // Get available camera devices
      this.availableDevices = await this.getVideoInputDevices();
      
      return this.availableDevices.length > 0;
    } catch (error) {
      logSignalProcessing(LogLevel.ERROR, 'CameraManager', 'Initialization error', { error });
      return false;
    }
  }
  
  /**
   * Get video stream with the highest available resolution
   */
  public async getOptimalStream(): Promise<MediaStream | null> {
    if (this.activeStream) {
      this.releaseStream();
    }
    
    // Try each resolution from highest to lowest
    for (const resolution of STANDARD_RESOLUTIONS.reverse()) {
      try {
        // Use device constraints instead of exact resolution
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: resolution.width },
            height: { ideal: resolution.height },
            frameRate: { ideal: resolution.frameRate },
            facingMode: resolution.facingMode
          },
          audio: false
        };
        
        if (this.selectedDeviceId) {
          (constraints.video as MediaTrackConstraints).deviceId = { exact: this.selectedDeviceId };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.activeStream = stream;
        
        // Get actual resolution
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        logSignalProcessing(
          LogLevel.INFO, 
          'CameraManager', 
          'Stream acquired', 
          {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate
          }
        );
        
        return stream;
      } catch (error) {
        logSignalProcessing(
          LogLevel.WARN, 
          'CameraManager', 
          `Failed to get stream at ${resolution.width}x${resolution.height}`, 
          { error }
        );
      }
    }
    
    // Try with minimal constraints as last resort
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      this.activeStream = stream;
      return stream;
    } catch (error) {
      logSignalProcessing(LogLevel.ERROR, 'CameraManager', 'Failed to get any video stream', { error });
      return null;
    }
  }
  
  /**
   * Get available video input devices
   */
  private async getVideoInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      logSignalProcessing(LogLevel.ERROR, 'CameraManager', 'Failed to enumerate devices', { error });
      return [];
    }
  }
  
  /**
   * Set specific camera device to use
   */
  public setDeviceId(deviceId: string): void {
    this.selectedDeviceId = deviceId;
    
    // Release current stream if device changed
    if (this.activeStream) {
      this.releaseStream();
    }
  }
  
  /**
   * Release current media stream
   */
  public releaseStream(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
      logSignalProcessing(LogLevel.INFO, 'CameraManager', 'Released media stream');
    }
  }
  
  /**
   * Get camera capabilities
   */
  public getCameraCapabilities(): MediaTrackCapabilities | null {
    if (!this.activeStream) return null;
    
    const videoTrack = this.activeStream.getVideoTracks()[0];
    if (!videoTrack) return null;
    
    return videoTrack.getCapabilities();
  }
  
  /**
   * Get available camera devices
   */
  public getAvailableDevices(): MediaDeviceInfo[] {
    return this.availableDevices;
  }
}
