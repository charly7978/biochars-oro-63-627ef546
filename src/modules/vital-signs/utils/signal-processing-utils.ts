
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  let max = values[0];
  let min = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
    if (values[i] < min) min = values[i];
  }
  
  return max - min;
}

export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  const mean = sum / n;
  
  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sumSqDiff += diff * diff;
  }
  
  return sumSqDiff / n;
}

export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}
