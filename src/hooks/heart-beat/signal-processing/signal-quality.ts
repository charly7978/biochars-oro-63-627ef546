/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Enhanced functions for checking signal quality and weak signals
 * Improved to reduce false positives and add rhythmic pattern detection
 */
import { checkSignalQuality, isFingerDetectedByPattern } from '../../../modules/heart-beat/signal-quality';

// Signal history for pattern detection with improved buffer size
let signalHistory: Array<{time: number, value: number}> = [];
let patternDetectionCount = 0;
let fingDetectionConfirmed = false;

// Track signal statistics to detect non-physiological patterns
let signalMean = 0;
let signalVariance = 0;
let signalSkewness = 0;  // Added to detect asymmetric patterns typical in PPG
let consecutiveStableFrames = 0;
const REQUIRED_STABLE_FRAMES = 20; // Increased from 15 for more reliable detection

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 150; // Maximum time gap allowed between processing

// Track rhythm metrics for physiological validation
let rhythmQuality = 0;
let heartRateTrend: number[] = [];

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
      rhythmQuality = 0;
      heartRateTrend = [];
    }
  }
  lastProcessTime = now;
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 8 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 8000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 15) {  // Increased from 10
    const values = signalHistory.slice(-15).map(p => p.value);
    signalMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate variance (measure of signal spread)
    const squaredDiffs = values.map(val => Math.pow(val - signalMean, 2));
    signalVariance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate skewness (asymmetry of distribution - PPG should have positive skew)
    if (signalVariance > 0) {
      const cubedDiffs = values.map(val => Math.pow(val - signalMean, 3));
      const cubedSum = cubedDiffs.reduce((sum, val) => sum + val, 0);
      signalSkewness = cubedSum / (values.length * Math.pow(signalVariance, 1.5));
    }
    
    // Enhanced physiological check
    // 1. Variance should be neither too low (flat line) nor too high (noise)
    // 2. Skewness should be positive for typical PPG (asymmetric peaks)
    const isPhysiological = signalVariance > 0.01 && 
                           signalVariance < 0.4 && 
                           signalSkewness > 0;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Calculate rhythm metrics if we have enough data
      if (signalHistory.length > 30) {
        updateRhythmMetrics();
      }
    } else {
      consecutiveStableFrames = Math.max(0, consecutiveStableFrames - 2);  // Faster decay for non-physiological signals
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed && consecutiveStableFrames < REQUIRED_STABLE_FRAMES / 2) {
        console.log("Non-physiological signal detected - resetting finger detection", { 
          variance: signalVariance,
          skewness: signalSkewness,
          rhythm: rhythmQuality
        });
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
    // AND rhythm metrics indicate physiological signal
    if (patternResult.isFingerDetected && rhythmQuality > 0.4) {
      fingDetectionConfirmed = true;
      console.log("Finger detected by rhythmic pattern after physiological validation!", {
        time: new Date(now).toISOString(),
        variance: signalVariance,
        skewness: signalSkewness,
        stableFrames: consecutiveStableFrames,
        rhythmQuality
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Use higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.35, // Increased from 0.30
    maxWeakSignalCount: config.maxWeakSignalCount || 8    // Increased from 6
  };
  
  // If finger detection was previously confirmed but we have many consecutive weak signals,
  // we should reset the finger detection status
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > finalConfig.maxWeakSignalCount * 2) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    rhythmQuality = 0;
    console.log("Finger detection lost due to consecutive weak signals:", consecutiveWeakSignalsCount);
  }
  
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
  
  // If finger is confirmed but signal is weak, give benefit of doubt for longer
  if (fingDetectionConfirmed && result.isWeakSignal) {
    // Higher tolerance for confirmed finger detection
    return {
      isWeakSignal: result.updatedWeakSignalsCount >= finalConfig.maxWeakSignalCount * 2.0, // Increased multiplier
      updatedWeakSignalsCount: result.updatedWeakSignalsCount
    };
  }
  
  return result;
}

/**
 * Updates rhythm metrics for improved physiological validation
 */
function updateRhythmMetrics(): void {
  if (signalHistory.length < 30) return;
  
  // Get inter-peak intervals
  const peaks: number[] = [];
  const values = signalHistory.slice(-30).map(p => p.value);
  
  // Find peaks in signal
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peaks.push(i);
    }
  }
  
  // Calculate inter-peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Check if intervals are reasonable for heart rate
  // (at 30 samples/sec, intervals should be around 15-30 samples for 60-120 BPM)
  if (intervals.length >= 2) {
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const heartRate = 60 / (avgInterval / 30);  // Convert to BPM assuming 30 fps
    
    // Store heart rate for trend analysis
    heartRateTrend.push(heartRate);
    if (heartRateTrend.length > 5) {
      heartRateTrend.shift();
    }
    
    // Check if heart rate is physiologically plausible
    const isPlausibleRate = heartRate >= 40 && heartRate <= 180;
    
    // Calculate interval consistency
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const intervalCoV = Math.sqrt(intervalVariance) / avgInterval;
    
    // Check heart rate stability over time
    let rateTrendScore = 1.0;
    if (heartRateTrend.length >= 3) {
      const avgTrendRate = heartRateTrend.reduce((sum, val) => sum + val, 0) / heartRateTrend.length;
      const maxDiff = Math.max(...heartRateTrend.map(rate => Math.abs(rate - avgTrendRate)));
      rateTrendScore = Math.max(0, 1 - maxDiff / 20);  // Allow 20 BPM variation
    }
    
    // Calculate overall rhythm quality
    const intervalScore = Math.max(0, 1 - intervalCoV);  // Lower CoV is better
    rhythmQuality = isPlausibleRate ? (intervalScore * 0.7 + rateTrendScore * 0.3) : 0;
  } else {
    // Not enough intervals detected
    rhythmQuality = Math.max(0, rhythmQuality - 0.1); // Slowly decay if not detected
  }
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
  signalSkewness = 0;
  consecutiveStableFrames = 0;
  lastProcessTime = 0;
  rhythmQuality = 0;
  heartRateTrend = [];
  console.log("Signal quality state reset, including enhanced pattern detection");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 * Enhanced with physiological validation
 */
export function isFingerDetected(): boolean {
  const patternConfirmation = fingDetectionConfirmed || (patternDetectionCount >= 4);  // Increased from 3
  const physiologicalConfirmation = consecutiveStableFrames >= REQUIRED_STABLE_FRAMES;
  const rhythmConfirmation = rhythmQuality > 0.4;  // Minimum rhythm quality
  
  return patternConfirmation && physiologicalConfirmation && rhythmConfirmation;
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && rhythmQuality > 0.6) {
    return Math.abs(value) >= 0.15; // Lower threshold for confirmed finger with good rhythm
  }
  
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.35; // Increased from 0.30
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
