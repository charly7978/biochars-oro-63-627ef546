
/**
 * Types for the optimization system
 */

/**
 * Optimization options for channel optimizers
 */
export interface OptimizationOptions {
  // Common options
  amplificationFactor?: number;
  noiseReductionLevel?: number;
  
  // Feature flags
  baselineCorrection?: boolean;
  adaptiveFiltering?: boolean;
  adaptiveThresholds?: boolean;
  frequencyDomainProcessing?: boolean;
  morphologicalAnalysis?: boolean;
  spectralAnalysis?: boolean;
  waveletDecomposition?: boolean;
  harmonicFiltering?: boolean;
  peakEnhancement?: boolean;
  lowFrequencyEnhancement?: boolean;
  patternRecognition?: boolean;
  timeSeriesAnalysis?: boolean;
  
  // Channel-specific options can be added as needed
  [key: string]: any;
}

/**
 * Feedback data for optimization improvement
 */
export interface OptimizationFeedback {
  timestamp: number;
  measuredValue: number;
  previousValue?: number;
  referenceValue?: number;
  qualityDelta: number; // 0-1, where 1 is excellent
  confidenceLevel: number; // 0-1
  metadata?: Record<string, any>;
}

/**
 * Optimization result with enhanced signal
 */
export interface OptimizationResult {
  optimizedValues: number[];
  qualityImprovement: number; // 0-1
  confidence: number; // 0-1
  metadata: Record<string, any>;
}

/**
 * Signal quality metrics
 */
export interface SignalQualityMetrics {
  snr: number; // Signal-to-noise ratio
  stability: number; // 0-1
  amplitude: number;
  artifactCount: number;
  overallQuality: number; // 0-100
}

/**
 * Channel optimization statistics
 */
export interface ChannelOptimizationStats {
  channelName: string;
  improvementFactor: number; // 0-1
  stability: number; // 0-1
  adaptationLevel: number; // 0-1
  currentSettings: OptimizationOptions;
}
