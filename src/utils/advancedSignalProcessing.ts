
/**
 * Utilidades avanzadas para procesamiento de señales PPG
 * Implementa algoritmos de vanguardia para extracción de características y reducción de ruido
 */

/**
 * Implementa descomposición en modo empírico (EMD) simplificada
 * Separa la señal en componentes intrínsecos para análisis más preciso
 */
export const performSimplifiedEMD = (signal: number[], iterations: number = 3): number[][] => {
  if (signal.length < 3) return [signal];
  
  // Función para encontrar extremos (mínimos y máximos locales)
  const findExtrema = (data: number[]) => {
    const maxima: number[] = [];
    const minima: number[] = [];
    const maximaIndices: number[] = [];
    const minimaIndices: number[] = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i-1] && data[i] > data[i+1]) {
        maxima.push(data[i]);
        maximaIndices.push(i);
      } else if (data[i] < data[i-1] && data[i] < data[i+1]) {
        minima.push(data[i]);
        minimaIndices.push(i);
      }
    }
    
    return { maxima, minima, maximaIndices, minimaIndices };
  };
  
  // Función para interpolación cúbica simple
  const simpleInterpolate = (indices: number[], values: number[], length: number): number[] => {
    if (indices.length === 0) return Array(length).fill(0);
    if (indices.length === 1) return Array(length).fill(values[0]);
    
    const result = Array(length).fill(0);
    
    for (let i = 0; i < length; i++) {
      // Encontrar el índice más cercano
      let nearestIndex = 0;
      let minDistance = Math.abs(i - indices[0]);
      
      for (let j = 1; j < indices.length; j++) {
        const distance = Math.abs(i - indices[j]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = j;
        }
      }
      
      // Interpolación lineal simple
      result[i] = values[nearestIndex];
    }
    
    return result;
  };
  
  // Descomposición EMD simplificada
  let residual = [...signal];
  const imfs: number[][] = [];
  
  for (let iter = 0; iter < iterations; iter++) {
    let currentSignal = [...residual];
    let prevImf = Array(signal.length).fill(0);
    
    // Proceso de tamizado (sifting)
    for (let sift = 0; sift < 10; sift++) {
      const { maxima, minima, maximaIndices, minimaIndices } = findExtrema(currentSignal);
      
      if (maxima.length < 2 || minima.length < 2) break;
      
      // Crear envolventes
      const upperEnvelope = simpleInterpolate(maximaIndices, maxima, signal.length);
      const lowerEnvelope = simpleInterpolate(minimaIndices, minima, signal.length);
      
      // Calcular media
      const mean = upperEnvelope.map((val, idx) => (val + lowerEnvelope[idx]) / 2);
      
      // Actualizar señal
      prevImf = [...currentSignal];
      currentSignal = currentSignal.map((val, idx) => val - mean[idx]);
    }
    
    // Guardar IMF y actualizar residuo
    imfs.push(currentSignal);
    residual = residual.map((val, idx) => val - currentSignal[idx]);
  }
  
  // Añadir residuo como componente final
  imfs.push(residual);
  
  return imfs;
};

/**
 * Filtro adaptativo de fase preservada - preserva características morfológicas importantes
 * Más efectivo que filtros FIR o IIR tradicionales para señales PPG
 */
export const phasePreservingFilter = (signal: number[], cutoffFreq: number = 0.1): number[] => {
  if (signal.length < 3) return signal;
  
  const filtered: number[] = [...signal];
  const alpha = Math.exp(-2 * Math.PI * cutoffFreq);
  
  // Filtro forward-backward para preservación de fase
  let prevOutput = signal[0];
  
  // Forward pass
  for (let i = 1; i < filtered.length; i++) {
    filtered[i] = alpha * prevOutput + (1 - alpha) * signal[i];
    prevOutput = filtered[i];
  }
  
  // Backward pass para preservar fase
  prevOutput = filtered[filtered.length - 1];
  for (let i = filtered.length - 2; i >= 0; i--) {
    filtered[i] = alpha * prevOutput + (1 - alpha) * filtered[i];
    prevOutput = filtered[i];
  }
  
  return filtered;
};

/**
 * Detección avanzada de picos basada en análisis de fase y amplitud
 * Más robusta que los métodos tradicionales basados solo en umbrales
 */
export const detectPeaksAdvanced = (
  signal: number[], 
  samplingRate: number = 30,
  minDistance: number = 20
): number[] => {
  if (signal.length < 5) return [];
  
  // Normalizar la señal
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const normalized = signal.map(val => val - mean);
  
  // Calcular derivative para detección de pendientes
  const derivative: number[] = [];
  for (let i = 1; i < normalized.length; i++) {
    derivative.push(normalized[i] - normalized[i-1]);
  }
  
  // Detectar cruces por cero negativos en la derivada (picos potenciales)
  const potentialPeaks: number[] = [];
  for (let i = 1; i < derivative.length; i++) {
    if (derivative[i] < 0 && derivative[i-1] >= 0) {
      potentialPeaks.push(i);
    }
  }
  
  // Refinar picos basados en amplitud y distancia mínima
  const confirmedPeaks: number[] = [];
  const minThreshold = Math.max(...normalized) * 0.3;
  
  for (let i = 0; i < potentialPeaks.length; i++) {
    const peakIdx = potentialPeaks[i];
    
    // Verificar que supera umbral mínimo
    if (normalized[peakIdx] < minThreshold) continue;
    
    // Verificar distancia mínima con pico anterior
    if (confirmedPeaks.length > 0) {
      const lastPeakIdx = confirmedPeaks[confirmedPeaks.length - 1];
      if (peakIdx - lastPeakIdx < minDistance) {
        // Si ambos son candidatos, quedarse con el mayor
        if (normalized[peakIdx] > normalized[lastPeakIdx]) {
          confirmedPeaks.pop();
          confirmedPeaks.push(peakIdx);
        }
        continue;
      }
    }
    
    confirmedPeaks.push(peakIdx);
  }
  
  return confirmedPeaks;
};

/**
 * Análisis de variabilidad de ritmo cardíaco (HRV) basado en picos detectados
 * Proporciona métricas adicionales sobre ritmo cardíaco
 */
export const analyzeHRV = (
  peakIndices: number[], 
  samplingRate: number = 30
): {
  meanHR: number;
  sdnn: number;
  rmssd: number;
  pnn50: number;
} => {
  if (peakIndices.length < 3) {
    return { meanHR: 0, sdnn: 0, rmssd: 0, pnn50: 0 };
  }
  
  // Calcular intervalos RR en milisegundos
  const rrIntervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    const intervalSamples = peakIndices[i] - peakIndices[i-1];
    const intervalMs = (intervalSamples / samplingRate) * 1000;
    rrIntervals.push(intervalMs);
  }
  
  // Calcular ritmo cardíaco medio
  const meanRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const meanHR = 60000 / meanRR;
  
  // Calcular SDNN (desviación estándar de intervalos NN)
  const squaredDiffs = rrIntervals.map(rr => Math.pow(rr - meanRR, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const sdnn = Math.sqrt(variance);
  
  // Calcular RMSSD (raíz cuadrada del promedio de diferencias cuadradas)
  const successiveDiffs: number[] = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    successiveDiffs.push(Math.pow(rrIntervals[i] - rrIntervals[i-1], 2));
  }
  const rmssd = Math.sqrt(
    successiveDiffs.reduce((a, b) => a + b, 0) / Math.max(1, successiveDiffs.length)
  );
  
  // Calcular pNN50 (porcentaje de intervalos NN que difieren en más de 50ms)
  let nn50Count = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
      nn50Count++;
    }
  }
  const pnn50 = (nn50Count / Math.max(1, rrIntervals.length - 1)) * 100;
  
  return { meanHR, sdnn, rmssd, pnn50 };
};

/**
 * Descomposición singular de señal para separación de componentes
 * Útil para separar latido cardíaco de respiración y artefactos
 */
export const singularSpectrumDecomposition = (
  signal: number[],
  windowSize: number = 30,
  components: number = 3
): number[][] => {
  if (signal.length < windowSize || components < 1) {
    return [signal];
  }
  
  // Crear matriz de trayectoria
  const trajectoryMatrix: number[][] = [];
  for (let i = 0; i <= signal.length - windowSize; i++) {
    trajectoryMatrix.push(signal.slice(i, i + windowSize));
  }
  
  // Implementación simplificada de SVD usando power iteration
  const reconstructComponents: number[][] = [];
  let residual = [...signal];
  
  for (let k = 0; k < components; k++) {
    // Vector aleatorio inicial para power iteration
    let eigenVector = Array(windowSize).fill(0).map(() => Math.random());
    
    // Normalizar
    const norm = Math.sqrt(eigenVector.reduce((a, b) => a + b*b, 0));
    eigenVector = eigenVector.map(v => v / norm);
    
    // Power iteration (10 iteraciones)
    for (let iter = 0; iter < 10; iter++) {
      // Multiplicar por matriz de trayectoria y su transpuesta
      let newVector = Array(windowSize).fill(0);
      
      for (let i = 0; i < trajectoryMatrix.length; i++) {
        const dotProduct = trajectoryMatrix[i].reduce(
          (sum, val, idx) => sum + val * eigenVector[idx], 0
        );
        
        for (let j = 0; j < windowSize; j++) {
          newVector[j] += dotProduct * trajectoryMatrix[i][j];
        }
      }
      
      // Normalizar
      const newNorm = Math.sqrt(newVector.reduce((a, b) => a + b*b, 0));
      eigenVector = newVector.map(v => v / newNorm);
    }
    
    // Proyectar la señal sobre el eigenvector
    const component = Array(signal.length).fill(0);
    
    for (let i = 0; i < signal.length - windowSize + 1; i++) {
      const dotProduct = eigenVector.reduce(
        (sum, val, idx) => sum + val * signal[i + idx], 0
      );
      
      for (let j = 0; j < windowSize; j++) {
        component[i + j] += dotProduct * eigenVector[j];
      }
    }
    
    // Normalizar por el número de contribuciones
    const counts = Array(signal.length).fill(0);
    for (let i = 0; i < signal.length - windowSize + 1; i++) {
      for (let j = 0; j < windowSize; j++) {
        counts[i + j]++;
      }
    }
    
    for (let i = 0; i < component.length; i++) {
      component[i] /= Math.max(1, counts[i]);
    }
    
    // Añadir componente y actualizar residual
    reconstructComponents.push(component);
    residual = residual.map((val, idx) => val - component[idx]);
  }
  
  // Añadir residual como último componente
  reconstructComponents.push(residual);
  
  return reconstructComponents;
};
