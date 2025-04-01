
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para evaluación de calidad de señal
 */

/**
 * Calcula la varianza de una serie de valores
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Evalúa la calidad de una señal PPG
 */
export function evaluateSignalQuality(
  rawValue: number,
  filteredValue: number,
  buffer: number[],
  qualityThreshold: number = 30
): number {
  if (buffer.length < 5) return 0;
  
  // Calcular varianza como medida de calidad
  const variance = calculateVariance(buffer);
  const amplitudRange = Math.max(...buffer) - Math.min(...buffer);
  
  // Señal débil tiene baja calidad
  if (amplitudRange < 0.01) return Math.max(0, Math.min(20, qualityThreshold / 2));
  
  // Ruido excesivo tiene baja calidad
  if (variance > 0.1) return Math.max(0, Math.min(40, qualityThreshold));
  
  // Señal buena tiene alta calidad
  const baseQuality = Math.min(100, 100 - variance * 500);
  return Math.max(0, Math.min(100, baseQuality));
}

/**
 * Detecta si la señal es débil
 */
export function isWeakSignal(
  value: number,
  weakThreshold: number = 0.02
): boolean {
  return Math.abs(value) < weakThreshold;
}

/**
 * Calcula la fuerza de la señal basada en amplitud
 */
export function calculateSignalStrength(buffer: number[]): number {
  if (buffer.length < 5) return 0;
  
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const amplitude = max - min;
  
  // Normalizar a un rango 0-100
  return Math.min(100, Math.max(0, amplitude * 100));
}
