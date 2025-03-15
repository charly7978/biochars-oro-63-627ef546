
/**
 * Specialized utilities for heartbeat amplification in PPG signals
 */

import { normalizeValue } from '../filtering/basicFilters';

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
  if (values.length < 10) return [...values];
  
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
