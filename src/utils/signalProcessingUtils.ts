
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

/**
 * Utilidades centralizadas para procesamiento de señales PPG
 * Funciones comunes utilizadas por varios módulos
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
 * Calcula la calidad de una señal basada en su variabilidad y consistencia
 * @param values Valores de la señal
 * @returns Calidad de la señal (0-100)
 */
export const calculateSignalQuality = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // Calcular estadísticas básicas
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coeffVar = stdDev / Math.abs(mean);
  
  // Señal demasiado estable o demasiado variable
  if (coeffVar < 0.01 || coeffVar > 0.8) {
    return 20;
  }
  
  // Escala logarítmica para el coeficiente de variación
  // Máxima calidad alrededor de 0.2-0.3
  const qualityFactor = Math.max(0, Math.min(1, 1 - (Math.abs(0.2 - coeffVar) / 0.2)));
  
  return qualityFactor * 100;
};

/**
 * Detecta picos en una señal PPG
 * @param values Valores de la señal
 * @param windowSize Tamaño de ventana para detección
 * @param threshold Umbral relativo para considerar un pico
 * @returns Índices de los picos detectados
 */
export const detectPeaks = (
  values: number[], 
  windowSize: number = 5,
  threshold: number = 0.5
): number[] => {
  if (values.length < 2 * windowSize + 1) return [];
  
  const peaks: number[] = [];
  
  for (let i = windowSize; i < values.length - windowSize; i++) {
    const currentValue = values[i];
    let isPeak = true;
    
    // Verificar si es mayor que todos los valores en la ventana anterior
    for (let j = i - windowSize; j < i; j++) {
      if (values[j] >= currentValue) {
        isPeak = false;
        break;
      }
    }
    
    // Verificar si es mayor que todos los valores en la ventana posterior
    if (isPeak) {
      for (let j = i + 1; j <= i + windowSize; j++) {
        if (j < values.length && values[j] > currentValue) {
          isPeak = false;
          break;
        }
      }
    }
    
    if (isPeak) {
      peaks.push(i);
    }
  }
  
  return peaks;
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
