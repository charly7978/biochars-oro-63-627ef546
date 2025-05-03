
/**
 * Utilities for arrhythmia detection without using Math functions
 */

// Deterministic utilities to replace Math functions
export function realMin(a: number, b: number): number { 
  return a < b ? a : b; 
}

export function realMax(a: number, b: number): number { 
  return a > b ? a : b; 
}

export function realAbs(x: number): number { 
  return x < 0 ? -x : x; 
}

/**
 * Categorize arrhythmia based on RR intervals
 */
export function categorizeArrhythmia(
  intervals: number[]
): 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia' {
  const lastRR = intervals.length > 0 ? intervals[intervals.length - 1] : 0;
  if (lastRR === 0) return 'possible-arrhythmia';
  if (lastRR < 500) return 'tachycardia';
  if (lastRR > 1200) return 'bradycardia';

  // Detect bigeminy pattern
  if (intervals.length >= 3) {
    let hasBigeminyPattern = true;
    for (let i = 1; i < intervals.length - 1; i += 2) {
      const evenRR = intervals[i];
      const oddRR = intervals[i - 1];
      if (oddRR === 0 || realAbs(evenRR - oddRR) / oddRR < 0.4) {
        hasBigeminyPattern = false;
        break;
      }
    }
    if (hasBigeminyPattern) return 'bigeminy';
  }

  return 'possible-arrhythmia';
}

/**
 * Converts ArrhythmiaWindows to the format expected by PPGSignalMeter
 * Ensuring the return type matches ArrhythmiaWindow[]
 */
export const formatArrhythmiaWindowsForDisplay = (windows: any[]): { 
  timestamp: number;
  duration: number;
  status: string;
  intervals: number[];
  probability: number;
  details: Record<string, any>;
  start: number;
  end: number;
}[] => {
  return windows.map(window => ({
    timestamp: window.timestamp,
    duration: window.duration,
    status: window.status,
    intervals: window.intervals || [],
    probability: window.probability || 0,
    details: window.details || {},
    // Add the expected properties
    start: window.timestamp,
    end: window.timestamp + window.duration
  }));
};
