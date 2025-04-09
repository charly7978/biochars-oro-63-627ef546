
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
const REQUIRED_STABLE_FRAMES = 18; // Better balance between reliability and speed

// Track time-based consistency
let lastProcessTime = 0;
const MAX_ALLOWED_GAP_MS = 150; // Maximum time gap allowed between processing

// Track rhythm metrics for physiological validation
let rhythmQuality = 0;
let heartRateTrend: number[] = [];

// Device-specific adaptation
let isHighEndDevice = false;
let devicePerformanceScore = 0;
const PERFORMANCE_CHECK_INTERVAL = 5000; // 5 seconds
let lastDeviceCheck = 0;
let frameRateHistory: number[] = [];

/**
 * Checks device performance and sets optimal thresholds
 */
function checkDevicePerformance(): void {
  const now = Date.now();
  if (now - lastDeviceCheck < PERFORMANCE_CHECK_INTERVAL) {
    return;
  }
  
  lastDeviceCheck = now;
  
  // Calculate frame rate
  if (frameRateHistory.length >= 10) {
    const intervals = frameRateHistory.slice(-10);
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const fps = 1000 / avgInterval;
    
    // Check device capabilities
    const isHighPerformance = fps > 25;
    const hardwareAcceleration = navigator.gpu !== undefined || 
                               (window.WebGLRenderingContext !== undefined);
    
    // Score the device from 0-10
    devicePerformanceScore = (fps / 30) * 5 + (hardwareAcceleration ? 5 : 0);
    isHighEndDevice = devicePerformanceScore > 7;
    
    console.log(`Device performance check: Score ${devicePerformanceScore.toFixed(1)}/10, FPS: ${fps.toFixed(1)}, High-end: ${isHighEndDevice}`);
  }
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
  
  // Track frame rate for device adaptation
  if (lastProcessTime > 0) {
    const timeDiff = now - lastProcessTime;
    if (timeDiff > 0 && timeDiff < 200) { // Valid frame
      frameRateHistory.push(timeDiff);
      if (frameRateHistory.length > 30) {
        frameRateHistory.shift();
      }
    }
    
    // Check device performance periodically
    checkDevicePerformance();
  }
  lastProcessTime = now;
  
  // Check for large time gaps which indicate processing interruption
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
  
  signalHistory.push({ time: now, value });
  
  // Keep only recent signals (last 8 seconds)
  signalHistory = signalHistory.filter(point => now - point.time < 8000);
  
  // Calculate signal statistics for physiological validation
  if (signalHistory.length > 15) {
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
    const varianceInRange = signalVariance > 0.005 && signalVariance < 0.5;
    const hasPositiveSkew = signalSkewness > 0;
    const isPhysiological = varianceInRange && hasPositiveSkew;
    
    if (isPhysiological) {
      consecutiveStableFrames++;
      
      // Calculate rhythm metrics if we have enough data
      if (signalHistory.length > 30) {
        updateRhythmMetrics();
      }
    } else {
      consecutiveStableFrames = Math.max(0, consecutiveStableFrames - 2);
      
      // If we had confirmed detection but signal is no longer physiological, reset
      if (fingDetectionConfirmed && consecutiveStableFrames < REQUIRED_STABLE_FRAMES / 2) {
        console.log("Non-physiological signal detected - resetting finger detection", { 
          variance: signalVariance.toFixed(4),
          skewness: signalSkewness.toFixed(2),
          rhythm: rhythmQuality.toFixed(2)
        });
        fingDetectionConfirmed = false;
        patternDetectionCount = 0;
      }
    }
  }
  
  // Check for rhythmic patterns only if we have enough stable frames
  if (consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && !fingDetectionConfirmed) {
    const patternResult = isFingerDetectedByPattern(signalHistory, patternDetectionCount);
    patternDetectionCount = patternResult.patternCount;
    
    // Only confirm finger if we have consistently detected patterns
    // AND rhythm metrics indicate physiological signal
    if (patternResult.isFingerDetected && rhythmQuality > 0.4) {
      fingDetectionConfirmed = true;
      console.log("Finger detected by rhythmic pattern after physiological validation!", {
        time: new Date(now).toISOString(),
        variance: signalVariance.toFixed(4),
        skewness: signalSkewness.toFixed(2),
        stableFrames: consecutiveStableFrames,
        rhythmQuality: rhythmQuality.toFixed(2)
      });
      
      return {
        isWeakSignal: false,
        updatedWeakSignalsCount: 0
      };
    }
  }
  
  // Adapt thresholds based on device capabilities
  const adaptiveConfig = {
    lowSignalThreshold: isHighEndDevice ? 
      config.lowSignalThreshold * 1.1 : // Slightly higher for high-end
      config.lowSignalThreshold * 0.9,  // Lower for low-end
    maxWeakSignalCount: Math.round(config.maxWeakSignalCount * 
      (isHighEndDevice ? 1.2 : 0.8))    // More/fewer frames based on device
  };
  
  // If finger detection was previously confirmed but we have many consecutive weak signals,
  // we should reset the finger detection status
  if (fingDetectionConfirmed && consecutiveWeakSignalsCount > adaptiveConfig.maxWeakSignalCount * 2) {
    fingDetectionConfirmed = false;
    patternDetectionCount = 0;
    consecutiveStableFrames = 0;
    rhythmQuality = 0;
    console.log("Finger detection lost due to consecutive weak signals:", consecutiveWeakSignalsCount);
  }
  
  const result = checkSignalQuality(value, consecutiveWeakSignalsCount, adaptiveConfig);
  
  // If finger is confirmed but signal is weak, give benefit of doubt for longer
  if (fingDetectionConfirmed && result.isWeakSignal) {
    // Higher tolerance for confirmed finger detection
    return {
      isWeakSignal: result.updatedWeakSignalsCount >= adaptiveConfig.maxWeakSignalCount * 2.0,
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
  
  // Find peaks in signal with improved algorithm
  for (let i = 2; i < values.length - 2; i++) {
    // A peak must be higher than its neighbors by a minimum amount
    const minPeakProminence = 0.05;
    
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] &&
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] - Math.max(values[i-2], values[i+2]) > minPeakProminence) {
      peaks.push(i);
    }
  }
  
  // Calculate inter-peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Check if intervals are reasonable for heart rate
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
    
    // Calculate interval consistency with increased weight for regularity
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
    const peakCountScore = Math.min(1, peaks.length / 4); // Need at least 4 peaks
    
    // Apply more weight to physiological plausibility
    rhythmQuality = isPlausibleRate ? 
      (intervalScore * 0.5 + rateTrendScore * 0.3 + peakCountScore * 0.2) : 
      Math.max(0, (intervalScore * 0.3 + rateTrendScore * 0.1 + peakCountScore * 0.1));
    
    // Log rhythm quality periodically 
    if (intervals.length > 0 && Math.random() < 0.05) {
      console.log(`Rhythm quality: ${rhythmQuality.toFixed(2)}, HR: ${heartRate.toFixed(0)} BPM, Intervals: ${intervals.length}, CoV: ${intervalCoV.toFixed(2)}`);
    }
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
  frameRateHistory = [];
  devicePerformanceScore = 0;
  isHighEndDevice = false;
  lastDeviceCheck = 0;
  
  console.log("Signal quality state reset, including enhanced pattern detection and device performance adaptation");
  
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected based on rhythmic patterns
 * Enhanced with physiological validation
 */
export function isFingerDetected(): boolean {
  const patternConfirmation = fingDetectionConfirmed || (patternDetectionCount >= 4);
  const physiologicalConfirmation = consecutiveStableFrames >= REQUIRED_STABLE_FRAMES;
  const rhythmConfirmation = rhythmQuality > 0.35; // Slightly more forgiving threshold
  
  // For high-end devices, we can be more strict
  if (isHighEndDevice) {
    return patternConfirmation && physiologicalConfirmation && rhythmConfirmation;
  }
  
  // For low-end devices, be more permissive
  return patternConfirmation && 
         (physiologicalConfirmation || rhythmConfirmation);
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Uses rhythmic pattern detection alongside amplitude thresholds
 * Uses higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // If finger detection is confirmed by pattern, allow processing even if signal is slightly weak
  if (fingDetectionConfirmed && consecutiveStableFrames >= REQUIRED_STABLE_FRAMES && rhythmQuality > 0.5) {
    return Math.abs(value) >= 0.15; // Lower threshold for confirmed finger with good rhythm
  }
  
  // Adaptive threshold based on device performance
  const adaptiveThreshold = isHighEndDevice ? 0.35 : 0.28;
  
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= adaptiveThreshold;
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
