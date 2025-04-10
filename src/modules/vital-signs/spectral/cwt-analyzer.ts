
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Continuous Wavelet Transform (CWT) analyzer
 * Implementa análisis wavelet adaptativo para señales PPG
 * Solo utiliza datos reales, sin simulación
 */

/**
 * Resultado del análisis CWT
 */
export interface CWTResult {
  bpm: number;           // Frecuencia cardíaca estimada en latidos por minuto
  dominantFreq: number;  // Frecuencia dominante en Hz
  confidence: number;    // Confianza de la estimación (0-1)
  scalogram: number[][];  // Escalograma para visualización (opcional)
  scales: number[];      // Escalas utilizadas
}

/**
 * Realiza análisis CWT en una señal PPG para detectar la frecuencia cardíaca
 * @param signal Valores de PPG (datos reales)
 * @param sampleRate Frecuencia de muestreo en Hz
 * @param windowSizeSeconds Tamaño de ventana en segundos
 * @returns Resultado del análisis con la frecuencia cardíaca estimada
 */
export function performCWT(
  signal: number[], 
  sampleRate: number = 30,
  windowSizeSeconds: number = 6
): CWTResult {
  // Validar parámetros de entrada
  if (signal.length < sampleRate * 2) {
    return {
      bpm: 0,
      dominantFreq: 0,
      confidence: 0,
      scalogram: [],
      scales: []
    };
  }
  
  // Preparar buffer de señal
  const windowSize = Math.floor(sampleRate * windowSizeSeconds);
  const processedSignal = preprocessSignal(signal.slice(-windowSize));
  
  // Definir escalas para el análisis wavelet
  // Cubrimos un rango que corresponde a 30-240 BPM (0.5-4 Hz)
  const minScale = Math.ceil(sampleRate / 8); // 4 Hz máximo (240 BPM)
  const maxScale = Math.floor(sampleRate / 0.4); // 0.4 Hz mínimo (24 BPM, para tener margen)
  
  // Generar escalas logarítmicamente espaciadas
  const numScales = 20;
  const scales: number[] = [];
  for (let i = 0; i < numScales; i++) {
    const scale = minScale * Math.exp(i * Math.log(maxScale / minScale) / (numScales - 1));
    scales.push(Math.round(scale));
  }
  
  // Calcular CWT con wavelet Morlet (buena localización tiempo-frecuencia)
  const cwt = calculateMorletCWT(processedSignal, scales);
  
  // Para cada escala, calcular su potencia promedio
  const scalePowers: number[] = [];
  for (let i = 0; i < scales.length; i++) {
    const coeffs = cwt[i];
    // Usar magnitud al cuadrado promedio como potencia
    const power = coeffs.reduce((sum, val) => sum + val * val, 0) / coeffs.length;
    scalePowers.push(power);
  }
  
  // Encontrar escala de máxima potencia
  let maxPowerIdx = 0;
  let maxPower = scalePowers[0];
  
  for (let i = 1; i < scalePowers.length; i++) {
    if (scalePowers[i] > maxPower) {
      maxPower = scalePowers[i];
      maxPowerIdx = i;
    }
  }
  
  // Convertir escala a frecuencia
  // Para wavelet Morlet, la relación entre escala y frecuencia es aproximadamente:
  // freq = centralFreq / (scale * dt), donde centralFreq es la frecuencia central del wavelet
  const centralFreq = 0.849; // Valor para Morlet con omega0=6
  const dt = 1 / sampleRate;
  const dominantFreq = centralFreq / (scales[maxPowerIdx] * dt);
  
  // Convertir a BPM
  const bpm = Math.round(dominantFreq * 60);
  
  // Calcular confianza basada en nitidez del pico y relación señal-ruido
  const peakProminence = calculateWaveletPeakProminence(scalePowers, maxPowerIdx);
  const snr = calculateWaveletSNR(scalePowers, maxPowerIdx);
  const timeConsistency = calculateTimeConsistency(cwt[maxPowerIdx]);
  
  // Combinar métricas para confianza
  const confidence = Math.min(1, (
    (peakProminence * 0.4) + 
    (snr * 0.4) + 
    (timeConsistency * 0.2)
  ));
  
  return {
    bpm,
    dominantFreq,
    confidence,
    scalogram: cwt,
    scales
  };
}

/**
 * Preprocesa la señal para análisis wavelet
 */
function preprocessSignal(signal: number[]): number[] {
  // Normalizar a media cero
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const centered = signal.map(v => v - mean);
  
  // Filtrar tendencias de baja frecuencia (detrending)
  return removePolynomialTrend(centered, 3); // Polinomio de orden 3
}

/**
 * Elimina tendencia polinomial de la señal
 */
function removePolynomialTrend(signal: number[], order: number): number[] {
  const n = signal.length;
  if (n <= order) return [...signal];
  
  // Matriz de diseño para regresión polinomial
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= order; j++) {
      row.push(Math.pow(i, j));
    }
    X.push(row);
  }
  
  // Resolver sistema de ecuaciones para coeficientes polinomiales
  // Usar un método simplificado de mínimos cuadrados para polinomios de bajo orden
  const coefs = solvePolynomialCoefficients(X, signal, order);
  
  // Construir polinomio y restarlo de la señal
  const detrended: number[] = [];
  for (let i = 0; i < n; i++) {
    let trendValue = 0;
    for (let j = 0; j <= order; j++) {
      trendValue += coefs[j] * Math.pow(i, j);
    }
    detrended.push(signal[i] - trendValue);
  }
  
  return detrended;
}

/**
 * Resuelve coeficientes polinomiales mediante mínimos cuadrados
 * Versión simplificada para polinomios de bajo orden
 */
function solvePolynomialCoefficients(X: number[][], y: number[], order: number): number[] {
  // Factores de normalización para mejor condicionamiento numérico
  const normFactors: number[] = [];
  for (let j = 0; j <= order; j++) {
    let max = 0;
    for (let i = 0; i < X.length; i++) {
      max = Math.max(max, Math.abs(X[i][j]));
    }
    normFactors.push(max || 1);
  }
  
  // Normalizar matriz de diseño
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j <= order; j++) {
      X[i][j] /= normFactors[j];
    }
  }
  
  // Resolver sistema normalizado usando pseudoinversa aproximada
  const coefs = new Array(order + 1).fill(0);
  
  // Para cada coeficiente
  for (let j = 0; j <= order; j++) {
    let num = 0;
    let den = 0;
    
    for (let i = 0; i < X.length; i++) {
      num += y[i] * X[i][j];
      den += X[i][j] * X[i][j];
    }
    
    coefs[j] = num / (den || 1);
  }
  
  // Desnormalizar coeficientes
  for (let j = 0; j <= order; j++) {
    coefs[j] /= normFactors[j];
  }
  
  return coefs;
}

/**
 * Calcula la transformada wavelet continua con wavelet Morlet
 */
function calculateMorletCWT(signal: number[], scales: number[]): number[][] {
  const n = signal.length;
  const cwt: number[][] = [];
  
  // Parámetro omega0 de Morlet (equilibrio entre localización tiempo-frecuencia)
  const omega0 = 6;
  
  // Calcular CWT para cada escala
  for (const scale of scales) {
    const coeffs: number[] = [];
    
    // Para cada punto de tiempo
    for (let t = 0; t < n; t++) {
      let sum = 0;
      
      // Calcular convolución con wavelet
      for (let k = 0; k < n; k++) {
        const dt = k - t;
        
        // Wavelet Morlet con soporte finito (aproximado)
        if (Math.abs(dt) <= 4 * scale) {
          const arg = dt / scale;
          // Parte real del wavelet Morlet (aproximación)
          const wavelet = Math.exp(-0.5 * arg * arg) * Math.cos(omega0 * arg);
          sum += signal[k] * wavelet;
        }
      }
      
      // Normalización para preservar energía entre escalas
      coeffs.push(sum / Math.sqrt(scale));
    }
    
    cwt.push(coeffs);
  }
  
  return cwt;
}

/**
 * Calcula la prominencia del pico en el dominio de escalas
 */
function calculateWaveletPeakProminence(powers: number[], peakIdx: number): number {
  if (peakIdx <= 0 || peakIdx >= powers.length - 1) {
    return 0;
  }
  
  const peakValue = powers[peakIdx];
  
  // Encontrar el valle más alto a la izquierda
  let leftVal = peakValue;
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (powers[i] > leftVal) {
      break;
    }
    if (powers[i] < leftVal) {
      leftVal = powers[i];
    }
  }
  
  // Encontrar el valle más alto a la derecha
  let rightVal = peakValue;
  for (let i = peakIdx + 1; i < powers.length; i++) {
    if (powers[i] > rightVal) {
      break;
    }
    if (powers[i] < rightVal) {
      rightVal = powers[i];
    }
  }
  
  // La prominencia es la diferencia de altura entre el pico y el valle más alto
  const valleyHeight = Math.max(leftVal, rightVal);
  const prominence = peakValue - valleyHeight;
  
  // Normalizar a un valor entre 0-1
  return Math.min(1, prominence / peakValue);
}

/**
 * Calcula la relación señal/ruido para análisis wavelet
 */
function calculateWaveletSNR(powers: number[], peakIdx: number): number {
  if (peakIdx < 0 || peakIdx >= powers.length) {
    return 0;
  }
  
  const peakValue = powers[peakIdx];
  
  // Calcular "ruido" como el promedio excluyendo el pico y sus vecinos
  let noiseSum = 0;
  let noiseCount = 0;
  
  for (let i = 0; i < powers.length; i++) {
    if (Math.abs(i - peakIdx) > 2) { // Excluir el pico y los dos puntos adyacentes
      noiseSum += powers[i];
      noiseCount++;
    }
  }
  
  if (noiseCount === 0) return 0;
  
  const noiseAvg = noiseSum / noiseCount;
  const snr = peakValue / (noiseAvg + 0.0001); // Evitar división por cero
  
  // Normalizar a un valor entre 0-1
  return Math.min(1, snr / 8); // SNR de 8 o más se considera óptimo (1.0)
}

/**
 * Evalúa la consistencia temporal de los coeficientes wavelet
 */
function calculateTimeConsistency(coeffs: number[]): number {
  if (coeffs.length < 10) {
    return 0;
  }
  
  // Calcular autocorrelación para detectar periodicidad
  const autocorr = calculateAutocorrelation(coeffs);
  
  // Encontrar picos en la autocorrelación
  const peaks: number[] = [];
  for (let i = 1; i < autocorr.length - 1; i++) {
    if (autocorr[i] > autocorr[i-1] && autocorr[i] > autocorr[i+1] && autocorr[i] > 0.2) {
      peaks.push(i);
    }
  }
  
  if (peaks.length < 2) {
    return 0.3; // Valor bajo por defecto
  }
  
  // Verificar regularidad de los picos (debería ser periódica)
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Calcular variabilidad
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
  const relativeStd = Math.sqrt(variance) / mean;
  
  // Menor variabilidad = mayor consistencia temporal
  const consistencyScore = Math.max(0, 1 - relativeStd);
  
  return consistencyScore;
}

/**
 * Calcula la autocorrelación de una señal
 */
function calculateAutocorrelation(signal: number[]): number[] {
  const n = signal.length;
  const mean = signal.reduce((sum, val) => sum + val, 0) / n;
  const centered = signal.map(v => v - mean);
  
  const result: number[] = [];
  const maxLag = Math.min(n, 100); // Limitar a 100 lags para eficiencia
  
  for (let lag = 0; lag < maxLag; lag++) {
    let sum = 0;
    let norm = 0;
    
    for (let i = 0; i < n - lag; i++) {
      sum += centered[i] * centered[i + lag];
      norm += centered[i] * centered[i] + centered[i + lag] * centered[i + lag];
    }
    
    // Normalizar (coeficiente de correlación)
    result.push(sum / (Math.sqrt(norm / 2) || 1));
  }
  
  return result;
}
