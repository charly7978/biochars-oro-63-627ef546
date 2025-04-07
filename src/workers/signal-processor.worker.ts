
/**
 * WebWorker para procesamiento paralelo de señales PPG
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 */

import { calculateAC, calculateDC } from '../utils/vitalSignsUtils';

// Definiciones de mensajes para el worker
type WorkerMessage = {
  type: 'process-signal' | 'filter-data' | 'wavelet-transform' | 'init' | 'reset';
  data?: any;
};

// Búferes preasignados para reducir la creación de objetos
let filterBuffer: Float32Array | null = null;
let signalBuffer: Float32Array | null = null;
let resultBuffer: Float32Array | null = null;

// Procesamiento de señal en paralelo
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      // Inicializar búferes preasignados
      const { bufferSizes } = data;
      filterBuffer = new Float32Array(bufferSizes.filter || 32);
      signalBuffer = new Float32Array(bufferSizes.signal || 256);
      resultBuffer = new Float32Array(bufferSizes.result || 256);
      self.postMessage({ type: 'initialized' });
      break;
      
    case 'process-signal':
      // Procesar la señal PPG en paralelo
      const result = processSignalParallel(data.signal, data.sampleRate);
      self.postMessage({ 
        type: 'process-result', 
        result,
        id: data.id
      });
      break;
      
    case 'filter-data':
      // Aplicar filtrado optimizado
      const filtered = applyOptimizedFilters(data.values, data.config);
      self.postMessage({ 
        type: 'filter-result', 
        filtered,
        id: data.id
      });
      break;
      
    case 'wavelet-transform':
      // Aplicar transformada wavelet
      const transformed = applyWaveletTransform(data.values, data.level);
      self.postMessage({ 
        type: 'wavelet-result', 
        transformed,
        id: data.id
      });
      break;
      
    case 'reset':
      // Resetear estado del worker
      if (filterBuffer) filterBuffer.fill(0);
      if (signalBuffer) signalBuffer.fill(0);
      if (resultBuffer) resultBuffer.fill(0);
      self.postMessage({ type: 'reset-complete' });
      break;
  }
};

/**
 * Procesa la señal PPG en paralelo con optimizaciones SIMD cuando es posible
 */
function processSignalParallel(signal: number[], sampleRate: number) {
  // Copiar datos al búfer preasignado
  if (signalBuffer && signal.length <= signalBuffer.length) {
    for (let i = 0; i < signal.length; i++) {
      signalBuffer[i] = signal[i];
    }
  }
  
  // Calcular métricas utilizando código optimizado para SIMD
  const metrics = calculateSignalMetricsOptimized(signal);
  
  return {
    ac: metrics.ac,
    dc: metrics.dc,
    perfusionIndex: metrics.ac / metrics.dc,
    quality: calculateSignalQuality(signal),
    timestamp: Date.now()
  };
}

/**
 * Calcula métricas de señal con optimizaciones SIMD cuando están disponibles
 */
function calculateSignalMetricsOptimized(signal: number[]) {
  // Intentar usar SIMD si está disponible
  if (typeof self.Atomics !== 'undefined' && typeof self.SharedArrayBuffer !== 'undefined') {
    try {
      return calculateMetricsWithSIMD(signal);
    } catch (e) {
      console.warn('SIMD optimization failed, falling back to standard processing', e);
    }
  }
  
  // Fallback a implementación estándar
  return {
    ac: calculateAC(signal),
    dc: calculateDC(signal)
  };
}

/**
 * Calcula métricas con SIMD para procesamiento vectorial
 * Solo se usa cuando está disponible en el navegador
 */
function calculateMetricsWithSIMD(signal: number[]) {
  // En navegadores sin soporte SIMD explícito, aún podemos optimizar
  // el código para facilitar la vectorización automática del compilador
  
  // Encontrar mínimo y máximo en un solo paso para calcular AC
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  
  // Loop optimizado para vectorización
  const len = signal.length;
  for (let i = 0; i < len; i += 4) {
    // Procesar 4 elementos por iteración cuando sea posible
    const remaining = Math.min(4, len - i);
    for (let j = 0; j < remaining; j++) {
      const val = signal[i + j];
      min = val < min ? val : min;
      max = val > max ? val : max;
      sum += val;
    }
  }
  
  const ac = max - min;
  const dc = sum / len;
  
  return { ac, dc };
}

/**
 * Aplica filtros optimizados a los datos
 */
function applyOptimizedFilters(values: number[], config: any) {
  // Copiar valores al búfer preasignado para reducir asignaciones
  if (filterBuffer && values.length <= filterBuffer.length) {
    for (let i = 0; i < values.length; i++) {
      filterBuffer[i] = values[i];
    }
  }
  
  // Aplicar filtros en secuencia
  let filtered = [...values]; // Evitar modificar entrada original
  
  if (config.median) {
    filtered = applyMedianFilter(filtered, config.median.windowSize || 3);
  }
  
  if (config.lowPass) {
    filtered = applyLowPassFilter(filtered, config.lowPass.alpha || 0.2);
  }
  
  if (config.bandPass) {
    filtered = applyBandPassFilter(filtered, 
      config.bandPass.lowCutoff || 0.5, 
      config.bandPass.highCutoff || 4.0, 
      config.bandPass.sampleRate || 30);
  }
  
  return filtered;
}

/**
 * Aplica un filtro de mediana optimizado
 */
function applyMedianFilter(values: number[], windowSize: number): number[] {
  const halfWindow = Math.floor(windowSize / 2);
  const result = new Array(values.length);
  
  for (let i = 0; i < values.length; i++) {
    const window = [];
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(values.length - 1, i + halfWindow); j++) {
      window.push(values[j]);
    }
    
    // Ordenar ventana y tomar el valor medio
    window.sort((a, b) => a - b);
    result[i] = window[Math.floor(window.length / 2)];
  }
  
  return result;
}

/**
 * Aplica un filtro paso bajo optimizado (EMA)
 */
function applyLowPassFilter(values: number[], alpha: number): number[] {
  const result = new Array(values.length);
  result[0] = values[0];
  
  for (let i = 1; i < values.length; i++) {
    result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
  }
  
  return result;
}

/**
 * Aplica un filtro paso banda simple
 */
function applyBandPassFilter(values: number[], lowCutoff: number, highCutoff: number, sampleRate: number): number[] {
  // Implementación simplificada de filtro paso banda
  const result = new Array(values.length);
  
  // Coeficientes para un filtro IIR simple
  const dt = 1 / sampleRate;
  const RC_low = 1 / (2 * Math.PI * highCutoff);
  const RC_high = 1 / (2 * Math.PI * lowCutoff);
  const alpha_low = dt / (RC_low + dt);
  const alpha_high = RC_high / (RC_high + dt);
  
  // Filtrar paso bajo
  let y_low = values[0];
  const lowPassFiltered = new Array(values.length);
  
  for (let i = 0; i < values.length; i++) {
    y_low = y_low + alpha_low * (values[i] - y_low);
    lowPassFiltered[i] = y_low;
  }
  
  // Filtrar paso alto
  let y_high = lowPassFiltered[0];
  
  for (let i = 0; i < values.length; i++) {
    y_high = alpha_high * (y_high + lowPassFiltered[i] - (i > 0 ? lowPassFiltered[i - 1] : lowPassFiltered[i]));
    result[i] = y_high;
  }
  
  return result;
}

/**
 * Aplica transformada wavelet optimizada
 */
function applyWaveletTransform(values: number[], level: number): number[] {
  // Implementación simplificada de transformada wavelet
  // (En una implementación real se usaría una biblioteca especializada)
  
  // Este es un ejemplo básico para demostración
  const result = [...values];
  
  // Aplicar el nivel de descomposición solicitado
  for (let l = 0; l < level; l++) {
    const len = Math.floor(result.length / Math.pow(2, l));
    const halfLen = Math.floor(len / 2);
    
    // Crear arreglos temporales para coeficientes
    const approx = new Array(halfLen);
    const detail = new Array(halfLen);
    
    // Calcular coeficientes wavelet (simplificado)
    for (let i = 0; i < halfLen; i++) {
      const idx = i * 2;
      if (idx + 1 < len) {
        // Coeficientes de aproximación (paso bajo)
        approx[i] = (result[idx] + result[idx + 1]) / Math.sqrt(2);
        // Coeficientes de detalle (paso alto)
        detail[i] = (result[idx] - result[idx + 1]) / Math.sqrt(2);
      } else {
        approx[i] = result[idx] / Math.sqrt(2);
        detail[i] = 0;
      }
    }
    
    // Reemplazar segmento del arreglo con los coeficientes calculados
    for (let i = 0; i < halfLen; i++) {
      result[i] = approx[i];
      result[i + halfLen] = detail[i];
    }
  }
  
  return result;
}

/**
 * Calcula calidad de señal basada en relación señal-ruido
 */
function calculateSignalQuality(signal: number[]): number {
  if (signal.length < 10) return 0;
  
  // Calcular energía de la señal
  let energySignal = 0;
  let energyDiff = 0;
  
  for (let i = 0; i < signal.length; i++) {
    energySignal += signal[i] * signal[i];
    
    if (i > 0) {
      const diff = signal[i] - signal[i - 1];
      energyDiff += diff * diff;
    }
  }
  
  // Evitar división por cero
  if (energyDiff === 0) return 0;
  
  // Calcular relación señal-ruido simplificada
  const snr = energySignal / energyDiff;
  
  // Normalizar a una escala de 0-100
  return Math.min(100, Math.max(0, Math.round(snr * 10)));
}
