
/**
 * Type definitions for media stream capabilities
 */

// Extend existing MediaTrackCapabilities interface from lib.dom.d.ts
interface MediaTrackCapabilities {
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

// Extend existing MediaTrackConstraintSet interface from lib.dom.d.ts
interface MediaTrackConstraintSet {
  torch?: boolean;
  exposureMode?: ConstrainDOMString;
  focusMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
  exposureCompensation?: ConstrainDouble;
  brightness?: ConstrainDouble;
  contrast?: ConstrainDouble;
}

// Define ImageCapture globally so it's accessible everywhere
declare global {
  interface Window {
    ImageCapture: typeof ImageCapture;
  }
  
  class ImageCapture {
    constructor(track: MediaStreamTrack);
    grabFrame(): Promise<ImageBitmap>;
    takePhoto(): Promise<Blob>;
  }
}

// No export needed for declaration merging
