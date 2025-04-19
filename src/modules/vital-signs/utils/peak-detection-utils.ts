
/**
 * Utility functions for peak detection in PPG signals
 */

/**
 * Finds peaks in a PPG signal array
 * @param signal Array of PPG values
 * @param threshold Minimum amplitude to consider a peak
 * @param influence How much influence new peaks have on detection
 * @returns Array of peak indices
 */
export const findPeaks = (
  signal: number[],
  threshold: number = 0.5,
  influence: number = 0.5
): number[] => {
  if (!signal || signal.length === 0) return [];
  
  const peaks: number[] = [];
  const filteredSignal = [...signal];
  const avgFilter = Array(signal.length).fill(0);
  const stdFilter = Array(signal.length).fill(0);
  
  // Initialize with first values
  avgFilter[0] = signal[0];
  stdFilter[0] = 0;
  
  // Start detection from 2nd point
  for (let i = 1; i < signal.length; i++) {
    // If value is greater than threshold, mark as peak
    if (Math.abs(signal[i] - avgFilter[i-1]) > threshold * stdFilter[i-1]) {
      if (signal[i] > avgFilter[i-1]) {
        peaks.push(i);
      }
      
      // Update filtered signal with influence
      filteredSignal[i] = influence * signal[i] + (1 - influence) * filteredSignal[i-1];
    } else {
      filteredSignal[i] = signal[i];
    }
    
    // Update average and standard deviation
    avgFilter[i] = filteredSignal[i];
    stdFilter[i] = Math.sqrt(filteredSignal[i] * filteredSignal[i]);
  }
  
  return peaks;
};

/**
 * Finds valleys in a PPG signal
 * @param signal Array of PPG values
 * @param threshold Minimum amplitude to consider a valley
 * @param influence How much influence new valleys have on detection
 * @returns Array of valley indices
 */
export const findValleys = (
  signal: number[],
  threshold: number = 0.5,
  influence: number = 0.5
): number[] => {
  if (!signal || signal.length === 0) return [];
  
  const valleys: number[] = [];
  const filteredSignal = [...signal];
  const avgFilter = Array(signal.length).fill(0);
  const stdFilter = Array(signal.length).fill(0);
  
  // Initialize with first values
  avgFilter[0] = signal[0];
  stdFilter[0] = 0;
  
  // Start detection from 2nd point
  for (let i = 1; i < signal.length; i++) {
    // If value is lower than threshold, mark as valley
    if (Math.abs(signal[i] - avgFilter[i-1]) > threshold * stdFilter[i-1]) {
      if (signal[i] < avgFilter[i-1]) {
        valleys.push(i);
      }
      
      // Update filtered signal with influence
      filteredSignal[i] = influence * signal[i] + (1 - influence) * filteredSignal[i-1];
    } else {
      filteredSignal[i] = signal[i];
    }
    
    // Update average and standard deviation
    avgFilter[i] = filteredSignal[i];
    stdFilter[i] = Math.sqrt(filteredSignal[i] * filteredSignal[i]);
  }
  
  return valleys;
};
