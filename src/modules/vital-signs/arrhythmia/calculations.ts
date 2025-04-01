
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Cálculos avanzados para análisis de arritmias cardíacas
 * Basados exclusivamente en procesamiento de datos reales
 */

/**
 * Tipos de análisis de variabilidad cardíaca
 */
export interface HRVMetrics {
  rmssd: number;           // Root Mean Square of Successive Differences
  sdnn: number;            // Standard Deviation of NN intervals
  pnn50: number;           // Percentage of intervals >50ms different from preceding
  triangularIndex: number; // Integral of the density distribution / maximum
  lfHfRatio: number;       // Ratio of Low Frequency to High Frequency power
  sampleEntropy: number;   // Complejidad/regularidad de la serie temporal
  poincarePlot: {          // Índices del gráfico de Poincaré
    sd1: number;           // Desviación estándar perpendicular a la línea de identidad
    sd2: number;           // Desviación estándar a lo largo de la línea de identidad
    ratio: number;         // Ratio SD1/SD2
  }
}

/**
 * Calcular RMSSD (Root Mean Square of Successive Differences)
 * Medida de variabilidad a corto plazo, correlacionada con actividad vagal
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) {
    return 0;
  }
  
  let sumSquaredDiff = 0;
  let validCount = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    
    // Solo incluir intervalos fisiológicamente plausibles
    if (rrIntervals[i] >= 300 && rrIntervals[i] <= 2000 &&
        rrIntervals[i-1] >= 300 && rrIntervals[i-1] <= 2000) {
      sumSquaredDiff += diff * diff;
      validCount++;
    }
  }
  
  if (validCount === 0) {
    return 0;
  }
  
  return Math.sqrt(sumSquaredDiff / validCount);
}

/**
 * Calcular SDNN (Standard Deviation of NN Intervals)
 * Refleja todos los componentes cíclicos de la variabilidad
 */
export function calculateSDNN(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) {
    return 0;
  }
  
  // Filtrar solo intervalos fisiológicamente plausibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < 2) {
    return 0;
  }
  
  const mean = validIntervals.reduce((sum, rr) => sum + rr, 0) / validIntervals.length;
  const squaredDiffs = validIntervals.map(rr => Math.pow(rr - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / validIntervals.length;
  
  return Math.sqrt(variance);
}

/**
 * Calcular pNN50 (Percentage of intervals >50ms different from preceding)
 * Correlacionado con actividad parasimpática
 */
export function calculatePNN50(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) {
    return 0;
  }
  
  let nn50Count = 0;
  let validCount = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    // Solo incluir intervalos fisiológicamente plausibles
    if (rrIntervals[i] >= 300 && rrIntervals[i] <= 2000 &&
        rrIntervals[i-1] >= 300 && rrIntervals[i-1] <= 2000) {
      
      const absDiff = Math.abs(rrIntervals[i] - rrIntervals[i-1]);
      if (absDiff > 50) {
        nn50Count++;
      }
      validCount++;
    }
  }
  
  if (validCount === 0) {
    return 0;
  }
  
  return (nn50Count / validCount) * 100;
}

/**
 * Calcular índices del gráfico de Poincaré
 * SD1: variabilidad a corto plazo, SD2: variabilidad a largo plazo
 */
export function calculatePoincareIndices(rrIntervals: number[]): { sd1: number, sd2: number, ratio: number } {
  if (rrIntervals.length < 2) {
    return { sd1: 0, sd2: 0, ratio: 0 };
  }
  
  // Filtrar solo intervalos fisiológicamente plausibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < 2) {
    return { sd1: 0, sd2: 0, ratio: 0 };
  }
  
  // Crear pares de intervalos sucesivos (RRn, RRn+1)
  const pairs: [number, number][] = [];
  for (let i = 0; i < validIntervals.length - 1; i++) {
    pairs.push([validIntervals[i], validIntervals[i+1]]);
  }
  
  // Calcular diferencias para cada par
  const diffs: number[] = [];
  for (const [rr1, rr2] of pairs) {
    diffs.push(rr2 - rr1);
  }
  
  // Calcular SD1 y SD2
  const sd1 = Math.sqrt(calculateVariance(diffs) / 2);
  
  // Calcular media de intervalos
  const mean = validIntervals.reduce((sum, rr) => sum + rr, 0) / validIntervals.length;
  
  // Calcular proyecciones sobre la línea de identidad
  const projections: number[] = [];
  for (const [rr1, rr2] of pairs) {
    projections.push((rr1 + rr2) / Math.sqrt(2) - Math.sqrt(2) * mean);
  }
  
  const sd2 = Math.sqrt(calculateVariance(projections));
  const ratio = sd1 / (sd2 || 1); // Evitar división por cero
  
  return { sd1, sd2, ratio };
}

/**
 * Calcular varianza de un array de números
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
}

/**
 * Calcular el índice triangular de HRV
 * Medida geométrica de la variabilidad
 */
export function calculateTriangularIndex(rrIntervals: number[]): number {
  if (rrIntervals.length < 5) {
    return 0;
  }
  
  // Filtrar solo intervalos fisiológicamente plausibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < 5) {
    return 0;
  }
  
  // Crear histograma de intervalos RR (binning)
  const binWidth = 8; // 8ms por bin
  const histogram: Map<number, number> = new Map();
  
  for (const rr of validIntervals) {
    const bin = Math.floor(rr / binWidth);
    histogram.set(bin, (histogram.get(bin) || 0) + 1);
  }
  
  // Encontrar bin con máxima frecuencia
  let maxFrequency = 0;
  for (const frequency of histogram.values()) {
    maxFrequency = Math.max(maxFrequency, frequency);
  }
  
  // Calcular índice triangular: total de intervalos / frecuencia máxima
  return maxFrequency > 0 ? validIntervals.length / maxFrequency : 0;
}

/**
 * Analizar el dominio de frecuencia para cálculo de ratio LF/HF
 * LF (0.04-0.15 Hz): influencia simpática y parasimpática
 * HF (0.15-0.4 Hz): principalmente influencia parasimpática
 */
export function calculateLFHFRatio(rrIntervals: number[]): number {
  if (rrIntervals.length < 10) {
    return 0;
  }
  
  // Filtrar solo intervalos fisiológicamente plausibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < 10) {
    return 0;
  }
  
  // Convertir intervalos a función de tiempo continuo mediante interpolación
  const totalTime = validIntervals.reduce((sum, rr) => sum + rr, 0);
  const resamplingFreq = 4; // Hz
  const numSamples = Math.floor(totalTime * resamplingFreq / 1000);
  
  if (numSamples < 20) {
    return 0;
  }
  
  // Generar señal interpolada
  const interpolatedSignal = interpolateRRSeries(validIntervals, numSamples);
  
  // Aplicar ventana (Hamming)
  const windowedSignal = applyWindow(interpolatedSignal);
  
  // Calcular FFT para análisis espectral
  const fft = calculateFFT(windowedSignal);
  const magnitudes = calculateMagnitudes(fft.real, fft.imag);
  
  // Calcular potencia en bandas de frecuencia
  const lfBand = [0.04, 0.15]; // Low Frequency band (Hz)
  const hfBand = [0.15, 0.4];  // High Frequency band (Hz)
  
  const freqStep = resamplingFreq / numSamples;
  const lfPower = calculateBandPower(magnitudes, freqStep, lfBand);
  const hfPower = calculateBandPower(magnitudes, freqStep, hfBand);
  
  // Calcular ratio LF/HF
  return hfPower > 0 ? lfPower / hfPower : 0;
}

/**
 * Interpolación de serie RR para análisis en frecuencia
 */
function interpolateRRSeries(rrIntervals: number[], numSamples: number): number[] {
  // Generar puntos de tiempo acumulativo
  const timePoints: number[] = [0];
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    timePoints.push(timePoints[i] + rrIntervals[i]);
  }
  
  // Crear nuevos puntos de tiempo equiespaciados
  const totalTime = timePoints[timePoints.length - 1] + rrIntervals[rrIntervals.length - 1];
  const sampledTimes: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    sampledTimes.push(i * totalTime / numSamples);
  }
  
  // Interpolar valores RR en nuevos puntos de tiempo
  const interpolated: number[] = [];
  
  for (const t of sampledTimes) {
    // Encontrar el segmento donde cae el tiempo
    let idx = 0;
    while (idx < timePoints.length - 1 && timePoints[idx + 1] < t) {
      idx++;
    }
    
    // Interpolar linealmente
    if (idx < timePoints.length - 1) {
      const t1 = timePoints[idx];
      const t2 = timePoints[idx + 1];
      const rr1 = rrIntervals[idx];
      const rr2 = idx + 1 < rrIntervals.length ? rrIntervals[idx + 1] : rrIntervals[idx];
      
      const alpha = (t - t1) / (t2 - t1);
      interpolated.push(rr1 + alpha * (rr2 - rr1));
    } else {
      // Último punto
      interpolated.push(rrIntervals[rrIntervals.length - 1]);
    }
  }
  
  return interpolated;
}

/**
 * Aplicar ventana de Hamming a la señal
 */
function applyWindow(signal: number[]): number[] {
  const n = signal.length;
  const windowed: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const windowCoef = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
    windowed.push(signal[i] * windowCoef);
  }
  
  return windowed;
}

/**
 * Calcular DFT de la señal (versión simple)
 */
function calculateFFT(signal: number[]): { real: number[]; imag: number[] } {
  const n = signal.length;
  const real: number[] = [];
  const imag: number[] = [];
  
  // Solo calculamos la mitad del espectro (por simetría)
  for (let k = 0; k < n / 2; k++) {
    let re = 0;
    let im = 0;
    
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      re += signal[t] * Math.cos(angle);
      im += signal[t] * Math.sin(angle);
    }
    
    real.push(re);
    imag.push(im);
  }
  
  return { real, imag };
}

/**
 * Calcular magnitudes del espectro
 */
function calculateMagnitudes(real: number[], imag: number[]): number[] {
  const magnitudes: number[] = [];
  
  for (let i = 0; i < real.length; i++) {
    magnitudes.push(real[i] * real[i] + imag[i] * imag[i]);
  }
  
  return magnitudes;
}

/**
 * Calcular potencia espectral en una banda de frecuencia
 */
function calculateBandPower(
  magnitudes: number[], 
  freqStep: number, 
  band: [number, number]
): number {
  const minBin = Math.floor(band[0] / freqStep);
  const maxBin = Math.ceil(band[1] / freqStep);
  
  let power = 0;
  for (let i = Math.max(0, minBin); i < Math.min(magnitudes.length, maxBin); i++) {
    power += magnitudes[i];
  }
  
  return power;
}

/**
 * Calcular Entropía Aproximada (ApEn) o Entropía Muestral (SampEn)
 * Mide la complejidad/regularidad de una serie temporal
 */
export function calculateSampleEntropy(rrIntervals: number[], m: number = 2, r: number = 0.2): number {
  if (rrIntervals.length < m + 2) {
    return 0;
  }
  
  // Filtrar solo intervalos fisiológicamente plausibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < m + 2) {
    return 0;
  }
  
  // Normalizar r con respecto a la desviación estándar
  const std = calculateSDNN(validIntervals);
  const threshold = r * std;
  
  // Contar templates para dimensiones m y m+1
  const countM = countMatchingTemplates(validIntervals, m, threshold);
  const countM1 = countMatchingTemplates(validIntervals, m + 1, threshold);
  
  // SampEn = -ln(A/B) donde A = countM1, B = countM
  if (countM === 0 || countM1 === 0) {
    return 0;
  }
  
  return -Math.log(countM1 / countM);
}

/**
 * Contar templates coincidentes para el cálculo de entropía
 */
function countMatchingTemplates(series: number[], m: number, threshold: number): number {
  const n = series.length;
  let count = 0;
  let totalComparisons = 0;
  
  for (let i = 0; i < n - m + 1; i++) {
    const templateI = series.slice(i, i + m);
    
    for (let j = i + 1; j < n - m + 1; j++) {
      const templateJ = series.slice(j, j + m);
      
      // Calcular distancia máxima entre templates
      let maxDist = 0;
      for (let k = 0; k < m; k++) {
        maxDist = Math.max(maxDist, Math.abs(templateI[k] - templateJ[k]));
      }
      
      if (maxDist <= threshold) {
        count++;
      }
      
      totalComparisons++;
    }
  }
  
  return totalComparisons > 0 ? count / totalComparisons : 0;
}

/**
 * Calcular RR Variation (indicador de irregularidad del ritmo)
 */
export function calculateRRVariation(rrIntervals: number[], avgRR?: number): number {
  if (rrIntervals.length < 2) {
    return 0;
  }
  
  // Calcular intervalos RR medios si no se proporciona
  const mean = avgRR || (rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length);
  
  // Calcular desviaciones absolutas y relativas
  const absoluteDeviations = rrIntervals.map(rr => Math.abs(rr - mean));
  const meanAbsoluteDeviation = absoluteDeviations.reduce((sum, val) => sum + val, 0) / absoluteDeviations.length;
  
  // Calcular variación relativa (coeficiente de variación)
  const rrVariation = meanAbsoluteDeviation / mean;
  
  return rrVariation;
}

/**
 * Calcular todas las métricas de HRV
 */
export function calculateHRVMetrics(rrIntervals: number[]): HRVMetrics {
  if (rrIntervals.length < 5) {
    return {
      rmssd: 0,
      sdnn: 0,
      pnn50: 0,
      triangularIndex: 0,
      lfHfRatio: 0,
      sampleEntropy: 0,
      poincarePlot: { sd1: 0, sd2: 0, ratio: 0 }
    };
  }
  
  const rmssd = calculateRMSSD(rrIntervals);
  const sdnn = calculateSDNN(rrIntervals);
  const pnn50 = calculatePNN50(rrIntervals);
  const triangularIndex = calculateTriangularIndex(rrIntervals);
  const lfHfRatio = calculateLFHFRatio(rrIntervals);
  const sampleEntropy = calculateSampleEntropy(rrIntervals);
  const poincarePlot = calculatePoincareIndices(rrIntervals);
  
  return {
    rmssd,
    sdnn,
    pnn50,
    triangularIndex,
    lfHfRatio,
    sampleEntropy,
    poincarePlot
  };
}

/**
 * Detectar patrones específicos de arritmias
 */
export function detectArrhythmiaPatterns(rrIntervals: number[]): {
  hasArrhythmia: boolean;
  arrhythmiaType: string;
  confidence: number;
} {
  if (rrIntervals.length < 8) {
    return { hasArrhythmia: false, arrhythmiaType: 'unknown', confidence: 0 };
  }
  
  // Calcular métricas avanzadas
  const hrvMetrics = calculateHRVMetrics(rrIntervals);
  
  // Verificar fibrilación auricular (alta variabilidad, pérdida de patrón)
  const afScore = calculateAFScore(hrvMetrics, rrIntervals);
  
  // Verificar extrasístoles ventriculares (latidos prematuros seguidos de pausa compensatoria)
  const pvcScore = detectPVCPattern(rrIntervals);
  
  // Verificar ritmo bigémino (alternancia regular de intervalos cortos y largos)
  const bigeminyScore = detectBigeminyPattern(rrIntervals);
  
  // Determinar el tipo de arritmia con mayor puntuación
  const scores = [
    { type: 'atrial_fibrillation', score: afScore },
    { type: 'premature_ventricular', score: pvcScore },
    { type: 'bigeminy', score: bigeminyScore }
  ];
  
  scores.sort((a, b) => b.score - a.score);
  
  const hasArrhythmia = scores[0].score > 0.6;
  
  return {
    hasArrhythmia,
    arrhythmiaType: hasArrhythmia ? scores[0].type : 'normal',
    confidence: scores[0].score
  };
}

/**
 * Calcular puntuación para fibrilación auricular
 */
function calculateAFScore(metrics: HRVMetrics, rrIntervals: number[]): number {
  // Criterios para FA:
  // 1. Alta variabilidad (RMSSD y SDNN aumentados)
  // 2. Alta entropía muestral
  // 3. Bajo SD2/SD1 ratio
  
  // Ajustar umbrales según población y duración del registro
  const rmssdThreshold = 50; // ms
  const entropyThreshold = 1.2;
  const poincaréRatioThreshold = 2;
  
  // Calcular puntuación normalizada para cada métrica
  const rmssdScore = Math.min(1, metrics.rmssd / rmssdThreshold);
  const entropyScore = Math.min(1, metrics.sampleEntropy / entropyThreshold);
  const ratioScore = Math.min(1, (poincaréRatioThreshold / 
                                (metrics.poincarePlot.ratio || 0.1)));
  
  // Verificar irregularidad consistente (sin patrones regulares)
  const irregularityScore = calculateIrregularityConsistency(rrIntervals);
  
  // Combinar puntuaciones (ponderadas)
  return (rmssdScore * 0.3) + 
         (entropyScore * 0.3) + 
         (ratioScore * 0.1) + 
         (irregularityScore * 0.3);
}

/**
 * Evaluar consistencia de irregularidad (para FA)
 */
function calculateIrregularityConsistency(rrIntervals: number[]): number {
  if (rrIntervals.length < 10) {
    return 0;
  }
  
  // Calcular diferencias sucesivas
  const diffs: number[] = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    diffs.push(rrIntervals[i] - rrIntervals[i-1]);
  }
  
  // Contar cambios de signo (indicación de irregularidad)
  let signChanges = 0;
  for (let i = 1; i < diffs.length; i++) {
    if ((diffs[i] >= 0 && diffs[i-1] < 0) || (diffs[i] < 0 && diffs[i-1] >= 0)) {
      signChanges++;
    }
  }
  
  // Normalizar por número de oportunidades de cambio
  const maxChanges = diffs.length - 1;
  const changeRatio = maxChanges > 0 ? signChanges / maxChanges : 0;
  
  // Expectativa para FA: ~50% cambios de signo (aleatoriedad)
  return 1 - Math.abs(changeRatio - 0.5) * 2;
}

/**
 * Detectar patrón de extrasístoles ventriculares
 */
function detectPVCPattern(rrIntervals: number[]): number {
  if (rrIntervals.length < 4) {
    return 0;
  }
  
  // Calcular mediana para referencia
  const sortedRR = [...rrIntervals].sort((a, b) => a - b);
  const medianRR = sortedRR[Math.floor(sortedRR.length / 2)];
  
  // Buscar patrón: normal-prematuro-compensatorio
  let patternCount = 0;
  
  for (let i = 0; i < rrIntervals.length - 2; i++) {
    const rr1 = rrIntervals[i];
    const rr2 = rrIntervals[i+1];
    const rr3 = rrIntervals[i+2];
    
    // Criterio 1: rr2 es al menos 20% más corto que la mediana
    const isPremature = rr2 < medianRR * 0.8;
    
    // Criterio 2: rr3 es más largo (pausa compensatoria)
    const isCompensatory = rr3 > medianRR * 1.2;
    
    // Criterio 3: rr1 está cerca de lo normal
    const isNormalBefore = Math.abs(rr1 - medianRR) < medianRR * 0.2;
    
    if (isPremature && isCompensatory && isNormalBefore) {
      patternCount++;
      i += 2; // Avanzar al siguiente triplete
    }
  }
  
  // Normalizar puntuación basada en número de tripletes posibles
  const possiblePatterns = rrIntervals.length - 2;
  return Math.min(1, patternCount * 3 / possiblePatterns);
}

/**
 * Detectar patrón de bigeminismo
 */
function detectBigeminyPattern(rrIntervals: number[]): number {
  if (rrIntervals.length < 6) {
    return 0;
  }
  
  // Calcular mediana para referencia
  const sortedRR = [...rrIntervals].sort((a, b) => a - b);
  const medianRR = sortedRR[Math.floor(sortedRR.length / 2)];
  
  // Verificar alternancia corto-largo
  let alternanceCount = 0;
  
  for (let i = 0; i < rrIntervals.length - 1; i++) {
    const isCurrentShort = rrIntervals[i] < medianRR * 0.9;
    const isNextLong = rrIntervals[i+1] > medianRR * 1.1;
    
    if ((i % 2 === 0 && isCurrentShort && isNextLong) ||
        (i % 2 === 1 && isNextLong && rrIntervals[i+2] && rrIntervals[i+2] < medianRR * 0.9)) {
      alternanceCount++;
    }
  }
  
  // Normalizar por número de pares que pueden alternar
  const possibleAlternances = Math.floor(rrIntervals.length / 2);
  const alternanceRatio = possibleAlternances > 0 ? alternanceCount / possibleAlternances : 0;
  
  return Math.pow(alternanceRatio, 2); // Potencia para enfatizar patrones más fuertes
}
