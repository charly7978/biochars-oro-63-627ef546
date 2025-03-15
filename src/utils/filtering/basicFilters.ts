
/**
 * Utilities for basic signal filtering operations
 */

/**
 * Aplica un filtro de media móvil a una señal
 * @param values Valores a filtrar
 * @param windowSize Tamaño de la ventana de filtrado
 * @returns Valor filtrado
 */
export const applyMovingAverageFilter = (values: number[], windowSize: number = 5): number => {
  if (values.length === 0) return 0;
  if (values.length < windowSize) {
    // Promedio simple si no hay suficientes valores
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  // Tomar últimos N valores para la ventana
  const windowValues = values.slice(-windowSize);
  return windowValues.reduce((a, b) => a + b, 0) / windowSize;
};

/**
 * Aplica un filtro ponderado que da más peso a los valores recientes
 * Útil para señales biomédicas donde los valores recientes son más relevantes
 * @param values Valores a filtrar
 * @param decayFactor Factor de decaimiento (0-1), mayor valor = más peso a valores recientes
 * @returns Valor filtrado
 */
export const applyWeightedFilter = (values: number[], decayFactor: number = 0.8): number => {
  if (values.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < values.length; i++) {
    // Índice invertido para dar más peso a valores recientes
    const reversedIndex = values.length - 1 - i;
    // Peso exponencial basado en la posición
    const weight = Math.pow(decayFactor, i);
    
    weightedSum += values[reversedIndex] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
};

/**
 * Normaliza un valor a un rango específico
 * @param value Valor a normalizar
 * @param min Valor mínimo del rango
 * @param max Valor máximo del rango
 * @returns Valor normalizado (0-1)
 */
export const normalizeValue = (value: number, min: number, max: number): number => {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};
