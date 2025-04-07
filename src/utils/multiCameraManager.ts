
/**
 * Multi-camera manager utility
 */

/**
 * Process and normalize image data
 * @param data The image data array
 * @returns Normalized signal value
 */
function processImageData(data: Uint8ClampedArray): number {
  if (!data || data.length === 0) return 0;
  
  // Process red channel for PPG (every 4th value in RGBA)
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i]; // Red channel
    count++;
  }
  
  // Normalize to 0-1 range
  const average = sum / (count || 1);
  return average / 255;
}

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
   * Process camera frame using image data
   */
  processFrame(imageData: ImageData): number {
    return processImageData(imageData.data);
  }
}
