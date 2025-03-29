
/**
 * Utilidades esenciales para el procesador optimizado de señales
 * NOTA IMPORTANTE: Módulo minimalista para dar soporte al optimizador de señal principal.
 */

/**
 * Calcula el componente AC (amplitud pico a pico) de una señal
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el componente DC (valor promedio) de una señal
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula el índice de perfusión basado en componentes AC y DC
 */
export function calculatePerfusionIndex(ac: number, dc: number): number {
  if (dc === 0) return 0;
  return ac / dc;
}

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a un valor
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  const updatedBuffer = [...buffer, value];
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  return { filteredValue, updatedBuffer };
}

/**
 * Calcula la media móvil exponencial (EMA) para suavizar señales
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor en un rango específico
 */
export function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

/**
 * Estima el SpO2 basado en los valores de PPG
 */
export function estimateSpO2(values: number[]): number {
  if (values.length < 30) return 0;
  
  const dc = calculateDC(values);
  if (dc === 0) return 0;
  
  const ac = calculateAC(values);
  const perfusionIndex = ac / dc;
  
  if (perfusionIndex < 0.05) return 0;
  
  const R = (ac / dc) / 1.02;
  let spO2 = Math.round(98 - (15 * R));
  
  // Ajustes basados en la calidad de la señal
  if (perfusionIndex > 0.15) {
    spO2 = Math.min(98, spO2 + 1);
  } else if (perfusionIndex < 0.08) {
    spO2 = Math.max(0, spO2 - 1);
  }
  
  return Math.min(98, Math.max(90, spO2));
}

/**
 * Formatea la presión arterial para visualización
 */
export function formatBloodPressure(bp: { systolic: number; diastolic: number }): string {
  if (bp.systolic <= 0 || bp.diastolic <= 0) return "--/--";
  return `${bp.systolic}/${bp.diastolic}`;
}

/**
 * Calcula la amplitud de la señal entre picos y valles
 */
export function calculateAmplitude(
  values: number[], 
  peakIndices: number[], 
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) {
    return 0;
  }
  
  // Calcular la amplitud promedio
  let totalAmplitude = 0;
  let count = 0;
  
  for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
    const peakValue = values[peakIndices[i]];
    const valleyValue = values[valleyIndices[i]];
    totalAmplitude += (peakValue - valleyValue);
    count++;
  }
  
  return count > 0 ? totalAmplitude / count : 0;
}

/**
 * Encuentra los índices de picos y valles en una señal
 */
export function findPeaksAndValleys(values: number[]): {
  peakIndices: number[];
  valleyIndices: number[];
} {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];
  
  if (values.length < 3) {
    return { peakIndices, valleyIndices };
  }
  
  for (let i = 1; i < values.length - 1; i++) {
    // Detectar picos (valores máximos locales)
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      peakIndices.push(i);
    }
    
    // Detectar valles (valores mínimos locales)
    if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
      valleyIndices.push(i);
    }
  }
  
  return { peakIndices, valleyIndices };
}

