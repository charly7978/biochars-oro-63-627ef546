/**
 * Utilities for arrhythmia detection
 */
import { HeartBeatConfig } from '@/modules/heart-beat/config';

/**
 * Categorize arrhythmia based on RR intervals
 * (Example simplified logic)
 */
export function categorizeArrhythmia(
  intervals: number[],
): 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia' {
  if (!intervals || intervals.length === 0) return 'possible-arrhythmia'; // Cannot determine from empty array

  const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const bpm = meanRR > 0 ? 60000 / meanRR : 0;

  // Check for Tachycardia/Bradycardia first
  if (bpm > HeartBeatConfig.MAX_BPM - 10) return 'tachycardia'; 
  if (bpm < HeartBeatConfig.MIN_BPM + 5) return 'bradycardia'; 

  // Detect bigeminy pattern (alternating short/long intervals)
  if (intervals.length >= 4) { 
    let bigeminyPatternCount = 0;
    let consistentPattern = true;
    for (let i = 0; i < intervals.length - 1; i += 2) {
        // Ensure we don't go out of bounds if odd number of intervals for pairing
        if (i + 1 >= intervals.length) break; 
        
      const interval1 = intervals[i];
      const interval2 = intervals[i+1];
      const shortInterval = Math.min(interval1, interval2);
      const longInterval = Math.max(interval1, interval2);
      
      // Check if one interval is significantly shorter than the other (e.g., < 70%)
      // Added check for longInterval > 0 to avoid division by zero or NaN
      if (longInterval > 0 && shortInterval < longInterval * 0.7) {
        bigeminyPatternCount++;
      } else {
        consistentPattern = false; 
        break;
      }
    }
    // Require a significant portion of pairs to follow the pattern
    const numberOfPairs = Math.floor(intervals.length / 2);
    if (consistentPattern && numberOfPairs > 0 && bigeminyPatternCount >= numberOfPairs * 0.6 ) { 
        return 'bigeminy';
    }
  }
  
  // If not Brady/Tachy/Bigeminy, return 'normal'. 
  // The service will check HRV metrics separately to flag 'possible-arrhythmia'.
  return 'normal'; 
}
