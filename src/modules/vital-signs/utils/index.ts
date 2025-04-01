
/**
 * Utility functions for vital signs processing
 */

// Export all utilities from sub-modules
export * from './filter-utils';
export * from './peak-detection-utils';
export * from './perfusion-utils';
export * from './signal-processing-utils';

// Export individual functions that might be used directly
export const normalizeSignal = (signal: number[], min = 0, max = 1): number[] => {
  if (signal.length === 0) return [];
  
  const minVal = Math.min(...signal);
  const maxVal = Math.max(...signal);
  const range = maxVal - minVal;
  
  if (range === 0) return signal.map(() => (max + min) / 2);
  
  return signal.map(val => min + ((val - minVal) / range) * (max - min));
};

export const filterSignal = (signal: number[], windowSize = 5): number[] => {
  if (signal.length < windowSize) return [...signal];
  
  return signal.map((_, i) => {
    if (i < windowSize - 1) return signal[i];
    
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += signal[i - j];
    }
    return sum / windowSize;
  });
};

export const calculateHeartRate = (peakIntervals: number[], sampleRate = 30): number => {
  if (peakIntervals.length < 2) return 0;
  
  // Average interval in samples
  const avgInterval = peakIntervals.reduce((sum, interval) => sum + interval, 0) / peakIntervals.length;
  
  // Convert to seconds
  const intervalInSeconds = avgInterval / sampleRate;
  
  // Calculate BPM
  return Math.round(60 / intervalInSeconds);
};

export const validateSignalQuality = (signal: number[], threshold = 0.1): boolean => {
  if (signal.length < 10) return false;
  
  const std = calculateStandardDeviation(signal);
  return std > threshold;
};

export const detectPeaks = (signal: number[], minHeight = 0.5, minDistance = 10): number[] => {
  const peaks: number[] = [];
  
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > minHeight && 
        signal[i] > signal[i-1] && 
        signal[i] > signal[i+1]) {
      
      // Check if we're far enough from the last peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
};

export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length <= 1) return 0;
  
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => {
    const diff = value - avg;
    return diff * diff;
  });
  
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
};
