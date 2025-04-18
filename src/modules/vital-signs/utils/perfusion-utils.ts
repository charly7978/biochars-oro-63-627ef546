
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Perfusion index utilities for vital signs monitoring
 * All functions process only real data without simulation
 */

/**
 * Calculate perfusion index based on real AC and DC components
 * No simulation is used
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  // Ensure perfusion index is non-negative
  const pi = ac / dc;
  return Math.max(0, pi);
}
