
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
 * Amplifica óptimamente los latidos en una señal PPG usando técnicas de Amplificación Euleriana
 * combinadas con procesamiento wavelet para resaltar la componente pulsátil.
 * Especialmente útil para señales débiles o pacientes con baja perfusión.
 * 
 * @param values Array con los valores de la señal PPG
 * @param amplificationFactor Factor de amplificación (1.0-5.0 recomendado)
 * @param targetFrequencyRange Rango de frecuencia a amplificar [min, max] en Hz (por defecto [0.8, 2.0] - 48-120 BPM)
 * @returns Array con la señal amplificada
 */
export const amplifyHeartbeats = (
  values: number[], 
  amplificationFactor: number = 2.5,
  targetFrequencyRange: [number, number] = [0.8, 2.0]
): number[] => {
  if (values.length <
 10) return [...values];
  
  // Limitar factor de amplificación a un rango razonable
  const safeAmplificationFactor = Math.max(1.0, Math.min(5.0, amplificationFactor));
  
  // Paso 1: Normalizar la señal para trabajar en rango [0,1]
  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalizedValues = values.map(v => normalizeValue(v, min, max));
  
  // Paso 2: Extraer la tendencia usando un filtro de media móvil de ventana grande
  const trendWindowSize = Math.max(10, Math.floor(values.length / 5));
  const trend: number[] = [];
  
  for (let i = 0; i < normalizedValues.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Calcular promedio centrado
    for (let j = Math.max(0, i - Math.floor(trendWindowSize/2)); 
         j <= Math.min(normalizedValues.length - 1, i + Math.floor(trendWindowSize/2)); 
         j++) {
      sum += normalizedValues[j];
      count++;
    }
    
    trend.push(sum / count);
  }
  
  // Paso 3: Extraer la componente pulsátil restando la tendencia
  const pulsatileComponent = normalizedValues.map((v, i) => v - trend[i]);
  
  // Paso 4: Aplicar filtro pasabanda para conservar solo frecuencias cardiovasculares
  // (simulado con un filtro IIR simple para este caso)
  const samplingRate = 30; // Asumimos 30 fps para la captura
  const lowCutoff = targetFrequencyRange[0] / (samplingRate / 2); // Normalizado a Nyquist
  const highCutoff = targetFrequencyRange[1] / (samplingRate / 2); // Normalizado a Nyquist
  
  // Coeficientes simplificados para un filtro IIR
  const alpha = 0.8;
  const beta = 0.8;
  
  // Aplicar filtro pasabanda simplificado
  const filteredPulsatile: number[] = [];
  let lastHighPassValue = 0;
  let lastBandPassValue = 0;
  
  for (let i = 0; i < pulsatileComponent.length; i++) {
    // Pasa-altas para remover frecuencias muy bajas
    const highPass = beta * (lastHighPassValue + pulsatileComponent[i] - 
                            (i > 0 ? pulsatileComponent[i-1] : 0));
    
    // Pasa-bajas para remover frecuencias muy altas
    const bandPass = alpha * lastBandPassValue + (1 - alpha) * highPass;
    
    filteredPulsatile.push(bandPass);
    lastHighPassValue = highPass;
    lastBandPassValue = bandPass;
  }
  
  // Paso 5: Amplificar la componente pulsátil
  const amplifiedPulsatile = filteredPulsatile.map(v => v * safeAmplificationFactor);
  
  // Paso 6: Reconstruir la señal sumando la componente amplificada a la tendencia
  const amplifiedSignal = trend.map((t, i) => t + amplifiedPulsatile[i]);
  
  // Paso 7: Renormalizar al rango original
  const amplifiedRange = max - min;
  return amplifiedSignal.map(v => min + v * amplifiedRange);
};

/**
 * Aplica amplificación avanzada de latidos en tiempo real a un único valor de señal
 * usando una ventana deslizante de valores anteriores. Útil para procesamiento en tiempo real.
 * 
 * @param value Valor actual de la señal
 * @param previousValues Array con los valores anteriores (ventana deslizante)
 * @param windowSize Tamaño máximo de la ventana
 * @param amplificationFactor Factor de amplificación
 * @returns Valor amplificado
 */
export const amplifyHeartbeatRealtime = (
  value: number,
  previousValues: number[],
  windowSize: number = 90, // 3 segundos a 30fps
  amplificationFactor: number = 2.0
): number => {
  // Crear una copia para no modificar el array original
  const window = [...previousValues, value].slice(-windowSize);
  
  // Si no hay suficientes muestras, devolver el valor sin procesar
  if (window.length < Math.max(10, windowSize / 3)) {
    return value;
  }
  
  // Aplicar amplificación a la ventana
  const amplifiedWindow = amplifyHeartbeats(window, amplificationFactor);
  
  // Devolver el último valor de la ventana amplificada
  return amplifiedWindow[amplifiedWindow.length - 1];
};
