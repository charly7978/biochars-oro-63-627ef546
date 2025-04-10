
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for checking signal quality and weak signals
 * Improved to reduce false positives and add rhythmic pattern detection
 */
import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 15; // Must have physiologically stable signal for this many frames

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 150; // Maximum time gap allowed between processing

/**
 * Check for rhythmic patterns in the signal history that would indicate a finger is present
 */
function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>, 
  currentCount: number
): { isFingerDetected: boolean, patternCount: number } {
  // Need enough data points to detect patterns
  if (signalHistory.length < 10) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Extract just the values for analysis
  const values = signalHistory.map(point => point.value);
  
  // Calculate differences between adjacent points
  const differences = [];
  for (let i = 1; i < values.length; i++) {
    differences.push(values[i] - values[i-1]);
  }
  
  // Count sign changes (zero crossings)
  let zeroCrossings = 0;
  for (let i = 1; i < differences.length; i++) {
    if ((differences[i] > 0 && differences[i-1] < 0) || 
        (differences[i] < 0 && differences[i-1] > 0)) {
      zeroCrossings++;
    }
  }
  
  // Calculate zero crossing rate
  const zcrRate = zeroCrossings / differences.length;
  
  // Physiological rhythmic patterns typically have a specific range of zero crossing rates
  const isRhythmic = zcrRate > 0.15 && zcrRate < 0.6;
  
  // Check time consistency
  const times = signalHistory.map(point => point.time);
  const timeIntervals = [];
  for (let i = 1; i < times.length; i++) {
    timeIntervals.push(times[i] - times[i-1]);
  }
  
  // Calculate variance in time intervals
  const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
  const intervalVariance = timeIntervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / timeIntervals.length;
  
  // Consistent time intervals are important for valid physiological signals
  const isTimeConsistent = intervalVariance / (avgInterval * avgInterval) < 0.25;
  
  // Update pattern count
  let patternCount = currentCount;
  if (isRhythmic && isTimeConsistent) {
    patternCount += 1;
  } else {
    patternCount = Math.max(0, patternCount - 1);
  }
  
  // Need consistent pattern detection to confirm
  const isFingerDetected = patternCount >= 3;
  
  return { isFingerDetected, patternCount };
}

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * Now incorporates rhythmic pattern detection for more accurate finger detection
 * Improved with higher thresholds to reduce false positives
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
  // Track signal history
  const now = Date.now();
  
  // Check for large time gaps which indicate processing interruption (finger removed)
  if (lastProcessTime > 0) {
    const timeDiff = now - lastProcessTime;
    if (timeDiff > MAX_ALLOWED_GAP_MS) {
      console.log(`Signal quality: Large processing gap detected (${timeDiff}ms) - resetting detection`);
      signalHistory = [];
      patternDetectionCount = 0;
      fingDetectionConfirmed = false;
      consecutiveStableFrames = 0;
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 6 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 6000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 10) {
    const values = signalHistory.slice(-10).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    signalVariance = values.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / values.length;
    
    // Check if variance is within physiological range
    const isPhysiological = signalVariance > 0.01 && signalVariance < 0.5;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
    } else {
      consecutiveStableFrames = 0;
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed) {
        console.log("Non-physiological signal detected - resetting finger detection", { variance: signalVariance });
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Check for rhythmic patterns only if we have enough stable frames
  // This prevents false detections from random noise
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && !fingDetectionConfirmed) {
    const patternResult = isFingerDetectedByPattern(signalHistory, patternDetectionCount);
    patternDetectionCount = patternResult.patternCount;
    
    // Only confirm finger if we have consistently detected patterns
    if (patternResult.isFingerDetected) {
      fingDetectionConfirmed = true;
      console.log("Finger detected by rhythmic pattern after physiological validation!", {
        time: new Date(now).toISOString(),
        variance: signalVariance,
        stableFrames: consecutiveStableFrames
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Use higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.30, // Increased from 0.25
    maxWeakSignalCount: config.maxWeakSignalCount || 6    // Increased from 5
  };
  
  // If finger detection was previously confirmed but we have many consecutive weak signals,
  // we should reset the finger detection status
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 2) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    console.log("Finger detection lost due to consecutive weak signals:", consecutiveWeakSignalsCount);
  }
  
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
  
  // If finger is confirmed but signal is weak, give benefit of doubt for longer
  if (fingDetectionConfirmed && result.isWeakSignal) {
    // Higher tolerance for confirmed finger detection
    return {
      isWeakSignal: result.updatedWeakSignalsCount >= finalConfig.maxWeakSignalCount * 1.8, // Increased multiplier
      updatedWeakSignalsCount: result.updatedWeakSignalsCount
    };
  }
  
  return result;
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
  console.log("Signal quality state reset, including pattern detection");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 */
export function isFingerDetected(): boolean {
  return fingDetectionConfirmed || (patternDetectionCount >= 3 && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES) {
    return Math.abs(value) >= 0.18; // Lower threshold for confirmed finger
  }
  
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.30; // Increased from 0.25
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
