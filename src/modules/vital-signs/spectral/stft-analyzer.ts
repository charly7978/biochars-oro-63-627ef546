
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Short-Time Fourier Transform (STFT) analyzer
 * Implementa análisis espectral adaptativo para señales PPG
 * Solo utiliza datos reales, sin simulación
 */

/**
 * Resultado del análisis STFT
 */
export interface STFTResult {
  bpm: number;           // Frecuencia cardíaca estimada en latidos por minuto
  dominantFreq: number;  // Frecuencia dominante en Hz
  confidence: number;    // Confianza de la estimación (0-1)
  powerSpectrum: number[]; // Espectro de potencia para visualización
  frequencies: number[]; // Frecuencias correspondientes en Hz
}

/**
 * Realiza análisis STFT en una señal PPG para detectar la frecuencia cardíaca
 * @param signal Valores de PPG (datos reales)
 * @param sampleRate Frecuencia de muestreo en Hz
 * @param windowSizeSeconds Tamaño de ventana en segundos
 * @param overlapPercent Porcentaje de superposición entre ventanas
 * @returns Resultado del análisis con la frecuencia cardíaca estimada
 */
export function performSTFT(
  signal: number[], 
  sampleRate: number = 30,
  windowSizeSeconds: number = 6,
  overlapPercent: number = 50
): STFTResult {
  // Validar parámetros de entrada
  if (signal.length < sampleRate * 2) {
    return {
      bpm: 0,
      dominantFreq: 0,
      confidence: 0,
      powerSpectrum: [],
      frequencies: []
    };
  }
  
  // Calcular parámetros STFT
  const windowSize = Math.floor(sampleRate * windowSizeSeconds);
  const overlap = Math.floor(windowSize * (overlapPercent / 100));
  const hopSize = windowSize - overlap;
  
  // Preparar buffer de señal y normalizar
  const processedSignal = normalizeSignal(signal.slice(-windowSize));
  
  // Aplicar ventana para reducir fugas espectrales (ventana Hamming)
  const windowedSignal = applyHammingWindow(processedSignal);
  
  // Calcular FFT
  const fftResult = calculateFFT(windowedSignal);
  const magnitudes = calculateMagnitudes(fftResult.real, fftResult.imag);
  
  // Calcular frecuencias correspondientes
  const frequencies = calculateFrequencyBins(magnitudes.length, sampleRate);
  
  // Estimar frecuencia cardíaca en el rango fisiológico (0.5-4 Hz, o 30-240 BPM)
  const minFreqIdx = findClosestIndex(frequencies, 0.5);
  const maxFreqIdx = findClosestIndex(frequencies, 4.0);
  
  // Extraer la parte relevante del espectro
  const relevantSpectrum = magnitudes.slice(minFreqIdx, maxFreqIdx + 1);
  const relevantFreqs = frequencies.slice(minFreqIdx, maxFreqIdx + 1);
  
  // Encontrar picos espectrales
  const peaks = findSpectralPeaks(relevantSpectrum, 3);
  
  // Sin picos claros, no hay estimación confiable
  if (peaks.length === 0) {
    return {
      bpm: 0,
      dominantFreq: 0,
      confidence: 0,
      powerSpectrum: relevantSpectrum,
      frequencies: relevantFreqs
    };
  }
  
  // Ordenar picos por magnitud
  peaks.sort((a, b) => relevantSpectrum[b] - relevantSpectrum[a]);
  
  // Calcular frecuencia dominante y BPM
  const dominantPeakIdx = peaks[0];
  const dominantFreq = relevantFreqs[dominantPeakIdx];
  const bpm = Math.round(dominantFreq * 60);
  
  // Calcular confianza basada en claridad del pico
  const peakProminence = calculatePeakProminence(relevantSpectrum, dominantPeakIdx);
  const snr = calculateSpectralSNR(relevantSpectrum, dominantPeakIdx);
  const peakWidthScore = calculatePeakWidthScore(relevantSpectrum, dominantPeakIdx);
  
  // Combinar métricas para puntaje final de confianza
  const confidence = Math.min(1, (
    (peakProminence * 0.4) + 
    (snr * 0.4) + 
    (peakWidthScore * 0.2)
  ));
  
  return {
    bpm,
    dominantFreq,
    confidence,
    powerSpectrum: relevantSpectrum,
    frequencies: relevantFreqs
  };
}

/**
 * Normaliza la señal para análisis
 */
function normalizeSignal(signal: number[]): number[] {
  // Eliminar tendencia (detrend)
  const detrended = removeLinearTrend(signal);
  
  // Normalizar a media cero
  const mean = detrended.reduce((sum, val) => sum + val, 0) / detrended.length;
  const centered = detrended.map(v => v - mean);
  
  return centered;
}

/**
 * Elimina la tendencia lineal de la señal
 */
function removeLinearTrend(signal: number[]): number[] {
  const n = signal.length;
  if (n < 3) return [...signal];
  
  // Calcular parámetros de regresión lineal
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += signal[i];
    sumXY += i * signal[i];
    sumXX += i * i;
  }
  
  // Calcular pendiente e intercepto
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Restar la tendencia
  const detrended: number[] = [];
  for (let i = 0; i < n; i++) {
    detrended.push(signal[i] - (intercept + slope * i));
  }
  
  return detrended;
}

/**
 * Aplica una ventana Hamming para reducir fugas espectrales
 */
function applyHammingWindow(signal: number[]): number[] {
  const n = signal.length;
  const windowed: number[] = [];
  
  for (let i = 0; i < n; i++) {
    // Coeficiente de ventana Hamming
    const windowCoef = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1));
    windowed.push(signal[i] * windowCoef);
  }
  
  return windowed;
}

/**
 * Calcula la transformada de Fourier discreta (DFT)
 */
function calculateFFT(signal: number[]): { real: number[]; imag: number[] } {
  const n = signal.length;
  const real: number[] = [];
  const imag: number[] = [];
  
  // Rellenar con ceros hasta la siguiente potencia de 2 (para mayor eficiencia)
  const paddedSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const paddedSignal = [...signal];
  while (paddedSignal.length < paddedSize) {
    paddedSignal.push(0);
  }
  
  // Implementación básica de DFT (simplificada para señales cortas)
  const N = paddedSignal.length;
  
  // Solo calculamos la mitad del espectro (por simetría)
  for (let k = 0; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      re += paddedSignal[n] * Math.cos(angle);
      im += paddedSignal[n] * Math.sin(angle);
    }
    
    real.push(re);
    imag.push(im);
  }
  
  return { real, imag };
}

/**
 * Calcula magnitudes a partir de componentes real e imaginaria
 */
function calculateMagnitudes(real: number[], imag: number[]): number[] {
  const magnitudes: number[] = [];
  
  for (let i = 0; i < real.length; i++) {
    // Elevar al cuadrado para obtener potencia (más útil que magnitud lineal)
    magnitudes.push((real[i] * real[i] + imag[i] * imag[i]));
  }
  
  return magnitudes;
}

/**
 * Calcula las frecuencias correspondientes a cada bin FFT
 */
function calculateFrequencyBins(numBins: number, sampleRate: number): number[] {
  const freqStep = sampleRate / (numBins * 2);
  const frequencies: number[] = [];
  
  for (let i = 0; i < numBins; i++) {
    frequencies.push(i * freqStep);
  }
  
  return frequencies;
}

/**
 * Encuentra el índice más cercano a una frecuencia objetivo
 */
function findClosestIndex(frequencies: number[], targetFreq: number): number {
  let closestIdx = 0;
  let minDiff = Math.abs(frequencies[0] - targetFreq);
  
  for (let i = 1; i < frequencies.length; i++) {
    const diff = Math.abs(frequencies[i] - targetFreq);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  
  return closestIdx;
}

/**
 * Encuentra picos espectrales significativos
 */
function findSpectralPeaks(spectrum: number[], minDistance: number = 3): number[] {
  const peaks: number[] = [];
  
  for (let i = 1; i < spectrum.length - 1; i++) {
    if (spectrum[i] > spectrum[i-1] && spectrum[i] > spectrum[i+1]) {
      // Es un pico local
      let isPeak = true;
      
      // Verificar que sea mayor que los puntos cercanos
      for (let j = Math.max(0, i - minDistance); j <= Math.min(spectrum.length - 1, i + minDistance); j++) {
        if (j !== i && spectrum[j] > spectrum[i]) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
}

/**
 * Calcula la prominencia del pico (qué tanto sobresale)
 */
function calculatePeakProminence(spectrum: number[], peakIdx: number): number {
  if (peakIdx <= 0 || peakIdx >= spectrum.length - 1) {
    return 0;
  }
  
  const peakValue = spectrum[peakIdx];
  
  // Encontrar el valle más alto a la izquierda
  let leftVal = peakValue;
  for (let i = peakIdx - 1; i >= 0; i--) {
    if (spectrum[i] > leftVal) {
      break;
    }
    if (spectrum[i] < leftVal) {
      leftVal = spectrum[i];
    }
  }
  
  // Encontrar el valle más alto a la derecha
  let rightVal = peakValue;
  for (let i = peakIdx + 1; i < spectrum.length; i++) {
    if (spectrum[i] > rightVal) {
      break;
    }
    if (spectrum[i] < rightVal) {
      rightVal = spectrum[i];
    }
  }
  
  // La prominencia es la diferencia de altura entre el pico y el valle más alto
  const valleyHeight = Math.max(leftVal, rightVal);
  const prominence = peakValue - valleyHeight;
  
  // Normalizar a un valor entre 0-1
  const normalizedProminence = prominence / peakValue;
  
  return Math.min(1, normalizedProminence);
}

/**
 * Calcula la relación señal/ruido espectral
 */
function calculateSpectralSNR(spectrum: number[], peakIdx: number): number {
  if (peakIdx < 0 || peakIdx >= spectrum.length) {
    return 0;
  }
  
  const peakValue = spectrum[peakIdx];
  
  // Calcular "ruido" como el promedio del espectro excluyendo el pico y sus vecinos
  let noiseSum = 0;
  let noiseCount = 0;
  
  for (let i = 0; i < spectrum.length; i++) {
    if (Math.abs(i - peakIdx) > 2) { // Excluir el pico y los dos puntos adyacentes
      noiseSum += spectrum[i];
      noiseCount++;
    }
  }
  
  if (noiseCount === 0) return 0;
  
  const noiseAvg = noiseSum / noiseCount;
  const snr = peakValue / (noiseAvg + 0.0001); // Evitar división por cero
  
  // Normalizar a un valor entre 0-1
  return Math.min(1, snr / 10); // SNR de 10 o más se considera óptimo (1.0)
}

/**
 * Evalúa la calidad del pico basada en su ancho
 */
function calculatePeakWidthScore(spectrum: number[], peakIdx: number): number {
  if (peakIdx <= 0 || peakIdx >= spectrum.length - 1) {
    return 0;
  }
  
  const peakValue = spectrum[peakIdx];
  const halfHeight = peakValue / 2;
  
  // Encontrar índice izquierdo a media altura
  let leftIdx = peakIdx;
  while (leftIdx > 0 && spectrum[leftIdx] > halfHeight) {
    leftIdx--;
  }
  
  // Encontrar índice derecho a media altura
  let rightIdx = peakIdx;
  while (rightIdx < spectrum.length - 1 && spectrum[rightIdx] > halfHeight) {
    rightIdx++;
  }
  
  // Calcular ancho
  const width = rightIdx - leftIdx;
  
  // Los picos muy anchos o muy estrechos son menos confiables
  // El ancho óptimo depende de la resolución espectral
  const optimalWidth = 3;
  const widthScore = Math.exp(-Math.pow(width - optimalWidth, 2) / 8);
  
  return widthScore;
}
