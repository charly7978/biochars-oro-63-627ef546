
import { logSignalProcessing, LogLevel } from './signalLogging';

interface CameraSetting {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

/**
 * Manages multiple camera streams, selecting the best available camera
 * and providing utility functions for camera settings.
 */
export class MultiCameraManager {
  private stream: MediaStream | null = null;
  
  /**
   * Safely stop the current camera stream
   */
  public stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
  }
  
  /**
   * Get the best available camera stream based on preferred settings
   */
  public async getBestCameraStream(
    preferredWidth: number,
    preferredHeight: number,
    preferredFrameRate: number,
    preferredFacingMode: 'user' | 'environment'
  ): Promise<MediaStream> {
    this.stopStream();
    
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: preferredWidth },
        height: { ideal: preferredHeight },
        frameRate: { ideal: preferredFrameRate },
        facingMode: preferredFacingMode
      }
    };
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      logSignalProcessing(
        LogLevel.INFO, 
        'CameraManager', 
        'Successfully obtained camera stream with preferred settings',
        {
          width: preferredWidth,
          height: preferredHeight,
          frameRate: preferredFrameRate,
          facingMode: preferredFacingMode
        }
      );
      
      return this.stream;
    } catch (error) {
      logSignalProcessing(
        LogLevel.WARN,
        'CameraManager',
        'Could not obtain camera stream with preferred settings, trying fallback',
        {
          width: preferredWidth,
          height: preferredHeight,
          frameRate: preferredFrameRate,
          facingMode: preferredFacingMode,
          error
        }
      );
      
      // Fallback to any available camera
      const settings: CameraSetting = {
        width: preferredWidth,
        height: preferredHeight,
        frameRate: preferredFrameRate,
        facingMode: preferredFacingMode
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia({ video: settings, audio: false });
      return this.stream;
    }
  }
}
