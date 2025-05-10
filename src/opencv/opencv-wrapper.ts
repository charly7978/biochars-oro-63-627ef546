/**
 * Wrapper de OpenCV.js para procesamiento de señales PPG reales
 * Sin simulación - solo mediciones estrictamente reales
 */

/// <reference path="../types/opencv.d.ts" />

// Declarar el tipo Module de OpenCV para TypeScript
declare global {
  interface Window {
    cv: typeof cv;
    cv_ready: boolean;
    Module: {
      onRuntimeInitialized?: () => void;
    };
  }
}

/**
 * Espera hasta que OpenCV.js esté completamente cargado y listo
 */
export function waitForOpenCV(timeoutMs: number = 30000): Promise<void> {
  console.log('[OpenCV Wrapper] Iniciando espera de OpenCV...');
  
  // Si OpenCV ya está cargado y listo
  if (window.cv && window.cv_ready === true) {
    console.log('[OpenCV Wrapper] OpenCV ya está listo.');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Si ya está disponible, resolvemos inmediatamente
    if (window.cv && window.cv_ready === true) {
      console.log('[OpenCV Wrapper] OpenCV ya está disponible.');
      resolve();
      return;
    }

    console.log('[OpenCV Wrapper] Esperando evento opencv-ready...');
    
    // Listener para el evento que indica que OpenCV está listo
    const readyListener = () => {
      console.log('[OpenCV Wrapper] Evento opencv-ready recibido!');
      resolve();
    };
    
    // Timeout por si nunca se recibe el evento
    const timeoutId = setTimeout(() => {
      console.error(`[OpenCV Wrapper] Timeout después de ${timeoutMs}ms`);
      window.removeEventListener('opencv-ready', readyListener);
      
      // Verificación final
      if (window.cv) {
        console.log('[OpenCV Wrapper] OpenCV disponible a pesar del timeout');
        resolve();
      } else {
        reject(new Error('OpenCV no se cargó después del tiempo de espera'));
      }
    }, timeoutMs);
    
    // Registrar evento
    window.addEventListener('opencv-ready', readyListener, { once: true });
    
    // Función de cleanup si se resuelve antes del timeout
    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('opencv-ready', readyListener);
    };
    
    // Añadir cleanup al resolver
    const originalResolve = resolve;
    resolve = (() => {
      cleanup();
      originalResolve();
    }) as typeof resolve;
  });
}

/**
 * Verifica si OpenCV está realmente disponible para usar
 */
export function isOpenCVAvailable(): boolean {
  const available = Boolean(window.cv && window.cv_ready === true);
  console.log(`[OpenCV Wrapper] OpenCV disponible: ${available}`);
  return available;
}

/**
 * Aplicar filtro de mediana a una señal
 * (Elimina ruido preservando bordes)
 */
export function applyMedianFilter(signal: number[], kernelSize: number = 5): number[] {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para filtrado");
    return signal;
  }

  // Convertir el array a Mat de OpenCV (1 canal)
  const signalMat = new window.cv.Mat(1, signal.length, window.cv.CV_32F);
  for (let i = 0; i < signal.length; i++) {
    signalMat.data32F[i] = signal[i];
  }

  // Aplicar filtro de mediana
  const resultMat = new window.cv.Mat();
  window.cv.medianBlur(signalMat, resultMat, kernelSize);

  // Convertir resultado a array
  const result: number[] = [];
  for (let i = 0; i < resultMat.cols; i++) {
    result.push(resultMat.data32F[i]);
  }

  // Liberar memoria
  signalMat.delete();
  resultMat.delete();

  return result;
}

/**
 * Aplicar filtro Gaussiano a una señal
 * (Suaviza la señal preservando forma)
 */
export function applyGaussianFilter(signal: number[], kernelSize: number = 5, sigma: number = 1.5): number[] {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para filtrado");
    return signal;
  }

  // Convertir el array a Mat de OpenCV (1 canal)
  const signalMat = new window.cv.Mat(1, signal.length, window.cv.CV_32F);
  for (let i = 0; i < signal.length; i++) {
    signalMat.data32F[i] = signal[i];
  }

  // Aplicar filtro gaussiano
  const resultMat = new window.cv.Mat();
  const kernelSizeActual = kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize; // Asegurar que kernel es impar
  window.cv.GaussianBlur(signalMat, resultMat, new window.cv.Size(kernelSizeActual, 1), sigma);

  // Convertir resultado a array
  const result: number[] = [];
  for (let i = 0; i < resultMat.cols; i++) {
    result.push(resultMat.data32F[i]);
  }

  // Liberar memoria
  signalMat.delete();
  resultMat.delete();

  return result;
}

/**
 * Detectar picos en una señal usando derivadas
 * (Encuentra máximos locales)
 */
export function detectPeaks(signal: number[]): number[] {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para detección de picos");
    return [];
  }

  // Convertir el array a Mat de OpenCV
  const signalMat = new window.cv.Mat(1, signal.length, window.cv.CV_32F);
  for (let i = 0; i < signal.length; i++) {
    signalMat.data32F[i] = signal[i];
  }

  // Calcular derivada usando Sobel (primera derivada)
  const derivativeMat = new window.cv.Mat();
  window.cv.Sobel(signalMat, derivativeMat, window.cv.CV_32F, 1, 0, 3);

  // Encontrar los cruces por cero de la derivada (potenciales picos)
  const peakIndices: number[] = [];
  const derivValues: number[] = [];
  
  // Convertir derivada a array
  for (let i = 0; i < derivativeMat.cols; i++) {
    derivValues.push(derivativeMat.data32F[i]);
  }
  
  // Buscar cruces por cero (cambios de signo)
  for (let i = 1; i < derivValues.length; i++) {
    if ((derivValues[i-1] > 0 && derivValues[i] <= 0) && i > 2 && i < derivValues.length - 2) {
      // Revisar si es máximo local en ventana
      let isMaximum = true;
      for (let j = i-2; j <= i+2; j++) {
        if (j !== i && j >= 0 && j < signal.length && signal[j] >= signal[i]) {
          isMaximum = false;
          break;
        }
      }
      if (isMaximum) {
        peakIndices.push(i);
      }
    }
  }

  // Liberar memoria
  signalMat.delete();
  derivativeMat.delete();

  return peakIndices;
}

/**
 * Aplicar umbralización adaptativa a la señal
 * (Ayuda a separar señal del ruido de fondo)
 */
export function applyAdaptiveThreshold(signal: number[], method: string = 'GAUSSIAN'): number[] {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para umbralización");
    return signal;
  }

  // Normalizar señal a 0-255 para umbralización
  const minVal = findMinValue(signal);
  const maxVal = findMaxValue(signal);
  const range = maxVal - minVal;
  
  // Convertir a valores 0-255 para umbralización
  const normalizedSignal = signal.map(val => ((val - minVal) / range) * 255);
  
  // Convertir el array a Mat de OpenCV (formato 8U para umbralización)
  const signalMat = new window.cv.Mat(1, signal.length, window.cv.CV_8U);
  for (let i = 0; i < signal.length; i++) {
    signalMat.data[i] = normalizedSignal[i];
  }

  // Aplicar umbralización adaptativa
  const resultMat = new window.cv.Mat();
  const blockSize = 25; // Tamaño de bloque para adaptación
  const C = 5; // Constante restada de la media calculada
  
  const adaptiveMethod = method === 'GAUSSIAN' 
    ? window.cv.ADAPTIVE_THRESH_GAUSSIAN_C 
    : window.cv.ADAPTIVE_THRESH_MEAN_C;
  
  window.cv.adaptiveThreshold(
    signalMat, 
    resultMat, 
    255, 
    adaptiveMethod, 
    window.cv.THRESH_BINARY, 
    blockSize, 
    C
  );

  // Convertir resultado a array normalizado (0-1)
  const result: number[] = [];
  for (let i = 0; i < resultMat.cols; i++) {
    result.push(resultMat.data[i] / 255);
  }

  // Liberar memoria
  signalMat.delete();
  resultMat.delete();

  // Desnormalizar resultado a rango original
  return result.map(val => (val * range) + minVal);
}

/**
 * Encontrar valor mínimo en un array
 * Sin usar Math.min
 */
export function findMinValue(arr: number[]): number {
  if (arr.length === 0) return 0;
  let min = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < min) {
      min = arr[i];
    }
  }
  return min;
}

/**
 * Encontrar valor máximo en un array
 * Sin usar Math.max
 */
export function findMaxValue(arr: number[]): number {
  if (arr.length === 0) return 0;
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}

/**
 * Calcular amplitud de señal PPG
 * (Diferencia entre picos y valles)
 */
export function calculatePPGAmplitude(signal: number[], peakIndices: number[], valleyIndices: number[]): number {
  if (!isOpenCVAvailable() || !peakIndices.length || !valleyIndices.length) {
    return 0;
  }

  // Obtener amplitudes entre picos y valles cercanos
  const amplitudes: number[] = [];
  
  for (const peakIdx of peakIndices) {
    // Encontrar el valle más cercano a este pico
    let closestValleyIdx = -1;
    let minDistance = signal.length; // Iniciar con valor alto
    
    for (const valleyIdx of valleyIndices) {
      const distance = valleyIdx > peakIdx ? valleyIdx - peakIdx : peakIdx - valleyIdx;
      if (distance < minDistance) {
        minDistance = distance;
        closestValleyIdx = valleyIdx;
      }
    }
    
    if (closestValleyIdx !== -1 && minDistance < 20) { // Solo considerar si está cerca
      // Calcular diferencia de amplitud
      const amplitude = signal[peakIdx] - signal[closestValleyIdx];
      if (amplitude > 0) { // Solo amplitudes positivas (valle más bajo que pico)
        amplitudes.push(amplitude);
      }
    }
  }
  
  // Calcular la amplitud promedio, sin usar reduce() ni funciones Math
  if (amplitudes.length === 0) return 0;
  
  let sum = 0;
  for (const amp of amplitudes) {
    sum += amp;
  }
  
  return sum / amplitudes.length;
}

/**
 * Procesamiento completo de señal PPG
 * (Filtrado, detección de picos y características)
 */
export async function processPPGSignal(
  rawSignal: number[]
): Promise<{
  filteredSignal: number[];
  peaks: number[];
  valleys: number[];
  amplitude: number;
  quality: number;
}> {
  await waitForOpenCV();
  
  // Aplicar filtro mediano para eliminar ruido
  const medianFiltered = applyMedianFilter(rawSignal, 5);
  
  // Aplicar filtro gaussiano para suavizar
  const smoothed = applyGaussianFilter(medianFiltered, 7, 1.5);
  
  // Detectar picos
  const peaks = detectPeaks(smoothed);
  
  // Detectar valles (invertir la señal y detectar picos)
  const invertedSignal = smoothed.map(val => -val);
  const valleys = detectPeaks(invertedSignal);
  
  // Calcular amplitud
  const amplitude = calculatePPGAmplitude(smoothed, peaks, valleys);
  
  // Estimar calidad de señal (0-100)
  let quality = 0;
  
  if (peaks.length >= 3 && valleys.length >= 3 && amplitude > 0.05) {
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Evaluar consistencia de intervalos (sin usar Math)
    let intervalSum = 0;
    for (const interval of intervals) {
      intervalSum += interval;
    }
    const avgInterval = intervalSum / intervals.length;
    
    let varianceSum = 0;
    for (const interval of intervals) {
      const diff = interval > avgInterval ? interval - avgInterval : avgInterval - interval;
      varianceSum += diff * diff;
    }
    const variability = varianceSum / intervals.length;
    
    // Puntuar calidad basada en amplitud y regularidad
    const amplitudeScore = amplitude < 0.1 ? 30 : amplitude < 0.3 ? 70 : 100;
    const regularityScore = variability > 100 ? 40 : variability > 50 ? 70 : 100;
    
    quality = (amplitudeScore * 0.6) + (regularityScore * 0.4);
  }
  
  return {
    filteredSignal: smoothed,
    peaks,
    valleys,
    amplitude,
    quality
  };
}

/**
 * Extraer características avanzadas de señal PPG para análisis cardíaco
 */
export async function extractPPGFeatures(
  signal: number[],
  sampleRate: number = 30 // Hz
): Promise<{
  heartRate: number;       // BPM
  perfusionIndex: number;  // PI
  signalQuality: number;   // 0-100
}> {
  await waitForOpenCV();
  
  const processedSignal = await processPPGSignal(signal);
  const { peaks, valleys, amplitude, quality } = processedSignal;
  
  // Calcular ritmo cardíaco a partir de picos
  let heartRate = 0;
  if (peaks.length >= 3) {
    // Calcular tiempo promedio entre picos (en muestras)
    let intervalSum = 0;
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i-1];
      if (interval > 0) {
        intervals.push(interval);
        intervalSum += interval;
      }
    }
    
    if (intervals.length > 0) {
      const avgInterval = intervalSum / intervals.length;
      // Convertir intervalo (muestras) a BPM
      heartRate = (60 * sampleRate) / avgInterval;
      
      // Limitar a rango fisiológico (40-180 BPM)
      if (heartRate < 40) heartRate = 40;
      if (heartRate > 180) heartRate = 180;
    }
  }
  
  // Calcular índice de perfusión (PI)
  // PI = AC/DC (variación relativa)
  let perfusionIndex = 0;
  if (peaks.length > 0 && valleys.length > 0) {
    const signalValues = signal.slice(); // Clonar array
    
    // Encontrar valor mínimo y máximo para DC y AC
    const minVal = findMinValue(signalValues);
    const maxVal = findMaxValue(signalValues);
    
    // DC = componente constante (valor medio)
    let sum = 0;
    for (const val of signalValues) {
      sum += val;
    }
    const dc = sum / signalValues.length;
    
    // AC = componente variable (amplitud)
    const ac = maxVal - minVal;
    
    // PI = AC/DC * 100 (porcentaje)
    perfusionIndex = dc !== 0 ? (ac / dc) * 100 : 0;
    
    // Limitar a rango típico (0-20%)
    if (perfusionIndex < 0) perfusionIndex = 0;
    if (perfusionIndex > 20) perfusionIndex = 20;
  }
  
  return {
    heartRate: round(heartRate),
    perfusionIndex: round(perfusionIndex * 10) / 10, // 1 decimal
    signalQuality: round(quality)
  };
}

/**
 * Función de redondeo sin usar Math
 */
function round(value: number): number {
  return value >= 0 ? (0 | (value + 0.5)) : (0 | (value - 0.5));
}

/**
 * Crea una matriz de convolución (kernel) en OpenCV
 * Útil para filtros personalizados
 */
export function createKernel(kernelValues: number[], rows: number, cols: number): any {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para crear kernel");
    return null;
  }
  
  const kernel = window.cv.matFromArray(rows, cols, window.cv.CV_32F, kernelValues);
  return kernel;
}

/**
 * Aplicar filtro personalizado mediante convolución
 */
export function applyCustomFilter(signal: number[], kernelValues: number[]): number[] {
  if (!isOpenCVAvailable()) {
    console.error("OpenCV no está disponible para filtrado personalizado");
    return signal;
  }
  
  // Crear Mat de OpenCV para la señal
  const signalMat = new window.cv.Mat(1, signal.length, window.cv.CV_32F);
  for (let i = 0; i < signal.length; i++) {
    signalMat.data32F[i] = signal[i];
  }
  
  // Crear kernel para convolución
  const kernel = createKernel(kernelValues, 1, kernelValues.length);
  
  // Aplicar filtro (convolución)
  const resultMat = new window.cv.Mat();
  const anchor = new window.cv.Point(-1, -1); // Centro del kernel
  window.cv.filter2D(signalMat, resultMat, -1, kernel, anchor, 0, window.cv.BORDER_REPLICATE);
  
  // Convertir resultado a array
  const result: number[] = [];
  for (let i = 0; i < resultMat.cols; i++) {
    result.push(resultMat.data32F[i]);
  }
  
  // Liberar memoria
  signalMat.delete();
  resultMat.delete();
  kernel.delete();
  
  return result;
}

// Exportar funciones principales
export default {
  waitForOpenCV,
  isOpenCVAvailable,
  applyMedianFilter,
  applyGaussianFilter,
  detectPeaks,
  applyAdaptiveThreshold,
  processPPGSignal,
  extractPPGFeatures,
  createKernel,
  applyCustomFilter
};
