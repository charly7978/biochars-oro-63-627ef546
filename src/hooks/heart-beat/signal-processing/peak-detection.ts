
/**
 * Signal peak detection utilities
 * Direct measurement of real signals only - no simulation
 */

export const handlePeakDetection = (
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void => {
  if (!result || !result.isPeak) {
    return;
  }
  
  const now = Date.now();
  
  // Only process peaks from real data
  if (lastPeakTimeRef.current === null || now - lastPeakTimeRef.current > 300) {
    lastPeakTimeRef.current = now;
    
    // Request beep based on real peak, not simulated
    requestImmediateBeep(value);
  }
};
