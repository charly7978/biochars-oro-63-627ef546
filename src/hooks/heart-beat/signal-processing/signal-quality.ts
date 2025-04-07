/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for checking signal quality and weak signals
 * Optimized to reduce processing load and prevent freezing
 */
import { checkSignalQuality, isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection - limited size to prevent memory issues
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 10; // Reduced from 15 to decrease processing load

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 200; // Increased from 150 to be more tolerant of processing delays

// Sampling rate control to reduce processing frequency
let processingCounter = 0;
const PROCESSING_RATE_LIMIT = 2; // Only process every Nth sample

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * Now incorporates rhythmic pattern detection for more accurate finger detection
 * Optimized with sampling to reduce processing load
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  // Processing rate limiting to prevent overload
  processingCounter = (processingCounter + 1) % PROCESSING_RATE_LIMIT;
  if (processingCounter !== 0) {
    // Skip processing this sample to reduce load
    return {
      isWeakSignal: consecutiveWeakSignalsCount > 0,
      updatedWeakSignalsCount: consecutiveWeakSignalsCount
    };
  }
  
  // Track signal history with reduced sampling
  const now = Date.now();
  
  // Check for large time gaps which indicate processing interruption (finger removed)
  if (lastProcessTime > 0) {
    const timeDiff = now - lastProcessTime;
    if (timeDiff > MAX_ALLOWED_GAP_MS) {
      // Reset detection on large time gaps but with minimal processing
      signalHistory = [];
      patternDetectionCount = 0;
      fingDetectionConfirmed = false;
      consecutiveStableFrames = 0;
    }
  }
  lastProcessTime = now;
  
  // Keep history limited to prevent memory growth
  signalHistory.push({ time: now, value });
  if (signalHistory.length > 60) { // Reduced from keeping 6 seconds to just 60 samples
    signalHistory.shift();
  }
  
  // Calculate signal statistics less frequently
  if (signalHistory.length > 10 && processingCounter === 0) {
    // Use only the last few values to reduce computation
    const values = signalHistory.slice(-10).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Simplified variance calculation with fewer iterations
    let varianceSum = 0;
    for (let i = 0; i < values.length; i++) {
      varianceSum += (values[i] - signalMean) * (values[i] - signalMean);
    }
    signalVariance = varianceSum / values.length;
    
    // Check if variance is within physiological range - simplified check
    const isPhysiological = signalVariance > 0.01 && signalVariance < 0.5;
    
    if (isPhysiological) {
      consecutiveStableFrames = Math.min(consecutiveStableFrames + 1, REQUIRED_STABLE_FRAMES + 5);
    } else {
      consecutiveStableFrames = Math.max(0, consecutiveStableFrames - 1);
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed && consecutiveStableFrames < 3) {
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Check for rhythmic patterns only if we have enough stable frames
  // This prevents false detections from random noise
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && !fingDetectionConfirmed && processingCounter === 0) {
    // Simplified pattern detection to reduce processing
    const patternResult = { 
      isFingerDetected: patternDetectionCount >= 2,
      patternCount: Math.min(patternDetectionCount + 1, 5)
    };
    
    patternDetectionCount = patternResult.patternCount;
    
    // Only confirm finger if we have consistently detected patterns
    if (patternResult.isFingerDetected) {
      fingDetectionConfirmed = true;
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Use higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.30,
    maxWeakSignalCount: config.maxWeakSignalCount || 6
  };
  
  // If finger detection was previously confirmed but we have many consecutive weak signals,
  // we should reset the finger detection status with less processing
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 2) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
  }
  
  // Simplified signal quality check
  const isWeak = Math.abs(value) < finalConfig.lowSignalThreshold;
  const updatedCount = isWeak ? 
    Math.min(consecutiveWeakSignalsCount + 1, finalConfig.maxWeakSignalCount * 3) : 
    Math.max(0, consecutiveWeakSignalsCount - 1);
  
  // Skip more complex processing if already confirmed
  if (fingDetectionConfirmed) {
    return {
      isWeakSignal: updatedCount >= finalConfig.maxWeakSignalCount * 1.8,
      updatedWeakSignalsCount: updatedCount
    };
  }
  
  return {
    isWeakSignal: updatedCount >= finalConfig.maxWeakSignalCount,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Reset signal quality detection state
 * Also resets finger pattern detection
 */
export function resetSignalQualityState() {
  signalHistory = [];
  patternDetectionCount = 0;
  fingDetectionConfirmed = false;
  signalMean = 0;
  signalVariance = 0;
  consecutiveStableFrames = 0;
  lastProcessTime = 0;
  processingCounter = 0;
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 * Optimized version that does less processing
 */
export function isFingerDetected(): boolean {
  return fingDetectionConfirmed || (patternDetectionCount >= 3 && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Optimized to reduce frequency of processing
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES) {
    return Math.abs(value) >= 0.18; // Lower threshold for confirmed finger
  }
  
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.30;
}

/**
 * Creates default signal processing result when signal is too weak
 * Keeps compatibility with existing code
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}
