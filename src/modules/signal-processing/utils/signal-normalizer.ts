
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para normalización de señal
 */

/**
 * Normaliza una señal relativa a su buffer
 */
export function normalizeSignal(value: number, buffer: number[]): number {
  if (buffer.length < 3) return value;
  
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  const range = max - min;
  
  if (range === 0) return 0;
  
  return (value - min) / range;
}

/**
 * Amplifica una señal por un factor
 */
export function amplifySignal(value: number, factor: number = 1.2): number {
  return value * factor;
}

/**
 * Aplica un filtro adaptativo según la varianza
 */
export function applyAdaptiveFilter(value: number, buffer: number[], strength: number = 0.25): number {
  if (buffer.length < 3) return value;
  
  // Calcular variabilidad reciente
  const variance = calculateVariance(buffer);
  
  // Ajustar fuerza de filtrado según varianza
  const adaptiveAlpha = adjustFilterStrength(variance, strength);
  
  // Aplicar filtro exponencial con alfa adaptativo
  const lastValue = buffer[buffer.length - 1];
  
  return adaptiveAlpha * value + (1 - adaptiveAlpha) * lastValue;
}

/**
 * Ajusta la fuerza del filtrado según la varianza
 */
function adjustFilterStrength(variance: number, baseStrength: number): number {
  // Si la varianza es alta (señal ruidosa), filtrar más fuerte
  if (variance > 0.05) return Math.min(0.15, baseStrength / 2);
  
  // Si la varianza es baja (señal estable), filtrar más suave
  if (variance < 0.01) return Math.min(0.4, baseStrength * 1.5);
  
  // Caso intermedio
  return baseStrength;
}

/**
 * Calcula la varianza de un conjunto de valores
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
}
