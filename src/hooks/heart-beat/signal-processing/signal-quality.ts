
/**
 * Functions for checking signal quality and weak signals
 * Optimized implementation to reduce false positives while enabling measurements
 */
import { checkSignalQuality, isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 20; // Balanced (was 30)

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 100; // Reduced from 150 - more strict

// Require sufficient amount of time with valid signal
let validSignalStartTime = 0;
const MINIMUM_VALID_TIME_MS = 1000; // Requires 1 second of consistent signal (was 1.5s)

/**
 * Verifies if the signal is too weak to be a real finger
 * Balanced thresholds to prevent false positives while enabling measurements
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
      validSignalStartTime = 0;
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 4 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 4000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 15) {
    const values = signalHistory.slice(-15).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    signalVariance = values.reduce((sum, val) => sum + Math.pow(val - signalMean, 2), 0) / values.length;
    
    // Physiological validation with moderate strictness
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    
    // Requires a minimum range to be physiologically valid (real heart)
    const hasValidRange = range > 0.25; // Requires significant amplitude (was 0.35)
    
    // Calculate derivatives to detect cardiac oscillations
    const derivatives = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    // Count sign changes (oscillations)
    let signChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) ||
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Requires oscillations like a real heartbeat
    const hasValidOscillations = signChanges >= 3; // More realistic (was 4)
    
    // Variance range validation for physiological signal
    // A real heart has a characteristic variance
    const hasValidVariance = signalVariance > 0.020 && signalVariance < 0.7; // More permissive
    
    // Only increment counter if ALL verifications pass
    const isPhysiological = hasValidRange && hasValidOscillations && hasValidVariance;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Start minimum time timer if it's the first stable frame
      if (consecutiveStableFrames === 1) {
        validSignalStartTime = now;
      }
      
    } else {
      consecutiveStableFrames = 0;
      validSignalStartTime = 0;
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed) {
        console.log("Non-physiological signal detected - resetting finger detection", { 
          variance: signalVariance,
          range: range,
          oscillations: signChanges
        });
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Check if enough time has passed with stable signals
  const hasMinimumValidTime = validSignalStartTime > 0 && (now - validSignalStartTime) >= MINIMUM_VALID_TIME_MS;
  
  // Check rhythmic patterns only if we have enough stable frames AND minimum time
  // This prevents false detections of random noise
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && 
      hasMinimumValidTime && 
      !fingDetectionConfirmed) {
    
    const patternResult = isFingerDetectedByPattern(signalHistory, patternDetectionCount);
    patternDetectionCount = patternResult.patternCount;
    
    // Confirm finger detection only if we've consistently detected patterns
    if (patternResult.isFingerDetected) {
      fingDetectionConfirmed = true;
      console.log("Finger detected by rhythmic pattern after physiological validation!", {
        time: new Date(now).toISOString(),
        variance: signalVariance,
        stableFrames: consecutiveStableFrames,
        validTime: now - validSignalStartTime,
        oscillations: "verified"
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Use moderate thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.35, // Balanced (was 0.45)
    maxWeakSignalCount: config.maxWeakSignalCount || 4    
  };
  
  // If finger detection was previously confirmed but we have many weak signals,
  // we should reset the finger detection state
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 1.5) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    validSignalStartTime = 0;
    console.log("Finger detection lost due to consecutive weak signals:", consecutiveWeakSignalsCount);
  }
  
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
  
  // If finger confirmed but signal is weak, give benefit of doubt for longer
  if (fingDetectionConfirmed && result.isWeakSignal) {
    // Greater tolerance for confirmed finger detection
    return {
      isWeakSignal: result.updatedWeakSignalsCount >= finalConfig.maxWeakSignalCount * 1.5,
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
  validSignalStartTime = 0;
  console.log("Signal quality state reset, including pattern detection");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 * Uses balanced thresholds
 */
export function isFingerDetected(): boolean {
  // Requires explicit confirmation and good number of stable frames
  return fingDetectionConfirmed && (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses balanced threshold
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES) {
    return Math.abs(value) >= 0.23; // Lower threshold with confirmed finger
  }
  
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.30; // Balanced threshold (was 0.45)
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

