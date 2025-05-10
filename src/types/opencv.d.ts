
/**
 * TypeScript declarations for OpenCV.js
 */
declare namespace cv {
  // Basic Mat class
  class Mat {
    constructor(rows?: number, cols?: number, type?: number, fill?: Scalar);
    cols: number;
    rows: number;
    data: Uint8Array | Float32Array | Float64Array;
    data8S: Int8Array;
    data16S: Int16Array;
    data16U: Uint16Array;
    data32S: Int32Array;
    data32F: Float32Array;
    data64F: Float64Array;
    delete(): void;
  }

  // Point class
  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  // Size class
  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  // Rect class
  class Rect {
    constructor(x: number, y: number, width: number, height: number);
    x: number;
    y: number;
    width: number;
    height: number;
  }

  // Scalar class
  class Scalar {
    constructor(v0: number, v1: number, v2: number, v3: number);
  }

  // Common constants
  const CV_8U: number;
  const CV_8S: number;
  const CV_16U: number;
  const CV_16S: number;
  const CV_32S: number;
  const CV_32F: number;
  const CV_64F: number;
  
  const ADAPTIVE_THRESH_GAUSSIAN_C: number;
  const ADAPTIVE_THRESH_MEAN_C: number;
  const THRESH_BINARY: number;
  const BORDER_REPLICATE: number;

  // Common functions
  function medianBlur(src: Mat, dst: Mat, ksize: number): void;
  function GaussianBlur(src: Mat, dst: Mat, size: Size, sigmaX: number, sigmaY?: number, borderType?: number): void;
  function Sobel(src: Mat, dst: Mat, ddepth: number, dx: number, dy: number, ksize?: number, scale?: number, delta?: number, borderType?: number): void;
  function adaptiveThreshold(src: Mat, dst: Mat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): void;
  function filter2D(src: Mat, dst: Mat, ddepth: number, kernel: Mat, anchor?: Point, delta?: number, borderType?: number): void;
  function matFromArray(rows: number, cols: number, type: number, array: number[]): Mat;
}

// Global OpenCV objects
interface Window {
  cv: typeof cv;
  cv_ready: boolean;
}
