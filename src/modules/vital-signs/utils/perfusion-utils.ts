
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculates perfusion index from real PPG values
 * Direct measurement only - no simulation
 */
export const calculatePerfusionIndex = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // Use only recent real values
  const recentValues = values.slice(-15);
  
  // Find min and max from real data
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  
  // Calculate DC and AC components from real signal
  const dc = (max + min) / 2;
  const ac = max - min;
  
  // PI = AC/DC (a standard calculation for real perfusion)
  return dc !== 0 ? ac / Math.abs(dc) : 0;
};

/**
 * Checks if perfusion index is sufficient for accurate measurements
 * Using only real values, not simulated
 */
export const hasSufficientPerfusion = (
  perfusionIndex: number, 
  threshold: number = 0.05
): boolean => {
  return perfusionIndex >= threshold;
};

/**
 * Gets perfusion quality category from real index
 */
export const getPerfusionQuality = (perfusionIndex: number): string => {
  if (perfusionIndex >= 0.15) return 'Excelente';
  if (perfusionIndex >= 0.08) return 'Buena';
  if (perfusionIndex >= 0.04) return 'Aceptable';
  return 'Débil';
};
