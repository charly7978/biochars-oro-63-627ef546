export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface FrameAnalysisResult {
  isFingerDetected: boolean;
  signalValue: number;
  signalQuality: number;
  timestamp: number;
  frameData: FrameData | null;
}

export interface FrameData {
  original: number[];
  processed: number[];
  decomposition: number[][];
  residue: number[];
}

export interface ROISettings {
  rows: number;
  cols: number;
  centerWeight: number;
  qualityThreshold: number;
  redDominanceMin: number;
}

export interface EMDOptions {
  maxIterations?: number;
  threshold?: number;
  maxImf?: number;
}

export interface ProcessingOptions {
  windowSize?: number;
  roiSettings?: ROISettings;
  useGreenChannel?: boolean;
  enableEMD?: boolean;
  emdOptions?: EMDOptions;
} 