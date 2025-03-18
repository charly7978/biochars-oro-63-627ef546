
/**
 * Functions for optimizing display of signal and arrhythmia data
 */

/**
 * Get the appropriate color for the signal based on arrhythmia status
 * @param isArrhythmia - Whether the point represents arrhythmia (1 for true, 0 for false)
 */
export const getSignalColor = (isArrhythmia: number | boolean): string => {
  // Convert to boolean if needed
  const isArrhythmiaBoolean = isArrhythmia === 1 || isArrhythmia === true;
  return isArrhythmiaBoolean ? '#FF2E2E' : '#0EA5E9';
};

/**
 * Check if a point falls within any arrhythmia window
 * @param pointTime - The timestamp of the point
 * @param arrhythmiaWindows - Array of arrhythmia start/end time windows
 */
export const isPointInArrhythmiaWindow = (
  pointTime: number, 
  arrhythmiaWindows: {start: number, end: number}[]
): boolean => {
  return arrhythmiaWindows.some(window => 
    pointTime >= window.start && pointTime <= window.end
  );
};
