
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 * 
 * Utilidades para análisis avanzado de señales PPG y detección robusta basada EXCLUSIVAMENTE en datos reales
 * @module signal-analysis-utils
 */

/**
 * Calcula el Signal-to-Noise Ratio (SNR) de una señal PPG
 * Mayor valor indica mejor calidad de señal
 * @param signal Array con los valores de la señal PPG
 * @returns Valor SNR en dB
 */
export const calculateSNR = (signal: number[]): number => {
  if (signal.length < 10) return 0;
  
  // 1. Calcular la media de la señal (componente DC)
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  
  // 2. Estimar la señal usando un filtro Butterworth digital
  // Implementación de un filtro IIR paso bajo de segundo orden
  const smoothedSignal: number[] = new Array(signal.length).fill(0);
  const omega = 0.1; // Frecuencia de corte normalizada
  const alpha = Math.cos(omega) / (1 + Math.sin(omega));
  
  // Coeficientes del filtro Butterworth de segundo orden optimizados para señales PPG
  const a0 = (1 - alpha) / 2;
  const a1 = (1 - alpha);
  const a2 = (1 - alpha) / 2;
  const b1 = -2 * alpha;
  const b2 = 1 - alpha;
  
  // Aplicar filtro (implementación directa de la forma II)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  
  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i] - mean;
    // Ecuación en diferencias
    const y0 = a0 * x0 + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2;
    
    // Guardar para próxima iteración
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    
    smoothedSignal[i] = y0 + mean;
  }
  
  // 3. Estimar el ruido como la diferencia entre la señal original y la filtrada
  let signalPower = 0;
  let noisePower = 0;
  
  for (let i = 0; i < signal.length; i++) {
    const signal_component = smoothedSignal[i] - mean;
    signalPower += signal_component * signal_component;
    
    const noise = signal[i] - smoothedSignal[i];
    noisePower += noise * noise;
  }
  
  // 4. Calcular SNR en dB
  if (noisePower === 0) return 40; // Límite superior arbitrario
  if (signalPower === 0) return 0; // Sin señal
  
  const snr = 10 * Math.log10(signalPower / noisePower);
  
  // Limitar rango para evitar valores extremos
  return Math.max(0, Math.min(40, snr));
};

/**
 * Calcula la autocorrelación de una señal para detectar periodicidad
 * Valor más alto indica mayor periodicidad / ritmo cardíaco más claro
 * @param signal Valores de la señal a analizar
 * @param maxLag Retraso máximo a analizar (en muestras)
 * @returns Valor de autocorrelación normalizado [0-1]
 */
export const calculateAutocorrelation = (signal: number[], maxLag: number = 50): number => {
  if (signal.length < maxLag * 2) return 0;
  
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const normalizedSignal = signal.map(v => v - mean);
  
  let maxCorrelation = 0;
  let bestLag = 0;
  
  // Empezamos desde un retraso mínimo para saltarnos correlaciones triviales
  const minLag = Math.min(8, Math.floor(signal.length * 0.1));
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < signal.length - lag; i++) {
      correlation += normalizedSignal[i] * normalizedSignal[i + lag];
      norm1 += normalizedSignal[i] * normalizedSignal[i];
      norm2 += normalizedSignal[i + lag] * normalizedSignal[i + lag];
    }
    
    const normalizedCorr = (norm1 > 0 && norm2 > 0) 
      ? correlation / Math.sqrt(norm1 * norm2)
      : 0;
    
    if (Math.abs(normalizedCorr) > maxCorrelation) {
      maxCorrelation = Math.abs(normalizedCorr);
      bestLag = lag;
    }
  }
  
  return maxCorrelation;
};

/**
 * Detecta artefactos/movimientos en una señal PPG basándose únicamente en datos reales
 * @param signal Valores de la señal
 * @returns Porcentaje de la señal considerado como artefacto (0-100%)
 */
export const detectArtifacts = (signal: number[]): number => {
  if (signal.length < 10) return 100;
  
  // Calcular la derivada de la señal para detectar cambios abruptos
  const derivatives: number[] = [];
  for (let i = 1; i < signal.length; i++) {
    derivatives.push(Math.abs(signal[i] - signal[i-1]));
  }
  
  // Calcular estadísticas de la derivada
  const meanDerivative = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
  
  // Calcular desviación estándar robusta (usando MAD - Median Absolute Deviation)
  const sortedDerivatives = [...derivatives].sort((a, b) => a - b);
  const medianDerivative = sortedDerivatives[Math.floor(derivatives.length / 2)];
  
  const madArray = derivatives.map(d => Math.abs(d - medianDerivative));
  const mad = madArray.reduce((sum, val) => sum + val, 0) / madArray.length;
  
  // Umbral adaptativo para considerar un cambio como artefacto
  // Factor 2.5 basado en literatura sobre análisis de señales biomédicas
  const threshold = medianDerivative + (2.5 * mad);
  
  // Contar puntos considerados como artefactos
  let artifactCount = 0;
  for (let i = 0; i < derivatives.length; i++) {
    if (derivatives[i] > threshold) {
      artifactCount++;
    }
  }
  
  // Calcular porcentaje y limitar entre 0-100
  const artifactPercentage = (artifactCount / signal.length) * 100;
  return Math.min(100, Math.max(0, artifactPercentage));
};

/**
 * Evalúa la estabilidad temporal de la señal
 * @param signal Valores temporales de la señal
 * @param timeWindow Ventana de tiempo en ms para considerar la señal estable
 * @returns Puntuación de estabilidad [0-1]
 */
export const evaluateSignalStability = (signal: number[], timeWindow: number = 2000): number => {
  if (signal.length < 5) return 0;
  
  // Dividir la señal en segmentos de timeWindow ms
  const segments: number[][] = [];
  const segmentSize = Math.min(20, Math.floor(signal.length / 3));
  
  for (let i = 0; i < signal.length - segmentSize; i += Math.floor(segmentSize / 2)) {
    segments.push(signal.slice(i, i + segmentSize));
  }
  
  if (segments.length < 2) return 0.5; // No hay suficientes segmentos para comparar
  
  // Calcular varianza de cada segmento
  const variances = segments.map(segment => {
    const mean = segment.reduce((sum, val) => sum + val, 0) / segment.length;
    return segment.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / segment.length;
  });
  
  // Varianza de varianzas como medida de estabilidad entre segmentos
  const meanVariance = variances.reduce((sum, val) => sum + val, 0) / variances.length;
  const varianceOfVariances = variances.reduce((sum, val) => sum + Math.pow(val - meanVariance, 2), 0) / variances.length;
  
  // Normalizar entre 0 y 1 (más cercano a 1 = más estable)
  // Fórmula basada en observaciones empíricas de señales PPG de alta calidad
  const stabilityScore = 1 / (1 + Math.sqrt(varianceOfVariances) / meanVariance);
  
  return Math.min(1, Math.max(0, stabilityScore));
};
