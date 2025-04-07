/**
 * Utility functions for managing multiple cameras and camera settings
 */

import { logSignalProcessing } from './signalNormalization';
import { normalizeSignal } from './signalNormalization';

/**
 * Type definition for camera settings
 */
type CameraSetting = {
  width: number;
  height: number;
  frameRate: number;
  facingMode: string;
};

/**
 * Get available cameras
 */
export async function getAvailableCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error("Error enumerating devices:", error);
    return [];
  }
}

/**
 * Select camera based on facing mode
 * @param preferredCamera Preferred camera facing mode ('user' or 'environment')
 * @returns Camera ID or undefined if not found
 */
export async function selectCamera(preferredCamera: string): Promise<string | undefined> {
  const cameras = await getAvailableCameras();
  const camera = cameras.find(camera => camera.label.toLowerCase().includes(preferredCamera));
  return camera?.deviceId;
}

/**
 * Get camera stream with specific settings
 * @param cameraId Camera ID
 * @param preferredWidth Preferred width
 * @param preferredHeight Preferred height
 * @param preferredFrameRate Preferred frame rate
 * @returns MediaStream or null if error
 */
export async function getCameraStream(
  cameraId: string,
  preferredWidth: number,
  preferredHeight: number,
  preferredFrameRate: number
): Promise<MediaStream | null> {
  try {
    const constraints: CameraSetting = {
      width: preferredWidth,
      height: preferredHeight,
      frameRate: preferredFrameRate,
      facingMode: preferredCameraId || 'environment'
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: cameraId },
        width: { ideal: preferredWidth },
        height: { ideal: preferredHeight },
        frameRate: { ideal: preferredFrameRate },
      },
      audio: false,
    });
    return stream;
  } catch (error) {
    logSignalProcessing("Error getting camera stream:", error);
    return null;
  }
}
