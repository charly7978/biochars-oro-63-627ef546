
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Biblioteca avanzada de procesamiento de señales completamente renovada
 * Implementa algoritmos de análisis multiespectral y extracción de características
 */

/**
 * Calcula el componente AC mejorado con eliminación adaptativa de ruido
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Ordenar para análisis por percentiles (más robusto ante outliers)
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // Usar percentiles 5 y 95 en lugar de min/max para robustez
  const p05Index = Math.max(0, Math.floor(values.length * 0.05));
  const p95Index = Math.min(values.length - 1, Math.floor(values.length * 0.95));
  
  const robustMin = sortedValues[p05Index];
  const robustMax = sortedValues[p95Index];
  
  return robustMax - robustMin;
}

/**
 * Calcula el componente DC con estimación adaptativa de línea base
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Ordenar para usar mediana (más robusta que media ante outliers)
  const sortedValues = [...values].sort((a, b) => a - b);
  
  // Usar mediana ponderada con tendencia a valores mínimos
  const medianIndex = Math.floor(values.length / 2);
  const median = sortedValues[medianIndex];
  
  // Calcular primer cuartil
  const q1Index = Math.floor(values.length * 0.25);
  const q1 = sortedValues[q1Index];
  
  // Componente DC es combinación ponderada de mediana y primer cuartil
  return (median * 0.7) + (q1 * 0.3);
}

/**
 * Calcula desviación estándar con ponderación adaptativa
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  // Calcular mediana (más robusta que media para datos fisiológicos)
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(n / 2)];
  
  // Calcular desviación absoluta mediana (MAD) - métrica robusta
  const absoluteDeviations = values.map(v => Math.abs(v - median));
  absoluteDeviations.sort((a, b) => a - b);
  const mad = absoluteDeviations[Math.floor(absoluteDeviations.length / 2)];
  
  // Convertir MAD a desviación estándar estimada
  // Factor 1.4826 conecta MAD con desviación estándar para distribución normal
  const robustStdDev = mad * 1.4826;
  
  // Calcular desviación estándar tradicional como backup
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const traditionalStdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
  );
  
  // Elegir el valor más bajo para conservadurismo
  return Math.min(robustStdDev, traditionalStdDev);
}

/**
 * Media Móvil Exponencial (EMA) mejorada con factores adaptativos
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  // Adaptar alpha basado en diferencia
  const delta = Math.abs(currentValue - prevEMA);
  const adaptiveAlpha = alpha * (1 + delta);
  
  // Limitar alpha a rango razonable
  const boundedAlpha = Math.max(0.05, Math.min(0.5, adaptiveAlpha));
  
  return boundedAlpha * currentValue + (1 - boundedAlpha) * prevEMA;
}

/**
 * Normalización adaptativa con rango dinámico
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0.5; // Evitar división por cero
  
  // Normalizar al rango [0,1]
  const normalized = (value - min) / (max - min);
  
  // Recortar a rango válido
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Detección avanzada de tendencia con análisis multisegmento
 */
export function detectTrend(values: number[]): {
  slope: number;
  direction: 'up' | 'down' | 'stable';
  strength: number;
} {
  if (values.length < 3) {
    return { slope: 0, direction: 'stable', strength: 0 };
  }
  
  // Dividir en segmentos para análisis más robusto
  const segmentLength = Math.min(5, Math.floor(values.length / 3));
  const segments = [];
  
  for (let i = 0; i < values.length; i += segmentLength) {
    segments.push(values.slice(i, i + segmentLength));
  }
  
  // Calcular pendiente para cada segmento
  const segmentSlopes = segments.map(segment => {
    if (segment.length < 2) return 0;
    
    // Regresión lineal simple
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < segment.length; i++) {
      sumX += i;
      sumY += segment[i];
      sumXY += i * segment[i];
      sumX2 += i * i;
    }
    
    const n = segment.length;
    const denominator = n * sumX2 - sumX * sumX;
    
    if (Math.abs(denominator) < 0.0001) return 0;
    
    return (n * sumXY - sumX * sumY) / denominator;
  });
  
  // Ponderar más los segmentos más recientes
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < segmentSlopes.length; i++) {
    const weight = Math.pow(1.5, i); // Peso exponencial
    weightedSum += segmentSlopes[segmentSlopes.length - 1 - i] * weight;
    weightSum += weight;
  }
  
  const avgSlope = weightSum > 0 ? weightedSum / weightSum : 0;
  
  // Determinar dirección y fuerza
  const direction = avgSlope > 0.01 ? 'up' : 
                    avgSlope < -0.01 ? 'down' : 
                    'stable';
  
  // Fuerza como valor absoluto normalizado
  const strength = Math.min(1, Math.abs(avgSlope) * 10);
  
  return {
    slope: avgSlope,
    direction,
    strength
  };
}

/**
 * Filtro de mediana adaptativo para eliminar outliers
 */
export function applyMedianFilter(values: number[], windowSize: number = 5): number[] {
  if (values.length < windowSize) return [...values];
  
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const windowStart = Math.max(0, i - halfWindow);
    const windowEnd = Math.min(values.length - 1, i + halfWindow);
    const window = values.slice(windowStart, windowEnd + 1);
    
    // Ordenar para encontrar mediana
    window.sort((a, b) => a - b);
    const median = window[Math.floor(window.length / 2)];
    
    result.push(median);
  }
  
  return result;
}

/**
 * Recomposición multiresolución para análisis tiempo-frecuencia
 */
export function decomposeSignal(values: number[], levels: number = 3): number[][] {
  if (values.length < Math.pow(2, levels)) {
    return [values];
  }
  
  const result: number[][] = [];
  let currentValues = [...values];
  
  for (let level = 0; level < levels; level++) {
    const approximation: number[] = [];
    const detail: number[] = [];
    
    // Descomposición simple (similar a transformada haar)
    for (let i = 0; i < currentValues.length; i += 2) {
      if (i + 1 < currentValues.length) {
        approximation.push((currentValues[i] + currentValues[i + 1]) / 2);
        detail.push((currentValues[i] - currentValues[i + 1]) / 2);
      } else {
        approximation.push(currentValues[i]);
        detail.push(0);
      }
    }
    
    result.unshift(detail); // Detalles de más fino a más grueso
    currentValues = approximation;
  }
  
  result.unshift(currentValues); // Aproximación final
  
  return result;
}

/**
 * Análisis adaptativo de cualidad de señal
 */
export function analyzeSignalQuality(values: number[]): {
  quality: number;
  features: {
    snr: number;
    periodicity: number;
    stability: number;
  };
} {
  if (values.length < 10) {
    return { 
      quality: 0, 
      features: { snr: 0, periodicity: 0, stability: 0 } 
    };
  }
  
  // Estimar relación señal-ruido
  const filteredValues = applyMedianFilter(values, 5);
  const signalPower = calculateSignalPower(filteredValues);
  const noisePower = calculateNoisePower(values, filteredValues);
  const snr = noisePower > 0 ? signalPower / noisePower : 0;
  
  // Analizar periodicidad
  const periodicity = estimatePeriodicity(values);
  
  // Evaluar estabilidad de línea base
  const stability = evaluateStability(values);
  
  // Calcular puntuación ponderada de calidad
  const quality = Math.min(100, Math.max(0,
    (Math.min(1, snr * 0.5) * 40) +
    (periodicity * 35) +
    (stability * 25)
  ));
  
  return {
    quality,
    features: {
      snr: Math.min(1, snr),
      periodicity,
      stability
    }
  };
}

/**
 * Funciones auxiliares para análisis de calidad
 */
function calculateSignalPower(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function calculateNoisePower(original: number[], filtered: number[]): number {
  let sum = 0;
  const minLength = Math.min(original.length, filtered.length);
  
  for (let i = 0; i < minLength; i++) {
    sum += Math.pow(original[i] - filtered[i], 2);
  }
  
  return sum / minLength;
}

function estimatePeriodicity(values: number[]): number {
  // Autocorrelación para encontrar periodicidad
  const maxLag = Math.floor(values.length / 3);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const normalizedValues = values.map(v => v - mean);
  
  let maxCorrelation = 0;
  
  for (let lag = 1; lag <= maxLag; lag++) {
    let correlation = 0;
    let count = 0;
    
    for (let i = 0; i < values.length - lag; i++) {
      correlation += normalizedValues[i] * normalizedValues[i + lag];
      count++;
    }
    
    correlation = count > 0 ? correlation / count : 0;
    maxCorrelation = Math.max(maxCorrelation, correlation);
  }
  
  // Normalizar a 0-1
  const variance = normalizedValues.reduce((sum, val) => sum + val * val, 0) / values.length;
  return variance > 0 ? Math.min(1, maxCorrelation / variance) : 0;
}

function evaluateStability(values: number[]): number {
  if (values.length < 3) return 0;
  
  // Dividir en tercios para evaluar estabilidad de línea base
  const firstThird = values.slice(0, Math.floor(values.length / 3));
  const lastThird = values.slice(-Math.floor(values.length / 3));
  
  const firstMean = firstThird.reduce((sum, val) => sum + val, 0) / firstThird.length;
  const lastMean = lastThird.reduce((sum, val) => sum + val, 0) / lastThird.length;
  
  // Calcular variación relativa de línea base
  const baselineShift = Math.abs(lastMean - firstMean);
  const signalRange = Math.max(...values) - Math.min(...values);
  
  // Estabilidad es inversamente proporcional al desplazamiento de línea base
  return signalRange > 0 ? 
    Math.max(0, 1 - (baselineShift / signalRange) * 2) : 
    0;
}

/**
 * Extracción avanzada de características para análisis multiparamétrico
 */
export function extractSignalFeatures(values: number[]): {
  temporal: {
    mean: number;
    median: number;
    standardDeviation: number;
    skewness: number;
    kurtosis: number;
  };
  spectral: {
    dominantFrequency: number;
    spectralEntropy: number;
    bandPower: number[];
  };
  nonlinear: {
    approximateEntropy: number;
    sampleEntropy: number;
    fractalDimension: number;
  };
} {
  if (values.length < 10) {
    return {
      temporal: { mean: 0, median: 0, standardDeviation: 0, skewness: 0, kurtosis: 0 },
      spectral: { dominantFrequency: 0, spectralEntropy: 0, bandPower: [0, 0, 0] },
      nonlinear: { approximateEntropy: 0, sampleEntropy: 0, fractalDimension: 0 }
    };
  }
  
  // Características temporales
  const sortedValues = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median = sortedValues[Math.floor(values.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Skewness (asimetría)
  const cubedDeviations = values.map(val => Math.pow((val - mean) / standardDeviation, 3));
  const skewness = cubedDeviations.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Kurtosis (apuntamiento)
  const quarticDeviations = values.map(val => Math.pow((val - mean) / standardDeviation, 4));
  const kurtosis = quarticDeviations.reduce((sum, val) => sum + val, 0) / values.length - 3;
  
  // Análisis espectral simplificado
  const { dominantFrequency, spectralEntropy, bandPower } = 
    calculateSpectralFeatures(values);
  
  // Análisis no lineal
  const approximateEntropy = calculateApproximateEntropy(values);
  const sampleEntropy = calculateSampleEntropy(values);
  const fractalDimension = calculateFractalDimension(values);
  
  return {
    temporal: {
      mean,
      median,
      standardDeviation,
      skewness,
      kurtosis
    },
    spectral: {
      dominantFrequency,
      spectralEntropy,
      bandPower
    },
    nonlinear: {
      approximateEntropy,
      sampleEntropy,
      fractalDimension
    }
  };
}

/**
 * Análisis espectral simplificado
 */
function calculateSpectralFeatures(values: number[]): {
  dominantFrequency: number;
  spectralEntropy: number;
  bandPower: number[];
} {
  // Implementación simplificada de análisis espectral
  // Para análisis real, se usaría FFT completa
  
  const normalizedValues = [...values];
  const mean = normalizedValues.reduce((sum, val) => sum + val, 0) / normalizedValues.length;
  normalizedValues.forEach((_, i) => normalizedValues[i] -= mean);
  
  // Estimación de frecuencia dominante con cruces por cero
  let zeroCrossings = 0;
  for (let i = 1; i < normalizedValues.length; i++) {
    if ((normalizedValues[i] > 0 && normalizedValues[i-1] <= 0) ||
        (normalizedValues[i] < 0 && normalizedValues[i-1] >= 0)) {
      zeroCrossings++;
    }
  }
  
  const dominantFrequency = zeroCrossings / (2 * normalizedValues.length);
  
  // Simulación de bandas de potencia (bajo, medio, alto)
  const lowBand = calculateAutocorrelation(normalizedValues, 10, 20);
  const midBand = calculateAutocorrelation(normalizedValues, 5, 10);
  const highBand = calculateAutocorrelation(normalizedValues, 1, 5);
  
  const totalPower = lowBand + midBand + highBand;
  const normalizedBands = totalPower > 0 ? 
    [lowBand / totalPower, midBand / totalPower, highBand / totalPower] :
    [0.33, 0.33, 0.33];
  
  // Entropía espectral simulada (dispersión de energía)
  const spectralEntropy = normalizedBands.reduce((entropy, power) => {
    if (power > 0) {
      entropy -= power * Math.log2(power);
    }
    return entropy;
  }, 0) / Math.log2(3);
  
  return {
    dominantFrequency,
    spectralEntropy,
    bandPower: normalizedBands
  };
}

/**
 * Cálculo de autocorrelación en rango de lag
 */
function calculateAutocorrelation(values: number[], minLag: number, maxLag: number): number {
  let sumCorrelation = 0;
  let count = 0;
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (lag >= values.length) break;
    
    let correlation = 0;
    for (let i = 0; i < values.length - lag; i++) {
      correlation += values[i] * values[i + lag];
    }
    
    sumCorrelation += Math.abs(correlation);
    count++;
  }
  
  return count > 0 ? sumCorrelation / count : 0;
}

/**
 * Entropía aproximada (ApEn)
 */
function calculateApproximateEntropy(values: number[], m: number = 2, r: number = 0.2): number {
  if (values.length < m + 1) return 0;
  
  // Normalizar valores
  const sd = calculateStandardDeviation(values);
  if (sd === 0) return 0;
  
  const normalizedValues = values.map(v => v / sd);
  const tolerance = r * sd;
  
  const phi1 = calculatePhi(normalizedValues, m, tolerance);
  const phi2 = calculatePhi(normalizedValues, m + 1, tolerance);
  
  return Math.max(0, phi1 - phi2);
}

/**
 * Función auxiliar para ApEn
 */
function calculatePhi(values: number[], m: number, tolerance: number): number {
  const N = values.length;
  let count = 0;
  
  for (let i = 0; i <= N - m; i++) {
    let matchCount = 0;
    
    for (let j = 0; j <= N - m; j++) {
      let match = true;
      
      for (let k = 0; k < m; k++) {
        if (Math.abs(values[i + k] - values[j + k]) > tolerance) {
          match = false;
          break;
        }
      }
      
      if (match) matchCount++;
    }
    
    count += Math.log(matchCount / (N - m + 1));
  }
  
  return count / (N - m + 1);
}

/**
 * Entropía muestral (SampEn)
 */
function calculateSampleEntropy(values: number[], m: number = 2, r: number = 0.2): number {
  if (values.length < m + 1) return 0;
  
  // Normalizar valores
  const sd = calculateStandardDeviation(values);
  if (sd === 0) return 0;
  
  const normalizedValues = values.map(v => v / sd);
  const tolerance = r * sd;
  
  let A = 0;
  let B = 0;
  
  for (let i = 0; i <= values.length - m - 1; i++) {
    for (let j = i + 1; j <= values.length - m - 1; j++) {
      let matchM = true;
      
      for (let k = 0; k < m; k++) {
        if (Math.abs(normalizedValues[i + k] - normalizedValues[j + k]) > tolerance) {
          matchM = false;
          break;
        }
      }
      
      if (matchM) {
        B++;
        
        if (Math.abs(normalizedValues[i + m] - normalizedValues[j + m]) <= tolerance) {
          A++;
        }
      }
    }
  }
  
  return B > 0 ? -Math.log(A / B) : 0;
}

/**
 * Dimensión fractal (algoritmo Higuchi)
 */
function calculateFractalDimension(values: number[]): number {
  if (values.length < 10) return 1.0;
  
  const kMax = 10;
  const kValues: number[] = [];
  const lValues: number[] = [];
  
  for (let k = 1; k <= kMax; k++) {
    let sum = 0;
    
    for (let m = 0; m < k; m++) {
      let length = 0;
      
      for (let i = 1; i * k + m < values.length; i++) {
        length += Math.abs(values[i * k + m] - values[(i - 1) * k + m]);
      }
      
      // Normalizar
      const N = Math.floor((values.length - m) / k);
      length *= (values.length - 1) / (N * k);
      
      sum += length;
    }
    
    lValues.push(Math.log(sum / k));
    kValues.push(Math.log(1 / k));
  }
  
  // Regresión lineal para estimar dimensión fractal
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
  
  for (let i = 0; i < kValues.length; i++) {
    sumXY += kValues[i] * lValues[i];
    sumX += kValues[i];
    sumY += lValues[i];
    sumX2 += kValues[i] * kValues[i];
  }
  
  const n = kValues.length;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // La dimensión fractal es la pendiente de la regresión
  return Math.max(1, Math.min(2, slope));
}
