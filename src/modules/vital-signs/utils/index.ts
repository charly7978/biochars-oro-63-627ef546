
// Export all utility functions
export { findPeaksAndValleys, calculateAmplitude } from './peak-detection-utils';
export { applyBandpassFilter } from './filter-utils';
export { calculatePerfusionIndex } from './perfusion-utils';
export { normalizeSignal, calculateVariance, calculateMean } from './signal-processing-utils';

/**
 * Format blood pressure values into a standard string format
 * @param systolic Systolic pressure value
 * @param diastolic Diastolic pressure value
 * @returns Formatted blood pressure string
 */
export const formatBloodPressure = (systolic: number, diastolic: number): string => {
  if (systolic <= 0 || diastolic <= 0) {
    return "--/--";
  }
  return `${Math.round(systolic)}/${Math.round(diastolic)}`;
};

/**
 * Parse blood pressure string into separate systolic and diastolic values
 * @param bpString Blood pressure string in format "systolic/diastolic"
 * @returns Object with systolic and diastolic values
 */
export const parseBloodPressure = (bpString: string): { systolic: number; diastolic: number } => {
  if (!bpString || bpString === "--/--") {
    return { systolic: 0, diastolic: 0 };
  }
  
  const parts = bpString.split('/');
  if (parts.length !== 2) {
    return { systolic: 0, diastolic: 0 };
  }
  
  const systolic = parseInt(parts[0], 10);
  const diastolic = parseInt(parts[1], 10);
  
  return {
    systolic: isNaN(systolic) ? 0 : systolic,
    diastolic: isNaN(diastolic) ? 0 : diastolic
  };
};
