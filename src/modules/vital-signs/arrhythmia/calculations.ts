
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calcula RMSSD: Root Mean Square of Successive Differences
 * Métrica utilizada para detectar arritmias
 * @param intervals Intervalos RR en ms
 * @returns Valor RMSSD
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  let count = 0;
  
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
    count++;
  }
  
  if (count === 0) return 0;
  
  return Math.sqrt(sumSquaredDiff / count);
}

/**
 * Calcula la variación en intervalos RR
 * @param intervals Intervalos RR en ms
 * @returns Valor de variación RR
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const min = Math.min(...intervals);
  const max = Math.max(...intervals);
  
  // Evitar división por cero
  if (min === 0) return 0;
  
  // Calcular variación normalizada
  return (max - min) / min;
}
