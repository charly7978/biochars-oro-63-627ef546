
/**
 * Type definitions for media stream capabilities
 */

declare interface MediaTrackCapabilities {
  torch?: boolean;
  exposureMode?: string;
  focusMode?: string;
  whiteBalanceMode?: string;
  exposureCompensation?: {
    max?: number;
    min?: number;
    step?: number;
  };
  brightness?: {
    max?: number;
    min?: number;
    step?: number;
  };
  contrast?: {
    max?: number;
    min?: number;
    step?: number;
  };
}

declare interface MediaTrackConstraintSet {
  torch?: boolean;
  exposureMode?: ConstrainDOMString;
  focusMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
  exposureCompensation?: ConstrainDouble;
  brightness?: ConstrainDouble;
  contrast?: ConstrainDouble;
}

declare class ImageCapture {
  constructor(track: MediaStreamTrack);
  grabFrame(): Promise<ImageBitmap>;
  takePhoto(): Promise<Blob>;
}

// Ensure this file is treated as a module
export {};
