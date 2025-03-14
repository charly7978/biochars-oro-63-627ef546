
/**
 * Calcula la componente AC (amplitud de la señal pulsátil) de una señal PPG
 * @param values Array de valores de la señal PPG
 * @returns Valor de la componente AC
 */
export const calculateAC = (values: number[]): number => {
  if (!values || values.length === 0) return 0;
  
  // Cálculo simple y directo: diferencia entre máximo y mínimo
  return Math.max(...values) - Math.min(...values);
};

/**
 * Calcula la componente DC (nivel de señal medio) de una señal PPG
 * @param values Array de valores de la señal PPG
 * @returns Valor de la componente DC
 */
export const calculateDC = (values: number[]): number => {
  if (!values || values.length === 0) return 0;
  
  // Promedio simple de los valores
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Aplica un filtro de media móvil simple a un array de valores
 * @param values Array de valores a filtrar
 * @param windowSize Tamaño de la ventana del filtro
 * @returns Array filtrado
 */
export const applySMAFilter = (values: number[], windowSize: number = 5): number[] => {
  if (!values || values.length === 0) return [];
  if (values.length <= windowSize) return [...values];
  
  const result: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - Math.floor(windowSize / 2)); 
         j <= Math.min(values.length - 1, i + Math.floor(windowSize / 2)); 
         j++) {
      sum += values[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
};

/**
 * Calcula la variabilidad de la frecuencia cardíaca (HRV) a partir de intervalos RR
 * Implementación simplificada sin excesivas validaciones
 * @param rrIntervals Array de intervalos RR en milisegundos
 * @returns Valor RMSSD (Root Mean Square of Successive Differences)
 */
export const calculateRMSSD = (rrIntervals: number[]): number => {
  if (!rrIntervals || rrIntervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
};

/**
 * Detecta si hay un latido prematuro basado en la variación de intervalos RR
 * Implementación directa y simple
 * @param rrIntervals Array de intervalos RR en milisegundos
 * @returns true si se detecta un latido prematuro
 */
export const detectPrematureBeat = (rrIntervals: number[]): boolean => {
  if (!rrIntervals || rrIntervals.length < 3) return false;
  
  const recentRR = rrIntervals.slice(-3);
  const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
  const lastRR = recentRR[recentRR.length - 1];
  
  // Criterio simple: 25% de diferencia respecto a la media reciente
  return Math.abs(lastRR - avgRR) > (avgRR * 0.25);
};

/**
 * Verifica la calidad de la señal PPG con un algoritmo simplificado
 * @param values Array de valores PPG
 * @returns Puntuación de calidad (0-100)
 */
export const calculateSignalQuality = (values: number[]): number => {
  if (!values || values.length < 10) return 0;
  
  // Calcular componentes básicas
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  // Si DC es 0, la calidad es 0
  if (dc === 0) return 0;
  
  // Calcular índice de perfusión (simple relación AC/DC)
  const perfusionIndex = ac / dc;
  
  // Puntuación basada principalmente en la perfusión
  let qualityScore = Math.min(100, perfusionIndex * 1000);
  
  return Math.round(qualityScore);
};
