
/**
 * Utilitarios para el procesamiento de señales PPG
 * ALGORITMOS REALISTAS - SIN SIMULACIÓN
 */

/**
 * Calcula el componente DC (nivel base) de una señal PPG
 * @param signal Array de valores PPG
 * @returns Componente DC (nivel promedio)
 */
export function calculateDC(signal: number[]): number {
  if (!signal || signal.length === 0) return 0;
  
  // Usar media recortada (más robusta que la media simple)
  const sortedValues = [...signal].sort((a, b) => a - b);
  const trimAmount = Math.floor(signal.length * 0.1); // Recortar 10% en cada extremo
  const trimmedValues = sortedValues.slice(trimAmount, signal.length - trimAmount);
  
  if (trimmedValues.length === 0) return sortedValues[Math.floor(signal.length / 2)]; // Mediana como fallback
  
  const sum = trimmedValues.reduce((acc, val) => acc + val, 0);
  return sum / trimmedValues.length;
}

/**
 * Calcula el componente AC (variación) de una señal PPG
 * @param signal Array de valores PPG
 * @returns Componente AC (amplitud de variación)
 */
export function calculateAC(signal: number[]): number {
  if (!signal || signal.length < 3) return 0;
  
  const dc = calculateDC(signal);
  
  // Varianza como medida de AC (estadísticamente más robusta)
  let sumSquaredDiffs = 0;
  let validPoints = 0;
  
  for (const value of signal) {
    // Omitir valores extremos que pueden ser artefactos
    if (Math.abs(value - dc) > 5 * calculateStdDev(signal)) continue;
    
    sumSquaredDiffs += Math.pow(value - dc, 2);
    validPoints++;
  }
  
  if (validPoints === 0) return 0;
  
  // Desviación estándar como medida de AC
  return Math.sqrt(sumSquaredDiffs / validPoints);
}

/**
 * Calcula la desviación estándar de una señal
 * @param signal Array de valores
 * @returns Desviación estándar
 */
export function calculateStdDev(signal: number[]): number {
  if (!signal || signal.length < 2) return 0;
  
  const mean = signal.reduce((acc, val) => acc + val, 0) / signal.length;
  const variance = signal.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / signal.length;
  
  return Math.sqrt(variance);
}

/**
 * Detecta picos en una señal PPG
 * @param signal Array de valores PPG
 * @param minDistance Distancia mínima entre picos (en índices)
 * @returns Índices de los picos detectados
 */
export function findPeaks(signal: number[], minDistance: number = 10): number[] {
  if (!signal || signal.length < 3) return [];
  
  const peaks: number[] = [];
  
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      // Es un pico local, revisar umbral
      const localThreshold = calculateLocalThreshold(signal, i, 10);
      
      if (signal[i] > localThreshold) {
        // Verificar distancia mínima con pico anterior
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
          // Reemplazar pico anterior si este es más alto
          peaks[peaks.length - 1] = i;
        }
      }
    }
  }
  
  return peaks;
}

/**
 * Calcula un umbral local adaptativo para detección de picos
 * @param signal Señal PPG
 * @param index Índice central
 * @param windowSize Tamaño de ventana
 * @returns Umbral calculado
 */
function calculateLocalThreshold(signal: number[], index: number, windowSize: number): number {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(signal.length - 1, index + windowSize);
  
  let sum = 0;
  let count = 0;
  
  for (let i = start; i <= end; i++) {
    sum += signal[i];
    count++;
  }
  
  const mean = sum / count;
  return mean * 1.2; // 20% por encima de la media local
}

/**
 * Calcula la frecuencia cardíaca a partir de picos en señal PPG
 * @param peakIndices Índices de los picos
 * @param sampleRate Frecuencia de muestreo (Hz)
 * @returns Frecuencia cardíaca (BPM)
 */
export function calculateHeartRate(peakIndices: number[], sampleRate: number = 30): number {
  if (!peakIndices || peakIndices.length < 2) return 0;
  
  // Calcular intervalos entre picos
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(peakIndices[i] - peakIndices[i - 1]);
  }
  
  // Usar mediana para robustez contra artefactos
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const medianInterval = sortedIntervals[Math.floor(intervals.length / 2)];
  
  // Convertir a BPM
  const intervalSeconds = medianInterval / sampleRate;
  const bpm = 60 / intervalSeconds;
  
  // Limitar a rango fisiológico
  return Math.max(40, Math.min(200, bpm));
}
