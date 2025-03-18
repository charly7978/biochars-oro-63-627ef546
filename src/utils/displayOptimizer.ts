
/**
 * Helper functions for optimizing display in PPG signal visualization
 */

/**
 * Get the appropriate color for signal path based on arrhythmia status
 */
export function getSignalColor(isArrhythmia: boolean): string {
  return isArrhythmia ? '#DC2626' : '#0EA5E9';
}

/**
 * Check if a point is within an arrhythmia window
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  return arrhythmiaWindows.some(window => {
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}
