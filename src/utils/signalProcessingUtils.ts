
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

/**
 * Utilidades centralizadas para procesamiento de señales PPG
 * Funciones comunes utilizadas por varios módulos
 */

/**
 * Aplica un filtro de media móvil a una señal
 * @param values Valores a filtrar
 * @param windowSize Tamaño de la ventana de filtrado
 * @returns Valor filtrado
 */
export const applyMovingAverageFilter = (values: number[], windowSize: number = 5): number => {
  if (values.length === 0) return 0;
  if (values.length < windowSize) {
    // Promedio simple si no hay suficientes valores
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  // Tomar últimos N valores para la ventana
  const windowValues = values.slice(-windowSize);
  return windowValues.reduce((a, b) => a + b, 0) / windowSize;
};

/**
 * Aplica un filtro ponderado que da más peso a los valores recientes
 * Útil para señales biomédicas donde los valores recientes son más relevantes
 * @param values Valores a filtrar
 * @param decayFactor Factor de decaimiento (0-1), mayor valor = más peso a valores recientes
 * @returns Valor filtrado
 */
export const applyWeightedFilter = (values: number[], decayFactor: number = 0.8): number => {
  if (values.length === 0) return 0;
  
  let weightedSum = 0;
  let weightSum = 0;
  
  for (let i = 0; i < values.length; i++) {
    // Índice invertido para dar más peso a valores recientes
    const reversedIndex = values.length - 1 - i;
    // Peso exponencial basado en la posición
    const weight = Math.pow(decayFactor, i);
    
    weightedSum += values[reversedIndex] * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
};

/**
 * Aplica filtro Kalman adaptativo avanzado para señales biomédicas
 * Implementa un modelo de filtro Kalman adaptativo que ajusta dinámicamente los parámetros
 * @param values Array de valores de señal
 * @param measurement Nuevo valor a filtrar
 * @param noiseVariance Varianza estimada del ruido (opcional, adaptativo)
 * @returns Valor filtrado
 */
export const applyAdaptiveKalmanFilter = (
  values: number[], 
  measurement: number,
  noiseVariance?: number
): number => {
  // Estado del filtro - utilizamos el último valor del filtro si existe
  const previousEstimate = values.length > 0 ? values[values.length - 1] : measurement;
  
  // Parámetros adaptativos del filtro Kalman
  const processVariance = 0.0015; // Varianza del proceso (menor = más estable)
  
  // Cálculo adaptativo de la varianza del ruido si no se proporciona
  const calculatedNoiseVariance = noiseVariance ?? calculateSignalVariance(values.slice(-10));
  const adaptiveNoiseVariance = Math.max(0.005, Math.min(0.15, calculatedNoiseVariance));
  
  // Variables para el filtro Kalman unidimensional
  let errorCovariance = Math.max(0.01, calculatedNoiseVariance);
  
  // Predicción
  const prediction = previousEstimate;
  errorCovariance = errorCovariance + processVariance;
  
  // Actualización
  const kalmanGain = errorCovariance / (errorCovariance + adaptiveNoiseVariance);
  const estimate = prediction + kalmanGain * (measurement - prediction);
  errorCovariance = (1 - kalmanGain) * errorCovariance;
  
  return estimate;
};

/**
 * Calcula la varianza de una señal para uso en filtros adaptativos
 * @param values Valores de la señal
 * @returns Varianza de la señal
 */
const calculateSignalVariance = (values: number[]): number => {
  if (values.length < 2) return 0.01; // Valor por defecto
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  
  return Math.max(0.001, Math.min(0.1, variance)); // Limitamos para estabilidad
};

/**
 * Calcula la calidad de una señal basada en su variabilidad y consistencia
 * @param values Valores de la señal
 * @returns Calidad de la señal (0-100)
 */
export const calculateSignalQuality = (values: number[]): number => {
  if (values.length < 10) return 0;
  
  // Calcular estadísticas básicas
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coeffVar = stdDev / Math.abs(mean);
  
  // Señal demasiado estable o demasiado variable
  if (coeffVar < 0.01 || coeffVar > 0.8) {
    return 20;
  }
  
  // Escala logarítmica para el coeficiente de variación
  // Máxima calidad alrededor de 0.2-0.3
  const qualityFactor = Math.max(0, Math.min(1, 1 - (Math.abs(0.2 - coeffVar) / 0.2)));
  
  return qualityFactor * 100;
};

/**
 * Implementa un filtro Savitzky-Golay para preservar características de picos
 * en señales biomédicas mientras elimina ruido
 * @param values Array de valores de señal
 * @param windowSize Tamaño de la ventana (impar)
 * @param polynomialOrder Orden del polinomio (1-5)
 * @returns Último valor filtrado
 */
export const applySavitzkyGolayFilter = (
  values: number[],
  windowSize: number = 9,
  polynomialOrder: number = 3
): number => {
  if (values.length < windowSize) {
    return values.length > 0 ? values[values.length - 1] : 0;
  }
  
  // Asegurar que windowSize es impar
  const actualWindowSize = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const halfWindow = Math.floor(actualWindowSize / 2);
  
  // Obtener segmento de la ventana
  const windowValues = values.slice(-actualWindowSize);
  
  // Coeficientes para filtro Savitzky-Golay (precalculados para eficiencia)
  // Los coeficientes dependen del tamaño de ventana y orden polinomial
  let coefficients: number[] = [];
  
  // Coeficientes comunes para tamaños de ventana y órdenes típicos
  if (actualWindowSize === 5 && polynomialOrder === 2) {
    coefficients = [-3, 12, 17, 12, -3];
    return (windowValues[0] * coefficients[0] + 
            windowValues[1] * coefficients[1] + 
            windowValues[2] * coefficients[2] + 
            windowValues[3] * coefficients[3] + 
            windowValues[4] * coefficients[4]) / 35;
  } else if (actualWindowSize === 7 && polynomialOrder === 2) {
    coefficients = [-2, 3, 6, 7, 6, 3, -2];
    return (windowValues[0] * coefficients[0] + 
            windowValues[1] * coefficients[1] + 
            windowValues[2] * coefficients[2] + 
            windowValues[3] * coefficients[3] + 
            windowValues[4] * coefficients[4] + 
            windowValues[5] * coefficients[5] + 
            windowValues[6] * coefficients[6]) / 21;
  } else if (actualWindowSize === 9 && polynomialOrder === 3) {
    coefficients = [-21, 14, 39, 54, 59, 54, 39, 14, -21];
    return (windowValues[0] * coefficients[0] + 
            windowValues[1] * coefficients[1] + 
            windowValues[2] * coefficients[2] + 
            windowValues[3] * coefficients[3] + 
            windowValues[4] * coefficients[4] + 
            windowValues[5] * coefficients[5] + 
            windowValues[6] * coefficients[6] + 
            windowValues[7] * coefficients[7] + 
            windowValues[8] * coefficients[8]) / 231;
  } else {
    // Para otros tamaños, volvemos a filtro de media móvil ponderada
    return applyWeightedFilter(windowValues, 0.75);
  }
};

/**
 * Detecta picos en una señal PPG usando técnicas avanzadas de procesamiento
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
 * Implementa transformada wavelet discreta simplificada para análisis de señal
 * Permite descomponer la señal en componentes de aproximación y detalle
 * @param signal Señal de entrada
 * @returns Coeficientes de aproximación y detalle
 */
export const discreteWaveletTransform = (
  signal: number[]
): { approx: number[], detail: number[] } => {
  if (signal.length < 2) return { approx: [...signal], detail: [] };
  
  const approx: number[] = [];
  const detail: number[] = [];
  
  // Filtros wavelet Haar (más simples)
  const h0 = 0.7071; // Coeficiente LPF (paso bajo)
  const h1 = 0.7071;
  const g0 = -0.7071; // Coeficiente HPF (paso alto)
  const g1 = 0.7071;
  
  // Aplicar filtros y submuestreo
  for (let i = 0; i < signal.length; i += 2) {
    if (i + 1 < signal.length) {
      const s0 = signal[i];
      const s1 = signal[i + 1];
      
      // Aproximación (filtrado de paso bajo)
      const a = (h0 * s0 + h1 * s1) / Math.sqrt(2);
      approx.push(a);
      
      // Detalle (filtrado de paso alto)
      const d = (g0 * s0 + g1 * s1) / Math.sqrt(2);
      detail.push(d);
    } else {
      // Caso de longitud impar
      approx.push(signal[i] * h0 / Math.sqrt(2));
      detail.push(signal[i] * g0 / Math.sqrt(2));
    }
  }
  
  return { approx, detail };
};

/**
 * Descompone señal en múltiples niveles usando wavelets
 * Útil para análisis multiescala y eliminación de ruido
 * @param signal Señal original
 * @param levels Número de niveles de descomposición
 * @returns Coeficientes de aproximación y detalles por nivel
 */
export const multiLevelWaveletDecomposition = (
  signal: number[],
  levels: number = 3
): { approx: number[], details: number[][] } => {
  let currentSignal = [...signal];
  const details: number[][] = [];
  
  for (let i = 0; i < levels && currentSignal.length > 1; i++) {
    const { approx, detail } = discreteWaveletTransform(currentSignal);
    details.push(detail);
    currentSignal = approx;
  }
  
  return { approx: currentSignal, details };
};

/**
 * Normaliza un valor a un rango específico
 * @param value Valor a normalizar
 * @param min Valor mínimo del rango
 * @param max Valor máximo del rango
 * @returns Valor normalizado (0-1)
 */
export const normalizeValue = (value: number, min: number, max: number): number => {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

/**
 * Extrae características avanzadas de la señal PPG para análisis fisiológico
 * @param values Valores de señal PPG
 * @returns Objeto con características extraídas
 */
export const extractPPGFeatures = (values: number[]): {
  systolicPeaks: number[];
  diastolicPeaks: number[];
  pulseAmplitude: number;
  pulseWidth: number[];
  meanPulseInterval: number;
} => {
  if (values.length < 20) {
    return {
      systolicPeaks: [],
      diastolicPeaks: [],
      pulseAmplitude: 0,
      pulseWidth: [],
      meanPulseInterval: 0,
    };
  }
  
  // Detectar picos sistólicos (principales)
  const systolicPeaks = detectPeaks(values, 8, 0.4);
  
  // Características derivadas
  const pulseAmplitude = systolicPeaks.length >= 2 ? 
    calculatePulseAmplitude(values, systolicPeaks) : 0;
  
  const pulseWidth = calculatePulseWidth(values, systolicPeaks);
  
  const diastolicPeaks = detectDiastolicPeaks(values, systolicPeaks);
  
  const intervals = calculatePeakIntervals(systolicPeaks);
  const meanPulseInterval = intervals.length > 0 ? 
    intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  
  return {
    systolicPeaks,
    diastolicPeaks,
    pulseAmplitude,
    pulseWidth,
    meanPulseInterval
  };
};

/**
 * Calcula los intervalos entre picos consecutivos
 * @param peakIndices Índices de los picos
 * @returns Array de intervalos
 */
const calculatePeakIntervals = (peakIndices: number[]): number[] => {
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    intervals.push(peakIndices[i] - peakIndices[i-1]);
  }
  return intervals;
};

/**
 * Calcula la amplitud del pulso PPG
 * @param values Valores de señal
 * @param peakIndices Índices de los picos
 * @returns Amplitud media del pulso
 */
const calculatePulseAmplitude = (values: number[], peakIndices: number[]): number => {
  if (peakIndices.length < 2) return 0;
  
  let totalAmplitude = 0;
  let count = 0;
  
  for (let i = 0; i < peakIndices.length - 1; i++) {
    const peakIndex = peakIndices[i];
    const nextPeakIndex = peakIndices[i + 1];
    
    // Encontrar mínimo entre estos picos
    let minValue = values[peakIndex];
    let minIndex = peakIndex;
    
    for (let j = peakIndex + 1; j < nextPeakIndex; j++) {
      if (values[j] < minValue) {
        minValue = values[j];
        minIndex = j;
      }
    }
    
    // Calcular amplitud solo si encontramos un mínimo real
    if (minIndex > peakIndex && minIndex < nextPeakIndex) {
      const amplitude = values[peakIndex] - minValue;
      totalAmplitude += amplitude;
      count++;
    }
  }
  
  return count > 0 ? totalAmplitude / count : 0;
};

/**
 * Calcula el ancho de pulso PPG (duración)
 * @param values Valores de señal
 * @param peakIndices Índices de los picos
 * @returns Array con duraciones de pulso
 */
const calculatePulseWidth = (values: number[], peakIndices: number[]): number[] => {
  const widths: number[] = [];
  
  if (peakIndices.length < 2) return widths;
  
  for (let i = 0; i < peakIndices.length - 1; i++) {
    const peakIndex = peakIndices[i];
    const nextPeakIndex = peakIndices[i + 1];
    
    // Calcular 50% de la amplitud como umbral
    const peakValue = values[peakIndex];
    const nextPeakValue = values[nextPeakIndex];
    const threshold = peakValue * 0.5;
    
    // Buscar hacia atrás
    let startIndex = peakIndex;
    while (startIndex > 0 && values[startIndex] > threshold) {
      startIndex--;
    }
    
    // Buscar hacia adelante
    let endIndex = peakIndex;
    while (endIndex < values.length - 1 && values[endIndex] > threshold) {
      endIndex++;
    }
    
    widths.push(endIndex - startIndex);
  }
  
  return widths;
};

/**
 * Detecta picos diastólicos en la señal PPG
 * @param values Valores de señal
 * @param systolicPeaks Índices de los picos sistólicos
 * @returns Índices de los picos diastólicos
 */
const detectDiastolicPeaks = (values: number[], systolicPeaks: number[]): number[] => {
  const diastolicPeaks: number[] = [];
  
  if (systolicPeaks.length < 2) return diastolicPeaks;
  
  for (let i = 0; i < systolicPeaks.length - 1; i++) {
    const startIdx = systolicPeaks[i];
    const endIdx = systolicPeaks[i + 1];
    
    // Buscar región de dicrtic notch (aproximadamente 30-50% de distancia)
    const startSearch = Math.floor(startIdx + (endIdx - startIdx) * 0.3);
    const endSearch = Math.floor(startIdx + (endIdx - startIdx) * 0.5);
    
    // Buscar máximo local en esta región
    let maxVal = -Infinity;
    let maxIdx = -1;
    
    for (let j = startSearch; j <= endSearch && j < values.length; j++) {
      if (values[j] > maxVal) {
        maxVal = values[j];
        maxIdx = j;
      }
    }
    
    if (maxIdx !== -1) {
      diastolicPeaks.push(maxIdx);
    }
  }
  
  return diastolicPeaks;
};

/**
 * Realiza análisis PCA simplificado para separación de componentes de señal
 * @param signals Array de señales (cada señal es un array de números)
 * @returns Componentes principales extraídos
 */
export const simplifiedPCA = (signals: number[][]): number[][] => {
  if (signals.length === 0 || signals[0].length === 0) return [];
  
  const numSamples = signals[0].length;
  const numSignals = signals.length;
  
  // Paso 1: Centrar los datos
  const means: number[] = [];
  const centeredSignals: number[][] = [];
  
  for (let i = 0; i < numSignals; i++) {
    const mean = signals[i].reduce((sum, val) => sum + val, 0) / numSamples;
    means.push(mean);
    centeredSignals.push(signals[i].map(val => val - mean));
  }
  
  // Paso 2: Calcular matriz de covarianza
  const covMatrix: number[][] = [];
  for (let i = 0; i < numSignals; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < numSignals; j++) {
      let cov = 0;
      for (let k = 0; k < numSamples; k++) {
        cov += centeredSignals[i][k] * centeredSignals[j][k];
      }
      covMatrix[i][j] = cov / (numSamples - 1);
    }
  }
  
  // Paso 3: Para simplicidad, solo extraemos el primer componente principal
  // En un PCA completo calcularíamos vectores propios, pero simplificamos
  const weights: number[] = [];
  for (let i = 0; i < numSignals; i++) {
    weights.push(Math.sqrt(covMatrix[i][i]));
  }
  
  // Normalizar pesos
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map(w => w / weightSum);
  
  // Paso 4: Proyectar datos en componentes
  const components: number[][] = [];
  const numComponents = Math.min(2, numSignals); // Extraemos hasta 2 componentes
  
  for (let c = 0; c < numComponents; c++) {
    components[c] = Array(numSamples).fill(0);
    
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numSignals; j++) {
        // Para primer componente usamos pesos, para segundo invertimos (ortogonal aproximado)
        const weight = c === 0 ? normalizedWeights[j] : (j % 2 === 0 ? 1 : -1) * normalizedWeights[j];
        components[c][i] += centeredSignals[j][i] * weight;
      }
    }
  }
  
  return components;
};
