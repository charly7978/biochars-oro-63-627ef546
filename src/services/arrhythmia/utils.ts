
import { ArrhythmiaCategory } from './types';

/**
 * Categorizes an arrhythmia based on RR interval analysis
 * @param intervals RR intervals to analyze
 * @param rmssd Optional pre-calculated RMSSD value
 * @param cv Optional pre-calculated coefficient of variation
 * @returns Category of arrhythmia
 */
export function categorizeArrhythmia(intervals: number[], rmssd?: number, cv?: number): ArrhythmiaCategory {
  if (intervals.length < 3) {
    return 'normal';
  }
  
  // Calculate heart rate from RR intervals
  const meanRR = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const heartRate = 60000 / meanRR; // Convert to BPM
  
  // Check for tachycardia or bradycardia
  if (heartRate > 100) {
    return 'tachycardia';
  } else if (heartRate < 60) {
    return 'bradycardia';
  }
  
  // Check for bigeminy (alternating short and long intervals)
  let bigeminyPattern = true;
  let prevWasShort = (intervals[0] < intervals[1]);
  for (let i = 1; i < intervals.length - 1; i++) {
    const currentIsShort = (intervals[i] < intervals[i+1]);
    if (currentIsShort === prevWasShort) {
      bigeminyPattern = false;
      break;
    }
    prevWasShort = currentIsShort;
  }
  
  if (bigeminyPattern && intervals.length >= 4) {
    return 'bigeminy';
  }
  
  // Check for general arrhythmia based on variability
  const _rmssd = rmssd || calculateRMSSD(intervals);
  const _cv = cv || calculateCV(intervals);
  
  if (_rmssd > 50 || _cv > 0.1) {
    return 'possible-arrhythmia';
  }
  
  return 'normal';
}

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 */
function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiffs = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiffs += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
}

/**
 * Calculate CV (Coefficient of Variation)
 */
function calculateCV(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  let variance = 0;
  for (const interval of intervals) {
    variance += (interval - mean) ** 2;
  }
  variance /= intervals.length;
  
  const stdDev = Math.sqrt(variance);
  return mean > 0 ? stdDev / mean : 0;
}
