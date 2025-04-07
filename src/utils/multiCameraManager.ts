
/**
 * Multi-camera manager utility
 */

// Fix the import in line 6
import { normalizeSignalValue } from './signalNormalization';

/**
 * Class to manage multiple cameras
 */
export class MultiCameraManager {
  private cameras: MediaDeviceInfo[] = [];
  private selectedCamera: MediaDeviceInfo | null = null;
  private stream: MediaStream | null = null;
  
  /**
   * Initialize available cameras
   */
  async initialize(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', this.cameras);
      
      if (this.cameras.length > 0) {
        // Fix line 61: Use a preferred camera ID if available, otherwise use the first camera
        const preferredCameraIndex = 0; // Default to first camera
        this.selectedCamera = this.cameras[preferredCameraIndex];
        return true;
      } else {
        console.error('No cameras found');
        return false;
      }
    } catch (error) {
      console.error('Error initializing camera manager:', error);
      return false;
    }
  }
  
  /**
   * Process camera frame using the normalizeSignalValue function
   */
  processFrame(imageData: ImageData): number {
    return normalizeSignalValue(imageData.data);
  }
}
