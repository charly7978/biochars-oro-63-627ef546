/**
 * Utilities for arrhythmia detection
 */

// Keep only necessary, non-Math replacing functions

/**
 * Categorize arrhythmia based on RR intervals
 * (Example simplified logic)
 */
export function categorizeArrhythmia(
  intervals: number[],
  // Optional additional metrics if needed for more complex categorization
  // rmssd?: number, 
  // cv?: number 
): 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia' {
  const lastRR = intervals.length > 0 ? intervals[intervals.length - 1] : 0;
  if (lastRR === 0) return 'possible-arrhythmia'; // Unreliable if last RR is 0
  
  const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const bpm = meanRR > 0 ? 60000 / meanRR : 0;

  // Check for Tachycardia/Bradycardia first
  if (bpm > HeartBeatConfig.MAX_BPM - 10) return 'tachycardia'; // Adjusted threshold
  if (bpm < HeartBeatConfig.MIN_BPM + 5) return 'bradycardia'; // Adjusted threshold

  // Detect bigeminy pattern (alternating short/long intervals)
  if (intervals.length >= 4) { // Need at least 4 intervals for 2 pairs
    let bigeminyPatternCount = 0;
    let consistentPattern = true;
    for (let i = 1; i < intervals.length -1 ; i += 2) {
      const shortInterval = Math.min(intervals[i], intervals[i+1]);
      const longInterval = Math.max(intervals[i], intervals[i+1]);
      // Check if one interval is significantly shorter than the other (e.g., < 70%)
      if (shortInterval < longInterval * 0.7) {
        bigeminyPatternCount++;
      } else {
        consistentPattern = false; // Break if pattern is not consistent
        break;
      }
    }
    // Require a majority of pairs to follow the pattern
    if (consistentPattern && bigeminyPatternCount >= Math.floor((intervals.length -1) / 2) * 0.6 ) { 
        return 'bigeminy';
    }
  }
  
  // If no specific pattern, check general variability (using caller's RMSSD/CV)
  // This function itself doesn't calculate RMSSD/CV anymore to keep it simple
  // Let the caller decide based on thresholds if it's 'possible-arrhythmia'
  // For now, if not Brady/Tachy/Bigeminy, return normal.
  // The rule-based logic in the service will override this to 'possible-arrhythmia' if RMSSD/CV are high.
  return 'normal'; 
}

// Import HeartBeatConfig needed for BPM thresholds
import { HeartBeatConfig } from '@/modules/heart-beat/config';
