
// Correcciones:
// - Eliminamos los imports de miembros no existentes 'logSignalProcessing' y 'LogLevel'
// - Cambiamos la estructura de las propiedades width, height y frameRate para que usen tipos number en lugar de { ideal: number }
// - Cambiamos getCameraConstraints para aceptar CameraSetting con números directos
// - Corregimos devolución en getOptimalCameraSettings asegurando que los objetos concuerdan con CameraSetting (propiedades number)

interface FacingModeConfig {
  exact?: string;
  ideal?: string;
}

interface CameraSetting {
  width: number;
  height: number;
  frameRate: number;
  facingMode: string;
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
    const defaultCameraSettings: CameraSetting = {
      width: 640,
      height: 480,
      frameRate: 30,
      facingMode: 'user'
    };
    
    // Override default settings with provided settings
    const cameraSettings: CameraSetting = {
      ...defaultCameraSettings,
      ...cameraSetting
    };
    
    // Construct and return the constraints object
    const constraints: MediaTrackConstraints = {
      width: cameraSettings.width,
      height: cameraSettings.height,
      frameRate: cameraSettings.frameRate,
      facingMode: cameraSettings.facingMode as MediaTrackConstraintSet['facingMode']
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
          width: 1280,
          height: 720,
          facingMode: { exact: 'environment' }
        }
      });
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      // Stop the track and stream
      track.stop();
      stream.getTracks().forEach(t => t.stop());
      
      // Log the detected settings
      console.log("Detected camera settings: ", settings);
      
      // Return the settings as CameraSetting
      return {
        width: settings.width || 1280,
        height: settings.height || 720,
        frameRate: settings.frameRate || 30,
        facingMode: (settings.facingMode as string) || 'environment'
      };
    } catch (error) {
      console.error("Error accessing camera:", error);
      // Provide default settings as a fallback
      const cameraSettings: CameraSetting = {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'user'
      };
      return cameraSettings;
    }
  }
}

export default MultiCameraManager;

