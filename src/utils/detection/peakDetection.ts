
/**
 * Utilities for peak and valley detection in PPG signals
 */

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
 * Localiza picos y valles en una señal PPG con un método de ventana deslizante
 * @param values Valores de la señal
 * @returns Objecto con índices de picos y valles
 */
export const findPeaksAndValleys = (values: number[]) => {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
};

/**
 * Calcula la amplitud promedio entre picos y valles en una señal PPG
 * @param values Valores de la señal
 * @param peaks Índices de los picos
 * @param valleys Índices de los valles
 * @returns Amplitud promedio
 */
export const calculateAmplitude = (
  values: number[],
  peaks: number[],
  valleys: number[]
): number => {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  if (amps.length === 0) return 0;

  const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
  return mean;
};
