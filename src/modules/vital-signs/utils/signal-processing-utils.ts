
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate AC component (pulse amplitude) from real PPG values
 * Direct measurement only - no simulation
 */
export const calculateAC = (values: number[]): number => {
  if (values.length < 3) return 0;
  
  // Calculate peak-to-peak amplitude from real data
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  return Math.abs(max - min);
};

/**
 * Calculate DC component (baseline) from real PPG values
 * Direct measurement only - no simulation
 */
export const calculateDC = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  // Calculate average value (DC component) from real data
  const sum = values.reduce((total, val) => total + val, 0);
  
  return sum / values.length;
};

/**
 * Calculate standard deviation of real PPG values
 * Direct measurement only - no simulation
 */
export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length < 2) return 0;
  
  const mean = calculateDC(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((total, val) => total + val, 0) / values.length;
  
  return Math.sqrt(variance);
};

/**
 * Calculate Exponential Moving Average for real PPG values
 * Direct measurement only - no simulation
 */
export const calculateEMA = (values: number[], alpha: number = 0.3): number[] => {
  if (values.length === 0) return [];
  
  const emaValues = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    emaValues.push(alpha * values[i] + (1 - alpha) * emaValues[i - 1]);
  }
  
  return emaValues;
};

/**
 * Normalize real PPG values to a 0-1 range
 * Direct measurement only - no simulation
 */
export const normalizeValue = (value: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  
  return (value - min) / (max - min);
};
