
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Filter utilities for vital signs monitoring
 * All functions process only real data without simulation
 */

/**
 * Applies a Simple Moving Average (SMA) filter to the input signal
 * No simulation is used
 */
export function applySMAFilter(values: number[], windowSize: number = 5): number[] {
  if (values.length === 0) return [];
  if (windowSize <= 1 || values.length <= windowSize) return [...values];
  
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowEnd = i + 1;
    const windowValues = values.slice(windowStart, windowEnd);
    const average = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
    result.push(average);
  }
  
  return result;
}

/**
 * Amplifies the signal by multiplying with a factor
 * No simulation is used
 */
export function amplifySignal(values: number[], factor: number = 1.5): number[] {
  if (values.length === 0) return [];
  return values.map(value => value * factor);
}
