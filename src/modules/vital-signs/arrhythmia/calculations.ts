
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 * A measure of heart rate variability from real data
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  let sumSquares = 0;
  let count = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    sumSquares += diff * diff;
    count++;
  }
  
  if (count === 0) return 0;
  
  return Math.sqrt(sumSquares / count);
}

/**
 * Calculate RR variation as a ratio
 * Higher values indicate more irregularity
 */
export function calculateRRVariation(rrIntervals: number[]): number {
  if (rrIntervals.length < 3) return 0;
  
  const avg = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  if (avg === 0) return 0;
  
  // Calculate absolute variations
  const variations = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    variations.push(Math.abs(rrIntervals[i] - rrIntervals[i-1]));
  }
  
  // Sort variations to find median
  variations.sort((a, b) => a - b);
  const medianVariation = variations[Math.floor(variations.length / 2)];
  
  // Calculate variation ratio
  return medianVariation / avg;
}
