
/**
 * Functions for filtering PPG signals
 */

/**
 * Calculates the median value of an array
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
}

/**
 * Apply a median filter to smooth signal and remove outliers
 */
export function applyMedianFilter(value: number, buffer: number[], windowSize: number): number {
  const medianBuffer = [...buffer, value].slice(-windowSize);
  return calculateMedian(medianBuffer);
}

/**
 * Apply a moving average filter to smooth the signal
 */
export function applyMovingAverageFilter(value: number, buffer: number[], windowSize: number): number {
  const maBuffer = [...buffer, value].slice(-windowSize);
  return maBuffer.reduce((sum, val) => sum + val, 0) / maBuffer.length;
}

/**
 * Apply an exponential moving average (EMA) filter
 */
export function applyEMAFilter(value: number, prevSmoothed: number, alpha: number): number {
  return alpha * value + (1 - alpha) * (prevSmoothed || value);
}

/**
 * Combined filter pipeline for PPG signal processing
 */
export function applyFilterPipeline(
  value: number, 
  medianBuffer: number[], 
  movingAvgBuffer: number[],
  prevSmoothedValue: number,
  config: {
    medianWindowSize: number,
    movingAvgWindowSize: number,
    emaAlpha: number
  }
): {
  filteredValue: number,
  updatedMedianBuffer: number[],
  updatedMovingAvgBuffer: number[]
} {
  // Apply median filter with less smoothing to preserve peaks
  const medianFiltered = applyMedianFilter(value, medianBuffer, config.medianWindowSize);
  const updatedMedianBuffer = [...medianBuffer, value];
  if (updatedMedianBuffer.length > config.medianWindowSize) {
    updatedMedianBuffer.shift();
  }
  
  // Apply moving average filter with reduced window size for sharper peaks
  const movingAvgFiltered = applyMovingAverageFilter(medianFiltered, movingAvgBuffer, config.movingAvgWindowSize);
  const updatedMovingAvgBuffer = [...movingAvgBuffer, medianFiltered];
  if (updatedMovingAvgBuffer.length > config.movingAvgWindowSize) {
    updatedMovingAvgBuffer.shift();
  }
  
  // Apply EMA filter with higher alpha for more responsive filter
  const emaAlpha = Math.min(config.emaAlpha * 1.2, 0.5); // Increase alpha but cap at 0.5
  const filteredValue = applyEMAFilter(movingAvgFiltered, prevSmoothedValue, emaAlpha);
  
  // Add debug logging every 50 samples
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.02) {
    console.log("Signal filter pipeline:", {
      rawValue: value,
      medianFiltered,
      movingAvgFiltered,
      finalFiltered: filteredValue
    });
  }
  
  return {
    filteredValue,
    updatedMedianBuffer,
    updatedMovingAvgBuffer
  };
}
