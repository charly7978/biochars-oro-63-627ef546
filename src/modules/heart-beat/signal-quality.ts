
/**
 * Signal quality check utility function
 * ENHANCED WITH IMPROVED ERROR HANDLING AND FALLBACKS
 */
import { SignalQualityParams } from "../../hooks/vital-signs/types";

/**
 * Check if a PPG signal is too weak or unusable
 * With built-in safeguards against errors
 * @param value PPG signal value
 * @param currentWeakCount Current count of consecutive weak signals
 * @param params Signal quality parameters
 * @returns Result with signal status and updated weak signals count
 */
export function checkSignalQuality(
  value: number,
  currentWeakCount: number,
  params: SignalQualityParams
) {
  try {
    // Provide default parameters if not provided
    const finalParams = params || {
      lowSignalThreshold: 0.05,
      maxWeakSignalCount: 10
    };
    
    const { lowSignalThreshold, maxWeakSignalCount } = finalParams;
    
    // Check if signal is too weak
    const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
    
    let updatedWeakSignalsCount = isCurrentSignalWeak 
      ? currentWeakCount + 1 
      : Math.max(0, currentWeakCount - 0.5);
    
    // Consider signal weak if we've had too many consecutive weak readings
    const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
    
    return {
      isWeakSignal,
      updatedWeakSignalsCount
    };
  } catch (error) {
    // Fallback in case of any error
    console.error('Error in checkSignalQuality:', error);
    return {
      isWeakSignal: true,
      updatedWeakSignalsCount: currentWeakCount + 1
    };
  }
}

/**
 * Check if finger is detected based on signal patterns
 * @param signalHistory Recent signal history with timestamps
 * @param currentPatternCount Current detection count
 * @returns Updated detection status
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { isFingerDetected: boolean, patternCount: number } {
  try {
    // Need at least 3 seconds of data
    if (!signalHistory || signalHistory.length < 30) {
      return { isFingerDetected: false, patternCount: 0 };
    }
    
    // Look for rhythmic patterns in the signal
    // Simple peak detection for demonstration
    const peaks = [];
    for (let i = 1; i < signalHistory.length - 1; i++) {
      if (signalHistory[i].value > signalHistory[i-1].value && 
          signalHistory[i].value > signalHistory[i+1].value &&
          signalHistory[i].value > 0.2) {
        peaks.push(signalHistory[i].time);
      }
    }
    
    // Check if we have at least 3 peaks
    if (peaks.length >= 3) {
      // Calculate intervals between peaks
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      // Check if intervals are consistent (physiological heart rate)
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const isConsistent = intervals.every(interval => 
        Math.abs(interval - avgInterval) / avgInterval < 0.3 && // 30% variance allowed
        interval > 500 && interval < 1500 // 40-120 BPM range (500-1500ms)
      );
      
      if (isConsistent) {
        const newPatternCount = currentPatternCount + 1;
        return {
          isFingerDetected: newPatternCount >= 3,
          patternCount: newPatternCount
        };
      }
    }
    
    // Reduce pattern count if no consistent pattern found
    return {
      isFingerDetected: false,
      patternCount: Math.max(0, currentPatternCount - 1)
    };
  } catch (error) {
    console.error('Error in isFingerDetectedByPattern:', error);
    return { isFingerDetected: false, patternCount: 0 };
  }
}

/**
 * Reset detection states for signal quality
 * This is used by the HeartBeatProcessor to reset state when needed
 * WITH ENHANCED ERROR PROTECTION AND LOGGING
 * @returns Reset state object with zeroed counters
 */
export function resetDetectionStates() {
  console.log("Signal quality: Resetting detection states");
  
  // Tell the importErrorSystem that we exist 
  try {
    if (typeof window !== 'undefined' && window.__fixModule) {
      // Register ourselves as a real implementation
      window.__fixModule(
        '/src/modules/heart-beat/signal-quality.ts',
        'resetDetectionStates',
        () => {
          console.log('Using REAL resetDetectionStates from signal-quality.ts');
          return { weakSignalsCount: 0 };
        }
      );
    }
  } catch (error) {
    console.warn('Error registering real resetDetectionStates with importErrorSystem:', error);
  }
  
  return {
    weakSignalsCount: 0
  };
}
