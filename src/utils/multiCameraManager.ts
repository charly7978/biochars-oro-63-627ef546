import { CameraSetting } from '@/types';
// Remove the import line or import only existing members
// import { logSignalProcessing, LogLevel } from './signalNormalization';

interface FacingModeConfig {
  exact?: string;
  ideal?: string;
}

interface CameraConfig {
  width: { ideal: number };
  height: { ideal: number };
  frameRate: { ideal: number };
  facingMode: FacingModeConfig;
}

/**
 * Manages camera settings and constraints for accessing media devices.
 */
class MultiCameraManager {
  private currentCamera: MediaStreamTrack | null = null;
  
  /**
   * Retrieves camera constraints based on the provided settings.
   * @param cameraSetting - The desired camera settings.
   * @returns MediaTrackConstraints - The camera constraints for accessing the media device.
   */
  public getCameraConstraints(cameraSetting: CameraSetting): MediaTrackConstraints {
    console.log("getCameraConstraints: ", cameraSetting);
    
    // Default camera settings
    const defaultCameraSettings: CameraConfig = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
      facingMode: { ideal: 'user' }
    };
    
    // Override default settings with provided settings
    const cameraSettings: CameraSetting = {
      ...defaultCameraSettings,
      ...cameraSetting
    };
    
    // Construct and return the constraints object
    const constraints: MediaTrackConstraints = {
      width: { ideal: cameraSettings.width },
      height: { ideal: cameraSettings.height },
      frameRate: { ideal: cameraSettings.frameRate },
      facingMode: cameraSettings.facingMode
    };
    
    console.log("Generated constraints: ", constraints);
    return constraints;
  }
  
  /**
   * Attempts to determine the optimal camera settings.
   * @returns CameraSetting - The optimal camera settings for accessing the media device.
   */
  async getOptimalCameraSettings(): Promise<CameraSetting> {
    try {
      // Attempt to access the rear camera with specific settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { exact: 'environment' }
        }
      });
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      // Stop the track and stream
      track.stop();
      stream.getTracks().forEach(track => track.stop());
      
      // Log the detected settings
      console.log("Detected camera settings: ", settings);
      
      // Return the settings as CameraSetting
      return {
        width: settings.width || 1280,
        height: settings.height || 720,
        frameRate: settings.frameRate || 30,
        facingMode: settings.facingMode || 'environment'
      };
    } catch (error) {
      console.error("Error accessing camera:", error);
      
      // Provide default settings as a fallback
      // Change the camera setting from:
      // const cameraSettings: CameraSetting | {...} = {
      //   width: { ideal: 640 },
      //   ...
      // }
      // to:
      // const cameraSettings: CameraSetting = {
      //   width: 640,  // direct number as required
      //   ...
      // }
      const cameraSettings: CameraSetting = {
        width: 640,  // direct number as required
        height: 480,
        frameRate: 30,
        facingMode: 'user'
      };
      
      return cameraSettings;
    }
  }
}

export default MultiCameraManager;
