
/**
 * Utility functions for vital signs processing
 * Implementaciones basadas en métodos estándar de procesamiento de señales biomédicas
 */

/**
 * Calcula la componente AC (amplitud de la señal pulsátil) de una señal PPG
 * Implementado según estándares de procesamiento de fotopletismografía
 * @param values Array de valores de la señal PPG
 * @returns Valor de la componente AC
 */
export const calculateAC = (values: number[]): number => {
  if (!values || values.length < 10) return 0;
  
  // Análisis de ventana deslizante para mayor precisión que un simple min/max
  let maxAC = 0;
  const windowSize = Math.min(30, Math.floor(values.length / 3));
  
  for (let i = 0; i <= values.length - windowSize; i++) {
    const segment = values.slice(i, i + windowSize);
    const segmentAC = Math.max(...segment) - Math.min(...segment);
    maxAC = Math.max(maxAC, segmentAC);
  }
  
  return maxAC;
};

/**
 * Calcula la componente DC (nivel de señal base) de una señal PPG
 * @param values Array de valores de la señal PPG
 * @returns Valor de la componente DC
 */
export const calculateDC = (values: number[]): number => {
  if (!values || values.length < 5) return 0;
  
  // Implementación de filtro paso bajo para estimar DC con mayor precisión
  // que un simple promedio
  const sortedValues = [...values].sort((a, b) => a - b);
  const lowerQuartile = Math.floor(sortedValues.length * 0.25);
  const upperQuartile = Math.ceil(sortedValues.length * 0.75);
  
  // Usar valores del rango intercuartil para estimar DC
  const filteredValues = sortedValues.slice(lowerQuartile, upperQuartile);
  return filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;
};

/**
 * Aplica un filtro de media móvil a una señal
 * Implementación estándar para reducción de ruido en señales biomédicas
 * @param values Valores de entrada
 * @param windowSize Tamaño de la ventana
 * @returns Señal filtrada
 */
export const applySMAFilter = (values: number[], windowSize: number = 5): number[] => {
  if (!values || values.length < windowSize) return [...values];
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(values.length - 1, i + halfWindow); j++) {
      sum += values[j];
      count++;
    }
    
    result.push(sum / count);
  }
  
  return result;
};

/**
 * Aplica filtro mediana para eliminar artefactos y valores atípicos
 * Especialmente útil para eliminar ruido impulsivo en señales PPG
 * @param values Valores de entrada
 * @param windowSize Tamaño de la ventana
 * @returns Señal filtrada
 */
export const applyMedianFilter = (values: number[], windowSize: number = 5): number[] => {
  if (!values || values.length < windowSize) return [...values];
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const windowValues = [];
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(values.length - 1, i + halfWindow); j++) {
      windowValues.push(values[j]);
    }
    
    windowValues.sort((a, b) => a - b);
    result.push(windowValues[Math.floor(windowValues.length / 2)]);
  }
  
  return result;
};

/**
 * Aplica filtro Butterworth paso bajo de segundo orden (implementación simplificada)
 * Algoritmo profesional para eliminar ruido de alta frecuencia en señales fisiológicas
 * @param values Valores de entrada
 * @param cutoffFreq Frecuencia de corte normalizada (0.0-1.0)
 * @returns Señal filtrada
 */
export const applyLowPassFilter = (values: number[], cutoffFreq: number = 0.1): number[] => {
  if (!values || values.length < 3) return [...values];
  
  // Coeficientes del filtro Butterworth de segundo orden
  const omega = Math.tan(Math.PI * cutoffFreq);
  const omegaSq = omega * omega;
  const b0 = omegaSq / (1 + Math.SQRT2 * omega + omegaSq);
  const b1 = 2 * b0;
  const b2 = b0;
  const a1 = 2 * (omegaSq - 1) / (1 + Math.SQRT2 * omega + omegaSq);
  const a2 = (1 - Math.SQRT2 * omega + omegaSq) / (1 + Math.SQRT2 * omega + omegaSq);
  
  const result = new Array(values.length).fill(0);
  
  // Inicializar con los primeros valores
  result[0] = values[0];
  if (values.length > 1) {
    result[1] = values[1];
  }
  
  // Aplicar filtro
  for (let i = 2; i < values.length; i++) {
    result[i] = b0 * values[i] + b1 * values[i-1] + b2 * values[i-2] - 
                a1 * result[i-1] - a2 * result[i-2];
  }
  
  return result;
};

/**
 * Encuentra picos y valles en una señal
 * Algoritmo robusto que considera pendientes, anchuras y amplitudes
 * @param values Valores de la señal
 * @param prominence Factor de prominencia para filtrar picos/valles poco significativos
 * @returns Índices de picos y valles
 */
export const findPeaksAndValleys = (values: number[], prominence: number = 0.3): { 
  peaks: number[]; 
  valleys: number[];
} => {
  if (!values || values.length < 5) return { peaks: [], valleys: [] };
  
  const peaks: number[] = [];
  const valleys: number[] = [];
  
  // Filtrar la señal para reducir falsos positivos
  const filteredValues = applySMAFilter(values, 3);
  
  // Calcular los umbrales de prominencia
  const range = Math.max(...filteredValues) - Math.min(...filteredValues);
  const minProminence = range * prominence;
  
  // Buscar picos
  for (let i = 2; i < filteredValues.length - 2; i++) {
    // Condición de pico mejorada (evaluación de 5 puntos)
    const isPeak = 
      filteredValues[i] > filteredValues[i-1] && 
      filteredValues[i] > filteredValues[i-2] &&
      filteredValues[i] > filteredValues[i+1] && 
      filteredValues[i] > filteredValues[i+2];
      
    if (isPeak) {
      // Verificar prominencia (altura relativa al valle más cercano)
      let leftValley = filteredValues[i];
      for (let j = i-1; j >= 0; j--) {
        if (filteredValues[j] < leftValley) {
          leftValley = filteredValues[j];
        }
        if (filteredValues[j] > filteredValues[i]) break;
      }
      
      let rightValley = filteredValues[i];
      for (let j = i+1; j < filteredValues.length; j++) {
        if (filteredValues[j] < rightValley) {
          rightValley = filteredValues[j];
        }
        if (filteredValues[j] > filteredValues[i]) break;
      }
      
      const prominence = Math.min(
        filteredValues[i] - leftValley,
        filteredValues[i] - rightValley
      );
      
      if (prominence >= minProminence) {
        peaks.push(i);
      }
    }
  }
  
  // Buscar valles
  for (let i = 2; i < filteredValues.length - 2; i++) {
    // Condición de valle mejorada (evaluación de 5 puntos)
    const isValley = 
      filteredValues[i] < filteredValues[i-1] && 
      filteredValues[i] < filteredValues[i-2] &&
      filteredValues[i] < filteredValues[i+1] && 
      filteredValues[i] < filteredValues[i+2];
      
    if (isValley) {
      // Verificar prominencia (profundidad relativa al pico más cercano)
      let leftPeak = filteredValues[i];
      for (let j = i-1; j >= 0; j--) {
        if (filteredValues[j] > leftPeak) {
          leftPeak = filteredValues[j];
        }
        if (filteredValues[j] < filteredValues[i]) break;
      }
      
      let rightPeak = filteredValues[i];
      for (let j = i+1; j < filteredValues.length; j++) {
        if (filteredValues[j] > rightPeak) {
          rightPeak = filteredValues[j];
        }
        if (filteredValues[j] < filteredValues[i]) break;
      }
      
      const prominence = Math.min(
        leftPeak - filteredValues[i],
        rightPeak - filteredValues[i]
      );
      
      if (prominence >= minProminence) {
        valleys.push(i);
      }
    }
  }
  
  return { peaks, valleys };
};

/**
 * Calcula variabilidad de la frecuencia cardíaca (HRV) con método RMSSD
 * Método estándar usado en evaluación clínica de ECG
 * @param rrIntervals Intervalos RR en milisegundos
 * @returns Valor RMSSD
 */
export const calculateRMSSD = (rrIntervals: number[]): number => {
  if (!rrIntervals || rrIntervals.length < 3) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
};

/**
 * Calcula el índice de perfusión a partir de una señal PPG
 * Métrica utilizada en aplicaciones clínicas para evaluar la calidad de la señal
 * @param values Valores de señal PPG
 * @returns Índice de perfusión (0-1)
 */
export const calculatePerfusionIndex = (values: number[]): number => {
  if (!values || values.length < 5) return 0;
  
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  
  if (dc === 0) return 0;
  
  return ac / dc;
};

/**
 * Calcula la calidad de la señal PPG basada en múltiples métricas
 * Evaluación integral de la señal para aplicaciones médicas
 * @param values Valores de la señal PPG
 * @returns Puntuación de calidad (0-100)
 */
export const calculateSignalQuality = (values: number[]): number => {
  if (!values || values.length < 10) return 0;
  
  // Calcular métricas básicas
  const ac = calculateAC(values);
  const dc = calculateDC(values);
  const perfusionIndex = dc !== 0 ? ac / dc : 0;
  
  // Detectar picos para evaluar ritmo
  const { peaks } = findPeaksAndValleys(values);
  
  // Calcular regularidad de intervalos entre picos
  let intervalVariability = 0;
  if (peaks.length > 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    intervalVariability = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length / avgInterval;
  }
  
  // Calcular SNR (relación señal-ruido) simplificada
  const filteredSignal = applySMAFilter(values, 5);
  let noiseLevel = 0;
  for (let i = 0; i < values.length; i++) {
    noiseLevel += Math.pow(values[i] - filteredSignal[i], 2);
  }
  noiseLevel = Math.sqrt(noiseLevel / values.length);
  const signalPower = ac * ac / 8; // Aproximación de potencia de señal
  const snr = noiseLevel > 0 ? 10 * Math.log10(signalPower / noiseLevel) : 0;
  
  // Ponderar métricas para puntuación final
  const perfusionScore = Math.min(100, perfusionIndex * 1000);
  const rhythmScore = Math.max(0, 100 * (1 - Math.min(1, intervalVariability)));
  const snrScore = Math.max(0, Math.min(100, snr * 5 + 50));
  
  const weightedScore = 
    0.5 * perfusionScore + 
    0.3 * rhythmScore + 
    0.2 * snrScore;
  
  return Math.round(Math.max(0, Math.min(100, weightedScore)));
};

/**
 * Detecta la presencia de arritmias basado en variabilidad de intervalos RR
 * Implementación basada en criterios clínicos simplificados
 * @param rrIntervals Intervalos RR en ms
 * @returns Clasificación de arritmia
 */
export const detectArrhythmia = (rrIntervals: number[]): {
  detected: boolean;
  type: string;
  confidence: number;
} => {
  if (!rrIntervals || rrIntervals.length < 6) {
    return { detected: false, type: 'INSUFICIENTES_DATOS', confidence: 0 };
  }
  
  // Calcular métricas HRV
  const rmssd = calculateRMSSD(rrIntervals);
  const recentRR = rrIntervals.slice(-5);
  const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
  const lastRR = recentRR[recentRR.length - 1];
  
  // Calcular desviación estándar de RR
  const rrSD = Math.sqrt(
    recentRR.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / recentRR.length
  );
  
  // Calcular variación porcentual
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Criterios de detección de arritmias
  const hasSeverePrematureBeat = lastRR < 0.7 * avgRR;
  const hasPause = lastRR > 1.7 * avgRR;
  const hasHighVariability = rrSD > 50 && rmssd > 70;
  const hasModerateVariability = rrSD > 35 && rrVariation > 0.3;
  
  // Determinar tipo de arritmia y confianza
  if (hasSeverePrematureBeat) {
    return { 
      detected: true, 
      type: 'LATIDO_PREMATURO', 
      confidence: Math.min(0.9, 0.5 + rrVariation) 
    };
  } else if (hasPause) {
    return { 
      detected: true, 
      type: 'PAUSA_CARDÍACA', 
      confidence: Math.min(0.9, 0.5 + rrVariation) 
    };
  } else if (hasHighVariability) {
    return { 
      detected: true, 
      type: 'ARRITMIA_SEVERA', 
      confidence: Math.min(0.9, 0.5 + (rrSD / 100)) 
    };
  } else if (hasModerateVariability) {
    return { 
      detected: true, 
      type: 'ARRITMIA_MODERADA', 
      confidence: Math.min(0.8, 0.3 + (rrSD / 100)) 
    };
  }
  
  return { detected: false, type: 'RITMO_NORMAL', confidence: 0.7 };
};
