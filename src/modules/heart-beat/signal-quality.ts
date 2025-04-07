
/**
 * Improved central module for signal quality detection
 * Consistent parameters across all parts of the application
 */

export interface SignalQualityConfig {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

export interface SignalQualityResult {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
}

const DEFAULT_CONFIG: SignalQualityConfig = {
  lowSignalThreshold: 0.20,  // Threshold for weak signal detection
  maxWeakSignalCount: 6      // Maximum consecutive weak signals before declaring no finger
};

/**
 * Centralized function to check if a signal is too weak,
 * indicating possible finger removal
 */
export function checkSignalQuality(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: Partial<SignalQualityConfig> = {}
): SignalQualityResult {
  // Merge with default config
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  // Check if signal is below threshold
  if (Math.abs(value) < finalConfig.lowSignalThreshold) {
    // Increment weak signal counter
    const updatedCount = consecutiveWeakSignalsCount + 1;
    const isWeak = updatedCount >= finalConfig.maxWeakSignalCount;
    
    if (isWeak && updatedCount === finalConfig.maxWeakSignalCount) {
      console.log("Signal quality: Finger likely removed", {
        value,
        threshold: finalConfig.lowSignalThreshold,
        weakCount: updatedCount
      });
    }
    
    return {
      isWeakSignal: isWeak,
      updatedWeakSignalsCount: updatedCount
    };
  } else {
    // Reduce counter (good signal) but don't go below 0
    return {
      isWeakSignal: false,
      updatedWeakSignalsCount: Math.max(0, consecutiveWeakSignalsCount - 1)
    };
  }
}

/**
 * Create signal history for signal pattern detection
 */
export function createSignalHistoryTracker(windowSize: number = 100) {
  let history: Array<{time: number, value: number}> = [];
  
  return {
    addPoint: (value: number) => {
      const now = Date.now();
      history.push({ time: now, value });
      
      // Keep only the most recent points within the window size
      if (history.length > windowSize) {
        history.shift();
      }
      
      return { time: now, history };
    },
    getHistory: () => history,
    clear: () => {
      history = [];
    }
  };
}

/**
 * Reset all detection states - added to fix the missing export
 */
export function resetDetectionStates() {
  console.log("Signal quality: Resetting all detection states");
  return {
    consecutiveWeakSignals: 0
  };
}
