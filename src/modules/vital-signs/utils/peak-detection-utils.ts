
export const findPeaks = (values: number[], minPeakHeight = 0, minDistance = 1): number[] => {
  const peaks: number[] = [];
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && 
        values[i] > values[i + 1] && 
        values[i] >= minPeakHeight) {
      
      // Check min distance from last peak
      if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
};

export const findValleys = (values: number[], maxValleyHeight = 0, minDistance = 1): number[] => {
  const valleys: number[] = [];
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] < values[i - 1] && 
        values[i] < values[i + 1] && 
        values[i] <= maxValleyHeight) {
      
      // Check min distance from last valley
      if (valleys.length === 0 || (i - valleys[valleys.length - 1]) >= minDistance) {
        valleys.push(i);
      }
    }
  }
  
  return valleys;
};
