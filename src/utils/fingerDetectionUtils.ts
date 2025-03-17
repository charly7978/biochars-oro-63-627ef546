
import { ProcessedSignal } from '../types/signal';

// Constants for robust finger detection
const HISTORY_SIZE = 5;
const MIN_DETECTION_THRESHOLD = 0.30;
const MAX_SIGNAL_LOCK = 4;
const RELEASE_GRACE_PERIOD = 3;
const ADAPTIVE_ADJUSTMENT_INTERVAL = 40;

/**
 * Utility for robust and adaptive finger detection
 */
export const processRobustFingerDetection = (
  signal: ProcessedSignal,
  qualityHistory: number[],
  fingerDetectedHistory: boolean[],
  consecutiveNonDetection: number,
  detectionThreshold: number,
  adaptiveCounter: number,
  signalLockCounter: number
): {
  updatedSignal: ProcessedSignal;
  updatedQualityHistory: number[];
  updatedFingerDetectedHistory: boolean[];
  updatedConsecutiveNonDetection: number;
  updatedDetectionThreshold: number;
  updatedAdaptiveCounter: number;
  updatedSignalLockCounter: number;
} => {
  // Update histories
  const updatedQualityHistory = [...qualityHistory, signal.quality];
  if (updatedQualityHistory.length > HISTORY_SIZE) {
    updatedQualityHistory.shift();
  }
  
  const updatedFingerDetectedHistory = [...fingerDetectedHistory, signal.fingerDetected];
  if (updatedFingerDetectedHistory.length > HISTORY_SIZE) {
    updatedFingerDetectedHistory.shift();
  }
  
  // Calculate detection ratio
  const rawDetectionRatio = updatedFingerDetectedHistory.filter(d => d).length / 
                          Math.max(1, updatedFingerDetectedHistory.length);
  
  // Calculate weighted quality (more weight to recent values)
  let weightedQualitySum = 0;
  let weightSum = 0;
  updatedQualityHistory.forEach((quality, index) => {
    const weight = Math.pow(1.2, index); // Less aggressive exponential weighting
    weightedQualitySum += quality * weight;
    weightSum += weight;
  });
  
  const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
  
  // Adaptive logic to adjust threshold
  let updatedAdaptiveCounter = adaptiveCounter + 1;
  let updatedDetectionThreshold = detectionThreshold;
  
  if (updatedAdaptiveCounter >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
    updatedAdaptiveCounter = 0;
    
    const consistentDetection = rawDetectionRatio > 0.8;
    const consistentNonDetection = rawDetectionRatio < 0.2;
    
    if (consistentNonDetection) {
      // Make detection easier
      updatedDetectionThreshold = Math.max(
        MIN_DETECTION_THRESHOLD,
        updatedDetectionThreshold - 0.08
      );
    } else if (consistentDetection && avgQuality < 35) {
      // Be stricter with detection but low quality
      updatedDetectionThreshold = Math.min(
        0.6,
        updatedDetectionThreshold + 0.05
      );
    }
  }
  
  // "Lock-in" logic for stability
  let updatedConsecutiveNonDetection = consecutiveNonDetection;
  let updatedSignalLockCounter = signalLockCounter;
  
  if (signal.fingerDetected) {
    updatedConsecutiveNonDetection = 0;
    updatedSignalLockCounter = Math.min(MAX_SIGNAL_LOCK, updatedSignalLockCounter + 1);
  } else {
    if (updatedSignalLockCounter >= MAX_SIGNAL_LOCK) {
      updatedConsecutiveNonDetection++;
      
      if (updatedConsecutiveNonDetection > RELEASE_GRACE_PERIOD) {
        updatedSignalLockCounter = Math.max(0, updatedSignalLockCounter - 1);
      }
    } else {
      updatedSignalLockCounter = Math.max(0, updatedSignalLockCounter - 1);
    }
  }
  
  // Final determination with more natural criteria
  const isLockedIn = updatedSignalLockCounter >= MAX_SIGNAL_LOCK - 1;
  const robustFingerDetected = isLockedIn || rawDetectionRatio >= updatedDetectionThreshold;
  
  // Quality enhancement for smoother experience
  const enhancementFactor = robustFingerDetected ? 1.08 : 1.0;
  const enhancedQuality = Math.min(100, avgQuality * enhancementFactor);
  
  const updatedSignal = {
    ...signal,
    fingerDetected: robustFingerDetected,
    quality: enhancedQuality,
    perfusionIndex: signal.perfusionIndex,
    spectrumData: signal.spectrumData
  };
  
  return {
    updatedSignal,
    updatedQualityHistory,
    updatedFingerDetectedHistory,
    updatedConsecutiveNonDetection,
    updatedDetectionThreshold,
    updatedAdaptiveCounter,
    updatedSignalLockCounter
  };
};
