
/**
 * Filtros de procesamiento de señales
 * Contiene funciones para filtrado, suavizado y mejora de señales PPG
 */

import { ProcessedPPGData } from '../types/signal';

/**
 * Aplica filtro de media móvil simple (SMA)
 * @param values Array de valores para filtrar
 * @param windowSize Tamaño de la ventana de filtrado
 */
export function applySimpleMovingAverage(values: number[], windowSize: number = 5): number[] {
  if (values.length < windowSize) {
    return [...values];
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < windowSize - 1) {
      // Para los primeros elementos, usamos los que tenemos
      const slice = values.slice(0, i + 1);
      const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
      result.push(avg);
    } else {
      // Una vez que tenemos suficientes elementos, aplicamos el filtro completo
      const slice = values.slice(i - windowSize + 1, i + 1);
      const avg = slice.reduce((sum, val) => sum + val, 0) / windowSize;
      result.push(avg);
    }
  }
  return result;
}

/**
 * Aplica filtro de pasa bajo
 * @param values Array de valores para filtrar
 * @param alpha Coeficiente del filtro (0-1, menor = más suavizado)
 */
export function applyLowPassFilter(values: number[], alpha: number = 0.2): number[] {
  if (values.length === 0) return [];
  
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const filtered = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(filtered);
  }
  return result;
}

/**
 * Elimina tendencia lineal de una señal
 * @param values Array de valores para procesar
 */
export function removeLinearTrend(values: number[]): number[] {
  if (values.length <= 2) return [...values];
  
  // Calcular pendiente y desplazamiento
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const offset = (sumY - slope * sumX) / n;
  
  // Eliminar tendencia
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const trend = slope * i + offset;
    result.push(values[i] - trend);
  }
  
  return result;
}

/**
 * Normaliza los valores a un rango [0,1]
 * @param values Array de valores para normalizar
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (max === min) return values.map(() => 0.5);
  
  return values.map(v => (v - min) / (max - min));
}

/**
 * Detecta la calidad de una señal PPG
 * @param data Datos PPG para evaluar
 */
export function detectSignalQuality(data: ProcessedPPGData): number {
  // Esta es una implementación simple
  // En un sistema real, evaluaríamos SNR, variabilidad, etc.
  
  // Si no se detecta dedo, calidad cero
  if (!data.fingerDetected) {
    return 0;
  }
  
  // Calidad basada en el valor filtrado (simulación)
  const baseQuality = 70;
  const randomVariation = Math.random() * 30;
  
  return Math.min(100, Math.max(0, baseQuality + randomVariation));
}

/**
 * Detecta si hay un dedo presente basado en los valores PPG
 * @param rawValue Valor PPG sin procesar
 * @param threshold Umbral para detección
 */
export function detectFinger(rawValue: number, threshold: number = 0.2): boolean {
  // En un sistema real, usaríamos análisis de componentes, varianza, etc.
  return rawValue > threshold;
}
