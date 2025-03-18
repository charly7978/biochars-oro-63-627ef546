
/**
 * Index file for signal processing utilities
 * Exports all required functions for signal processing
 */
export * from './signal-quality';
export * from './peak-detection';
export * from './result-processor';

/**
 * Handle peak detection based on real signal
 */
export const handlePeakDetection = (
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void => {
  if (result.isPeak) {
    const now = Date.now();
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current && Math.abs(value) > 0.1) {
      requestImmediateBeep(value);
    }
  }
};

/**
 * Determines if a signal should be processed based on quality
 */
export const shouldProcessMeasurement = (value: number): boolean => {
  // Don't process signals that are too small (likely noise)
  return Math.abs(value) >= 0.05;
};
