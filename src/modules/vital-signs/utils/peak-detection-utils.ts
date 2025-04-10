
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Encuentra picos y valles en una señal real
 * Modificado para representar correctamente los picos en la gráfica PPG
 */
export function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] } {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algoritmo mejorado para detección de picos y valles en datos reales
  // Busca picos correctamente orientados (hacia arriba)
  const WINDOW_SIZE = 5; // Ventana de análisis ampliada para mayor precisión
  const THRESHOLD_FACTOR = 0.95; // Factor para detección de picos
  const MIN_AMPLITUDE = 0.03; // Amplitud mínima para considerar un pico/valle válido

  for (let i = WINDOW_SIZE; i < values.length - WINDOW_SIZE; i++) {
    const v = values[i];
    let isPeak = true;
    let isValley = true;
    
    // Comprobación de ventana para picos
    for (let j = i - WINDOW_SIZE; j < i; j++) {
      if (values[j] * THRESHOLD_FACTOR > v) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      for (let j = i + 1; j <= i + WINDOW_SIZE; j++) {
        if (j < values.length && values[j] * THRESHOLD_FACTOR > v) {
          isPeak = false;
          break;
        }
      }
    }
    
    // Comprobación de ventana para valles
    for (let j = i - WINDOW_SIZE; j < i; j++) {
      if (values[j] * (1/THRESHOLD_FACTOR) < v) {
        isValley = false;
        break;
      }
    }
    
    if (isValley) {
      for (let j = i + 1; j <= i + WINDOW_SIZE; j++) {
        if (j < values.length && values[j] * (1/THRESHOLD_FACTOR) < v) {
          isValley = false;
          break;
        }
      }
    }
    
    // Verificar amplitud mínima para reducir falsos positivos
    if (isPeak) {
      const localMin = Math.min(
        ...values.slice(Math.max(0, i - WINDOW_SIZE), i),
        ...values.slice(i + 1, Math.min(values.length, i + WINDOW_SIZE + 1))
      );
      if (v - localMin > MIN_AMPLITUDE) {
        peakIndices.push(i);
      }
    }
    
    if (isValley) {
      const localMax = Math.max(
        ...values.slice(Math.max(0, i - WINDOW_SIZE), i),
        ...values.slice(i + 1, Math.min(values.length, i + WINDOW_SIZE + 1))
      );
      if (localMax - v > MIN_AMPLITUDE) {
        valleyIndices.push(i);
      }
    }
  }
  
  return { peakIndices, valleyIndices };
}

/**
 * Calcula la amplitud entre picos y valles de señales reales
 * Versión optimizada para mejor precisión
 */
export function calculateAmplitude(
  values: number[],
  peakIndices: number[],
  valleyIndices: number[]
): number {
  if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;

  const amps: number[] = [];
  const MAX_DISTANCE = 10; // Distancia máxima entre pico y valle para considerarlos relacionados
  
  // Relacionar picos y valles en datos reales
  for (const peakIdx of peakIndices) {
    let closestValleyIdx = -1;
    let minDistance = Number.MAX_VALUE;
    
    // Buscar el valle más cercano a este pico
    for (const valleyIdx of valleyIndices) {
      const distance = Math.abs(peakIdx - valleyIdx);
      if (distance < minDistance && distance <= MAX_DISTANCE) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }
    
    if (closestValleyIdx !== -1) {
      const amp = values[peakIdx] - values[closestValleyIdx];
      if (amp > 0) {
        amps.push(amp);
      }
    }
  }
  
  if (amps.length === 0) return 0;

  // Calcular la media robusta (eliminando valores extremos)
  if (amps.length >= 5) {
    // Ordenar amplitudes
    amps.sort((a, b) => a - b);
    
    // Eliminar el 10% inferior y superior para mayor estabilidad
    const startIndex = Math.floor(amps.length * 0.1);
    const endIndex = Math.ceil(amps.length * 0.9);
    
    // Calcular media con los valores restantes
    const trimmedAmps = amps.slice(startIndex, endIndex);
    return trimmedAmps.reduce((a, b) => a + b, 0) / trimmedAmps.length;
  }

  // Calcular la media con datos reales (para pocos datos)
  return amps.reduce((a, b) => a + b, 0) / amps.length;
}

/**
 * Identifica segmentos de arritmia en una serie temporal de intervalos RR
 * @param rrIntervals Serie de intervalos RR en milisegundos
 * @returns Array de índices donde se detectan arritmias
 */
export function identifyArrhythmiaSegments(rrIntervals: number[]): number[] {
  if (rrIntervals.length < 3) return [];
  
  const arrhythmiaIndices: number[] = [];
  const THRESHOLD_PERCENT = 20; // % de variación que indica arritmia
  
  // Calcular estadísticas básicas para crear un umbral adaptativo
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < rrIntervals.length; i++) {
    if (rrIntervals[i] >= 500 && rrIntervals[i] <= 1500) { // Rango fisiológico normal
      sum += rrIntervals[i];
      count++;
    }
  }
  
  if (count === 0) return []; // No hay suficientes intervalos válidos
  
  const mean = sum / count;
  const threshold = mean * (THRESHOLD_PERCENT / 100);
  
  // Detectar variaciones significativas
  for (let i = 1; i < rrIntervals.length; i++) {
    const curr = rrIntervals[i];
    const prev = rrIntervals[i-1];
    
    if (Math.abs(curr - prev) > threshold) {
      arrhythmiaIndices.push(i);
    }
  }
  
  return arrhythmiaIndices;
}

/**
 * Calcula métricas adicionales de variabilidad de la frecuencia cardíaca
 * @param rrIntervals Serie de intervalos RR en milisegundos
 * @returns Métricas de variabilidad
 */
export function calculateHRVMetrics(rrIntervals: number[]): { 
  rmssd: number; 
  sdnn: number;
  pnn50: number;
} {
  if (rrIntervals.length < 2) {
    return { rmssd: 0, sdnn: 0, pnn50: 0 };
  }
  
  // Calcular RMSSD (Root Mean Square of Successive Differences)
  let sumSquaredDiffs = 0;
  let nn50Count = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i-1];
    sumSquaredDiffs += diff * diff;
    
    if (Math.abs(diff) > 50) {
      nn50Count++;
    }
  }
  
  const rmssd = Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1));
  
  // Calcular SDNN (Standard Deviation of NN intervals)
  const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const sumSquaredDeviations = rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const sdnn = Math.sqrt(sumSquaredDeviations / rrIntervals.length);
  
  // Calcular pNN50 (percentage of NN intervals > 50ms)
  const pnn50 = (nn50Count / (rrIntervals.length - 1)) * 100;
  
  return { rmssd, sdnn, pnn50 };
}
