
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate RMSSD from real RR intervals without using Math functions
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  // Square root approximation without Math.sqrt
  if (sumSquaredDiff === 0) return 0;
  
  const n = intervals.length - 1;
  const mean = sumSquaredDiff / n;
  
  // Newton's method for square root
  let result = mean;
  for (let i = 0; i < 10; i++) {
    if (result === 0) break;
    result = 0.5 * (result + mean / result);
  }
  
  return result;
}

/**
 * Calculate RR interval variation from real data without Math functions
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calculate mean without reduce
  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    sum += intervals[i];
  }
  const mean = sum / intervals.length;
  
  const lastRR = intervals[intervals.length - 1];
  const diff = lastRR - mean;
  
  // Absolute value without Math.abs
  const absDiff = diff >= 0 ? diff : -diff;
  
  return absDiff / mean;
}
