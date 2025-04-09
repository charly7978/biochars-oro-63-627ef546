
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Sistema avanzado de análisis de arritmias completamente renovado
 * Utiliza técnicas de análisis no lineal y estadística multivariante
 */

/**
 * Calcular RMSSD renovado con ponderación adaptativa
 * Root Mean Square of Successive Differences mejorado
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Nuevo: Filtrar valores atípicos con rango intercuartil
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const q1Index = Math.floor(intervals.length * 0.25);
  const q3Index = Math.floor(intervals.length * 0.75);
  const q1 = sortedIntervals[q1Index];
  const q3 = sortedIntervals[q3Index];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  // Filtrar valores extremos para análisis más robusto
  const filteredIntervals = intervals.filter(
    interval => interval >= lowerBound && interval <= upperBound
  );
  
  // Si no quedan suficientes intervalos después del filtrado
  if (filteredIntervals.length < 2) {
    // Usar algoritmo básico
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      sumSquaredDiff += Math.pow(intervals[i] - intervals[i-1], 2);
    }
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }
  
  // Calcular diferencias entre intervalos sucesivos
  const differences: number[] = [];
  for (let i = 1; i < filteredIntervals.length; i++) {
    differences.push(filteredIntervals[i] - filteredIntervals[i-1]);
  }
  
  // Nuevo: Ponderación basada en distancia al centro
  const medianDifference = differences.length % 2 === 0 ?
    (differences[differences.length/2 - 1] + differences[differences.length/2]) / 2 :
    differences[Math.floor(differences.length/2)];
  
  let weightedSumSquared = 0;
  let weightSum = 0;
  
  for (const diff of differences) {
    // Menor peso a diferencias muy alejadas de la mediana
    const distance = Math.abs(diff - medianDifference);
    const weight = 1 / (1 + Math.pow(distance / 50, 2));
    
    weightedSumSquared += weight * diff * diff;
    weightSum += weight;
  }
  
  return weightSum > 0 ? 
    Math.sqrt(weightedSumSquared / weightSum) : 
    0;
}

/**
 * Calcular variación de intervalos RR usando análisis por percentiles
 * Incorpora análisis adaptativo de valores atípicos
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 3) return 0;
  
  // Nuevo: Ordenar para análisis por percentiles
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  
  // Calcular percentiles para análisis más robusto
  const p25 = sortedIntervals[Math.floor(intervals.length * 0.25)];
  const p50 = sortedIntervals[Math.floor(intervals.length * 0.5)];
  const p75 = sortedIntervals[Math.floor(intervals.length * 0.75)];
  
  // Rango intercuartil como medida de dispersión
  const iqr = p75 - p25;
  
  // Coeficiente de variación robusto utilizando mediana
  const robustCV = p50 > 0 ? iqr / p50 : 0;
  
  // Nuevo: Añadir detección de patrones avanzada
  let patternScore = 0;
  
  // Detectar alternancia (patrón corto-largo-corto o largo-corto-largo)
  let alternanceCount = 0;
  for (let i = 2; i < intervals.length; i++) {
    if ((intervals[i] > intervals[i-1] && intervals[i-1] < intervals[i-2]) ||
        (intervals[i] < intervals[i-1] && intervals[i-1] > intervals[i-2])) {
      alternanceCount++;
    }
  }
  
  // Normalizar score de alternancia
  if (intervals.length > 2) {
    patternScore = alternanceCount / (intervals.length - 2);
  }
  
  // Variabilidad temporal inmediata (último intervalo vs tendencia)
  const lastRR = intervals[intervals.length - 1];
  const trendRR = calculateTrendValue(intervals);
  
  // Combinar métricas con ponderación adaptativa
  const immediateVariation = Math.abs(lastRR - trendRR) / trendRR;
  
  // Importancia relativa de componentes según longitud de datos
  const patternWeight = Math.min(0.4, 0.1 + (intervals.length / 30));
  const variationWeight = 1 - patternWeight;
  
  return (robustCV * 0.3) + 
         (immediateVariation * variationWeight * 0.7) + 
         (patternScore * patternWeight);
}

/**
 * Nuevo: Calcular valor de tendencia con modelo predictivo simple
 */
export function calculateTrendValue(intervals: number[]): number {
  if (intervals.length < 2) return intervals[0] || 0;
  
  // Para series cortas, usar promedio ponderado reciente
  if (intervals.length < 5) {
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < intervals.length; i++) {
      const weight = Math.pow(1.5, i); // Mayor peso a valores más recientes
      weightedSum += intervals[intervals.length - 1 - i] * weight;
      weightSum += weight;
    }
    
    return weightSum > 0 ? weightedSum / weightSum : intervals[intervals.length - 1];
  }
  
  // Para series más largas, usar regresión lineal simple
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < intervals.length; i++) {
    sumX += i;
    sumY += intervals[i];
    sumXY += i * intervals[i];
    sumX2 += i * i;
  }
  
  const n = intervals.length;
  const denominator = n * sumX2 - sumX * sumX;
  
  if (Math.abs(denominator) < 0.0001) {
    // Evitar división por cero
    return sumY / n;
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Predecir el siguiente valor en la tendencia
  const nextX = n;
  const predictedValue = intercept + slope * nextX;
  
  // Limitar a rangos fisiológicos (300ms - 1500ms)
  return Math.max(300, Math.min(1500, predictedValue));
}

/**
 * Nuevo: Análisis avanzado de variabilidad con entropía aproximada
 * Detecta irregularidades no visibles con métodos convencionales
 */
export function calculateApproximateEntropy(intervals: number[], m: number = 2, r: number = 0.2): number {
  if (intervals.length < m + 1) return 0;
  
  // Normalizar intervalos para usar r como fracción de desviación estándar
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length
  );
  
  const normalizedIntervals = intervals.map(interval => (interval - mean) / stdDev);
  const tolerance = r * stdDev;
  
  // Calcular phi(m) - proporción de patrones similares de longitud m
  const phiM = calculatePhi(normalizedIntervals, m, tolerance);
  
  // Calcular phi(m+1)
  const phiMPlus1 = calculatePhi(normalizedIntervals, m + 1, tolerance);
  
  // Entropía aproximada es la diferencia
  return Math.max(0, phiM - phiMPlus1);
}

/**
 * Función auxiliar para calcular Phi en entropía aproximada
 */
function calculatePhi(normalizedIntervals: number[], m: number, tolerance: number): number {
  const N = normalizedIntervals.length;
  let count = 0;
  let validPatterns = 0;
  
  for (let i = 0; i <= N - m; i++) {
    const templatePattern = normalizedIntervals.slice(i, i + m);
    let matchCount = 0;
    
    for (let j = 0; j <= N - m; j++) {
      if (i === j) continue;
      
      const testPattern = normalizedIntervals.slice(j, j + m);
      let isMatch = true;
      
      for (let k = 0; k < m; k++) {
        if (Math.abs(templatePattern[k] - testPattern[k]) > tolerance) {
          isMatch = false;
          break;
        }
      }
      
      if (isMatch) {
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      count += Math.log(matchCount / (N - m));
      validPatterns++;
    }
  }
  
  return validPatterns > 0 ? count / validPatterns : 0;
}

/**
 * Nuevo: Análisis poincaré de intervalos RR
 * Calcula descriptores no lineales SD1 y SD2
 */
export function calculatePoincarePlot(intervals: number[]): { sd1: number; sd2: number; ratio: number } {
  if (intervals.length < 2) {
    return { sd1: 0, sd2: 0, ratio: 1 };
  }
  
  // Crear pares de puntos (RR_n, RR_n+1)
  const points: Array<[number, number]> = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    points.push([intervals[i], intervals[i + 1]]);
  }
  
  // Calcular línea de identidad y perpendicular
  let sumX1 = 0, sumX2 = 0;
  
  for (const [x, y] of points) {
    // Proyección a línea de identidad (x = y)
    const d1 = (y - x) / Math.sqrt(2);
    
    // Proyección a línea perpendicular (x + y = constante)
    const d2 = (x + y) / Math.sqrt(2);
    
    sumX1 += d1 * d1;
    sumX2 += d2 * d2;
  }
  
  // Calcular desviaciones estándar
  const sd1 = Math.sqrt(sumX1 / points.length);
  const sd2 = Math.sqrt(sumX2 / points.length);
  
  // Calcular ratio SD1/SD2 (indicador de arritmia)
  const ratio = sd2 > 0 ? sd1 / sd2 : 0;
  
  return { sd1, sd2, ratio };
}

/**
 * Nuevo: Detección de rachas (runs) en intervalos RR
 * Identifica secuencias consecutivas de aumento o disminución
 */
export function detectRuns(intervals: number[]): { 
  maxRunLength: number;
  runCount: number;
  runScore: number;
} {
  if (intervals.length < 3) {
    return { maxRunLength: 0, runCount: 0, runScore: 0 };
  }
  
  let currentRun = 1;
  let maxRunLength = 1;
  let runCount = 0;
  let lastDirection = 0;  // 0: indefinido, 1: creciente, -1: decreciente
  
  for (let i = 1; i < intervals.length; i++) {
    const currentDirection = intervals[i] > intervals[i-1] ? 1 : 
                            intervals[i] < intervals[i-1] ? -1 : 0;
    
    if (currentDirection === 0) {
      // Igualdad (poco probable en datos reales)
      continue;
    }
    
    if (lastDirection === 0) {
      lastDirection = currentDirection;
      currentRun = 1;
      continue;
    }
    
    if (currentDirection === lastDirection) {
      currentRun++;
      maxRunLength = Math.max(maxRunLength, currentRun);
    } else {
      if (currentRun >= 3) {
        // Consideramos run significativo si hay 3+ intervalos en la misma dirección
        runCount++;
      }
      currentRun = 1;
      lastDirection = currentDirection;
    }
  }
  
  // Verificar última racha
  if (currentRun >= 3) {
    runCount++;
  }
  
  // Calcular score normalizado 0-1 donde mayor es más arrítmico
  // Fórmula: Combina longitud máxima y número de rachas
  const runScore = Math.min(1, 
    (maxRunLength / 10) * 0.7 + (runCount / (intervals.length / 3)) * 0.3
  );
  
  return { maxRunLength, runCount, runScore };
}

/**
 * Análisis multimétrico integral para detección de arritmias
 */
export function performIntegratedArrhythmiaAnalysis(intervals: number[]): {
  isArrhythmia: boolean;
  confidence: number;
  metrics: {
    rmssd: number;
    rrVariation: number;
    entropy: number;
    poincare: { sd1: number; sd2: number; ratio: number };
    runs: { maxRunLength: number; runCount: number; runScore: number };
  };
} {
  if (intervals.length < 5) {
    return {
      isArrhythmia: false,
      confidence: 0,
      metrics: {
        rmssd: 0,
        rrVariation: 0,
        entropy: 0,
        poincare: { sd1: 0, sd2: 0, ratio: 1 },
        runs: { maxRunLength: 0, runCount: 0, runScore: 0 }
      }
    };
  }
  
  // Calcular todas las métricas
  const rmssd = calculateRMSSD(intervals);
  const rrVariation = calculateRRVariation(intervals);
  const entropy = calculateApproximateEntropy(intervals);
  const poincare = calculatePoincarePlot(intervals);
  const runs = detectRuns(intervals);
  
  // Pesos adaptativos basados en cantidad de datos
  const weights = {
    rmssd: 0.2,
    rrVariation: 0.3,
    entropy: 0.15,
    poincareRatio: 0.2,
    runs: 0.15
  };
  
  // Normalizar métricas con umbrales fisiológicos
  const normalizedRMSSD = Math.min(1, rmssd / 50);
  const normalizedVariation = Math.min(1, rrVariation / 0.15);
  const normalizedEntropy = Math.min(1, entropy / 0.5);
  const normalizedPoincareRatio = poincare.ratio > 1 ? 
    Math.min(1, poincare.ratio / 3) : 
    Math.min(1, 1 / (poincare.ratio * 3));
  
  // Calcular score combinado
  const combinedScore = 
    normalizedRMSSD * weights.rmssd +
    normalizedVariation * weights.rrVariation +
    normalizedEntropy * weights.entropy +
    normalizedPoincareRatio * weights.poincareRatio +
    runs.runScore * weights.runs;
  
  // Umbral para definir arritmia basado en combinación de métricas
  const arrhythmiaThreshold = 0.6;
  const isArrhythmia = combinedScore > arrhythmiaThreshold;
  
  // Nivel de confianza basado en cantidad y consistencia de datos
  let confidenceFactor = Math.min(1, intervals.length / 15);
  
  // Si hay métricas contradictorias, reducir confianza
  if (Math.abs(normalizedRMSSD - normalizedVariation) > 0.5 ||
      Math.abs(normalizedPoincareRatio - runs.runScore) > 0.5) {
    confidenceFactor *= 0.7;
  }
  
  return {
    isArrhythmia,
    confidence: confidenceFactor * Math.abs(combinedScore - arrhythmiaThreshold),
    metrics: {
      rmssd,
      rrVariation,
      entropy,
      poincare,
      runs
    }
  };
}
