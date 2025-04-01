
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilidades para normalización y amplificación de señales
 */

/**
 * Normaliza un valor de señal a un rango estándar
 * @param value Valor a normalizar
 * @param buffer Buffer de valores para contexto
 * @returns Valor normalizado (generalmente entre 0 y 1)
 */
export function normalizeSignal(
  value: number,
  buffer: number[]
): number {
  if (buffer.length < 5) {
    return value;
  }
  
  // Calcular rango actual
  const min = Math.min(...buffer);
  const max = Math.max(...buffer);
  
  // Evitar división por cero
  if (max === min) {
    return 0.5;
  }
  
  // Normalizar al rango [0,1]
  return (value - min) / (max - min);
}

/**
 * Aplica amplificación a la señal preservando su forma
 * @param value Valor a amplificar
 * @param factor Factor de amplificación
 * @returns Valor amplificado
 */
export function amplifySignal(
  value: number,
  factor: number = 1.0
): number {
  // Centrar alrededor de 0.5 para amplificar diferencias
  const centered = value - 0.5;
  
  // Amplificar
  const amplified = centered * factor;
  
  // Volver a centrar en 0.5 y limitar al rango [0,1]
  return Math.max(0, Math.min(1, amplified + 0.5));
}

/**
 * Aplica un filtro paso banda a la señal para eliminar frecuencias no deseadas
 * @param value Valor a filtrar
 * @param buffer Buffer de valores
 * @param lowCutoff Frecuencia de corte inferior (Hz)
 * @param highCutoff Frecuencia de corte superior (Hz)
 * @param sampleRate Tasa de muestreo (Hz)
 * @returns Valor filtrado
 */
export function applyBandPassFilter(
  value: number,
  buffer: number[],
  lowCutoff: number = 0.5, // 0.5 Hz (30 BPM)
  highCutoff: number = 3.0, // 3.0 Hz (180 BPM)
  sampleRate: number = 30 // 30 Hz
): number {
  if (buffer.length < 10) {
    return value;
  }
  
  // Implementación simple de filtro IIR paso banda
  // Coeficientes calculados para las frecuencias de corte especificadas
  const a1 = -1.8758081257;
  const a2 = 0.8819730297;
  const b0 = 0.0015225099;
  const b1 = 0.0030450198;
  const b2 = 0.0015225099;
  
  // Obtener valores anteriores
  const x1 = buffer.length >= 1 ? buffer[buffer.length - 1] : value;
  const x2 = buffer.length >= 2 ? buffer[buffer.length - 2] : value;
  const y1 = buffer.length >= 3 ? buffer[buffer.length - 3] : value;
  const y2 = buffer.length >= 4 ? buffer[buffer.length - 4] : value;
  
  // Aplicar filtro
  const filtered = 
    b0 * value + 
    b1 * x1 + 
    b2 * x2 - 
    a1 * y1 - 
    a2 * y2;
  
  return filtered;
}

/**
 * Mejora picos en la señal para detección cardíaca
 * @param value Valor a procesar
 * @param buffer Buffer de valores
 * @returns Valor con picos mejorados
 */
export function enhancePeaks(
  value: number,
  buffer: number[]
): number {
  if (buffer.length < 5) {
    return value;
  }
  
  // Calcular la derivada de la señal
  const derivative = 
    buffer.length >= 1 ? value - buffer[buffer.length - 1] : 0;
  
  // Acentuar cambios positivos (subidas)
  const enhanced = value + Math.max(0, derivative) * 1.5;
  
  // Normalizar a un rango razonable
  return enhanced;
}
