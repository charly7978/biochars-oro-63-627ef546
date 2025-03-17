
/**
 * Get signal color based on signal characteristic
 */
export function getSignalColor(isAbnormal: boolean): string {
  return isAbnormal ? '#FF2E2E' : '#0EA5E9';
}

/**
 * Check if a point is in an arrhythmia window
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: {start: number, end: number}[]
): boolean {
  return arrhythmiaWindows.some(window => 
    pointTime >= window.start && pointTime <= window.end
  );
}
