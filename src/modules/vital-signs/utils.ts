
/**
 * Funciones de utilidad para procesamiento de señales biomédicas
 * Implementa algoritmos avanzados para análisis de señales PPG y ECG
 */

/**
 * Aplica un filtro de media móvil simple
 */
export function applySMAFilter(values: number[], windowSize: number = 5): number[] {
  if (!values || values.length === 0) return [];
  if (values.length < windowSize) return [...values];
  
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
}

/**
 * Aplica un filtro de mediana para eliminar ruido impulsivo
 */
export function applyMedianFilter(values: number[], windowSize: number = 3): number[] {
  if (!values || values.length === 0) return [];
  if (values.length < windowSize) return [...values];
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const windowValues: number[] = [];
    
    for (let j = Math.max(0, i - halfWindow); 
         j <= Math.min(values.length - 1, i + halfWindow); 
         j++) {
      windowValues.push(values[j]);
    }
    
    windowValues.sort((a, b) => a - b);
    const medianIndex = Math.floor(windowValues.length / 2);
    result.push(windowValues[medianIndex]);
  }
  
  return result;
}

/**
 * Aplica un filtro paso bajo para eliminar frecuencias altas
 */
export function applyLowPassFilter(values: number[], alpha: number = 0.1): number[] {
  if (!values || values.length === 0) return [];
  
  const result: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  
  return result;
}

/**
 * Encuentra picos y valles en la señal
 */
export function findPeaksAndValleys(values: number[], sensitivity: number = 0.2): {
  peaks: number[];
  valleys: number[];
} {
  if (!values || values.length < 5) return { peaks: [], valleys: [] };
  
  const peaks: number[] = [];
  const valleys: number[] = [];
  
  // Normalizar sensibilidad
  const amplitude = Math.max(...values) - Math.min(...values);
  const threshold = amplitude * sensitivity;
  
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    
    // Detectar picos
    if (v > values[i - 1] && 
        v > values[i - 2] && 
        v > values[i + 1] && 
        v > values[i + 2] && 
        (v - Math.min(values[i - 1], values[i + 1])) > threshold) {
      peaks.push(i);
    }
    
    // Detectar valles
    if (v < values[i - 1] && 
        v < values[i - 2] && 
        v < values[i + 1] && 
        v < values[i + 2] && 
        (Math.max(values[i - 1], values[i + 1]) - v) > threshold) {
      valleys.push(i);
    }
  }
  
  return { peaks, valleys };
}

/**
 * Calcula el componente DC (valor medio) de la señal
 */
export function calculateDC(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calcula el componente AC (variación) de la señal
 */
export function calculateAC(values: number[]): number {
  if (!values || values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calcula el índice de perfusión basado en componentes AC/DC
 */
export function calculatePerfusionIndex(values: number[]): number {
  if (!values || values.length < 2) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  if (dc === 0) return 0;
  return ac / dc;
}

/**
 * Calcula la calidad de la señal basada en múltiples factores
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) return 0;
  
  // Factor 1: Amplitud normalizada
  const amplitude = calculateAC(values);
  const amplitudeScore = Math.min(100, amplitude * 50);
  
  // Factor 2: Consistencia de la señal
  const mean = calculateDC(values);
  const varSum = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const stdDev = Math.sqrt(varSum / values.length);
  const consistencyScore = 100 * Math.exp(-Math.pow(stdDev / mean - 0.15, 2) / 0.01);
  
  // Factor 3: Periodicidad
  const { peaks } = findPeaksAndValleys(values, 0.1);
  const periodicityScore = peaks.length > 1 ? Math.min(100, peaks.length * 20) : 0;
  
  // Ponderar factores
  const qualityScore = (amplitudeScore * 0.4) + (consistencyScore * 0.3) + (periodicityScore * 0.3);
  
  return Math.min(100, Math.max(0, qualityScore));
}

/**
 * Calcula RMSSD (Root Mean Square of Successive Differences)
 * Métrica estándar de variabilidad de frecuencia cardíaca
 */
export function calculateRMSSD(intervals: number[]): number {
  if (!intervals || intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
}

/**
 * Detecta arritmias basadas en análisis avanzado de variabilidad cardíaca
 */
export function detectArrhythmia(intervals: number[]): {
  detected: boolean;
  type: string;
  severity: number;
} {
  if (!intervals || intervals.length < 3) {
    return { detected: false, type: 'INSUFICIENTES_DATOS', severity: 0 };
  }
  
  // Calcular RMSSD
  const rmssd = calculateRMSSD(intervals);
  
  // Calcular promedio y desviación estándar
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const varSum = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const stdDev = Math.sqrt(varSum / intervals.length);
  
  // Calcular coeficiente de variación (CV)
  const cv = stdDev / mean;
  
  // Verificar si hay latidos prematuros
  const prematureBeat = intervals.some(interval => interval < mean * 0.7);
  
  // Verificar si hay pausas anormales
  const prolongedInterval = intervals.some(interval => interval > mean * 1.5);
  
  // Análisis multi-paramétrico para detección de arritmias
  let arrhythmiaDetected = false;
  let arrhythmiaType = 'RITMO_NORMAL';
  let severity = 0;
  
  if (rmssd > 50 && cv > 0.15) {
    arrhythmiaDetected = true;
    severity = Math.min(10, Math.max(1, Math.floor(rmssd / 10)));
    
    if (prematureBeat) {
      arrhythmiaType = 'LATIDO_PREMATURO';
    } else if (prolongedInterval) {
      arrhythmiaType = 'PAUSAS_ANORMALES';
    } else {
      arrhythmiaType = 'IRREGULARIDAD_RITMO';
    }
  } else if (stdDev < 10 && mean < 600) {
    // Patrón de taquicardia regular
    arrhythmiaDetected = true;
    arrhythmiaType = 'TAQUICARDIA';
    severity = 5;
  } else if (stdDev < 15 && mean > 1000) {
    // Patrón de bradicardia regular
    arrhythmiaDetected = true;
    arrhythmiaType = 'BRADICARDIA';
    severity = 3;
  }
  
  return {
    detected: arrhythmiaDetected,
    type: arrhythmiaType,
    severity
  };
}

/**
 * Calcula el área bajo la curva utilizando integración trapezoidal
 */
export function calculateAreaUnderCurve(values: number[]): number {
  if (!values || values.length < 2) return 0;
  
  let area = 0;
  for (let i = 1; i < values.length; i++) {
    area += (values[i] + values[i-1]) / 2;
  }
  
  return area;
}

/**
 * Calcula la amplitud de la señal entre picos y valles
 */
export function calculateAmplitude(values: number[], peaks: number[], valleys: number[]): number {
  if (!values || !peaks || !valleys || peaks.length === 0 || valleys.length === 0) {
    return 0;
  }
  
  const amplitudes: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amplitudes.push(amp);
    }
  }
  
  if (amplitudes.length === 0) return 0;
  return amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
}
