
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 * A common measure of heart rate variability
 */
export const calculateRMSSD = (intervals: number[]): number => {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i - 1];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
};

/**
 * Calculate variation in RR intervals as a normalized measure
 */
export const calculateRRVariation = (intervals: number[]): number => {
  if (intervals.length < 2) return 0;
  
  // Calculate mean RR interval
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  // Calculate normalized deviations
  const deviations = intervals.map(interval => Math.abs(interval - mean) / mean);
  
  // Return average deviation
  return deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
};

/**
 * Detects premature beats based on RR interval variation
 * Returns indices of intervals that could represent premature beats
 */
export const detectPrematureBeats = (intervals: number[]): number[] => {
  if (intervals.length < 5) return [];
  
  const meanRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const indices: number[] = [];
  
  // Find intervals that are significantly shorter than the mean
  for (let i = 1; i < intervals.length - 1; i++) {
    const currentInterval = intervals[i];
    const prevInterval = intervals[i - 1];
    const nextInterval = intervals[i + 1];
    
    // Premature beat: current interval is short, followed by compensatory pause
    if (
      currentInterval < meanRR * 0.7 && // Significantly shorter
      nextInterval > meanRR * 1.15 && // Compensatory pause
      Math.abs(prevInterval - meanRR) / meanRR < 0.15 // Previous interval was normal
    ) {
      indices.push(i);
    }
  }
  
  return indices;
};

/**
 * Calculate pNN50 - Percentage of successive RR intervals that differ by more than 50ms
 * A common metric for parasympathetic activity
 */
export const calculatePNN50 = (intervals: number[]): number => {
  if (intervals.length < 2) return 0;
  
  let nn50Count = 0;
  
  for (let i = 1; i < intervals.length; i++) {
    const diff = Math.abs(intervals[i] - intervals[i - 1]);
    if (diff > 50) {
      nn50Count++;
    }
  }
  
  return (nn50Count / (intervals.length - 1)) * 100;
};

/**
 * Categorize arrhythmia based on HRV metrics
 */
export const categorizeArrhythmia = (
  rmssd: number, 
  rrVariation: number,
  pnn50?: number
): string => {
  if (rmssd > 50 && rrVariation > 0.2) {
    return "Irregular Rhythm";
  } else if (rmssd > 30 && rrVariation > 0.15) {
    return "Mild Irregularity";
  } else {
    return "Normal";
  }
};
