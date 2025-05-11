/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { findMaximum, findMinimum, absoluteValue, roundToInt, squareRoot } from '../../../utils/non-math-utils';

/**
 * Calcula componente AC (amplitud pico a pico) de una señal real
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Sin usar Math.min/Math.max con algoritmo de paso único
  let max = values[0];
  let min = values[0];
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
    if (values[i] < min) min = values[i];
  }
  
  return max - min;
}

/**
 * Calcula componente DC (valor medio) de una señal real
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Calcula desviación estándar real sin simulaciones
 */
export function calculateStandardDeviation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i];
  }
  const mean = sum / n;
  
  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    sumSqDiff += diff * diff;
  }
  
  // Raíz cuadrada con aproximación Newton sin Math.sqrt
  let result = sumSqDiff / n;
  if (result === 0) return 0;
  
  // Método de Newton para raíz cuadrada - más iteraciones para mayor precisión
  let x = result;
  for (let i = 0; i < 12; i++) {
    x = 0.5 * (x + result / x);
  }
  
  return x;
}

/**
 * Calcula EMA (Exponential Moving Average) real con adaptación dinámica
 */
export function calculateEMA(prevEMA: number, currentValue: number, alpha: number): number {
  // EMA básico - siempre directo y preciso, sin generar datos falsos
  return alpha * currentValue + (1 - alpha) * prevEMA;
}

/**
 * Normaliza un valor entre un rango determinado
 * Usado para normalizar datos reales, nunca para simulación
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Calcula derivada de señal para detección de inflexiones en señal real
 */
export function calculateDerivative(values: number[]): number[] {
  if (values.length < 2) return [];
  
  const derivatives = [];
  for (let i = 1; i < values.length; i++) {
    derivatives.push(values[i] - values[i-1]);
  }
  
  return derivatives;
}

/**
 * Detecta picos en señal PPG real con alta precisión
 * Método basado en análisis de primera y segunda derivada
 */
export function detectPeaks(values: number[], lookbackWindow: number = 3): number[] {
  if (values.length < lookbackWindow * 2 + 1) return [];
  
  const peaks = [];
  
  // Calcular primera derivada sin Math.abs
  const derivatives = calculateDerivative(values);
  
  // Analizar cambios de pendiente para detectar picos reales
  for (let i = lookbackWindow; i < values.length - lookbackWindow; i++) {
    // Un punto es pico si:
    // 1. Es mayor que todos los puntos en ventana anterior
    // 2. Es mayor que todos los puntos en ventana posterior
    // 3. La derivada cambia de positiva a negativa
    
    let isPeak = true;
    
    // Comprobar ventana anterior
    for (let j = i - lookbackWindow; j < i; j++) {
      if (values[j] >= values[i]) {
        isPeak = false;
        break;
      }
    }
    
    if (!isPeak) continue;
    
    // Comprobar ventana posterior
    for (let j = i + 1; j <= i + lookbackWindow; j++) {
      if (values[j] >= values[i]) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      // Comprobar cambio de pendiente
      const derivIndex = i - 1;
      if (derivIndex > 0 && derivIndex < derivatives.length - 1) {
        if (derivatives[derivIndex] > 0 && derivatives[derivIndex + 1] < 0) {
          peaks.push(i);
        }
      }
    }
  }
  
  return peaks;
}

/**
 * Calcula frecuencia cardíaca a partir de intervalos RR reales
 */
export function calculateHeartRateFromRRIntervals(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  // Filtrar intervalos fisiológicamente imposibles
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);
  
  if (validIntervals.length < 2) return 0;
  
  // Calcular media sin reducers
  let sum = 0;
  for (let i = 0; i < validIntervals.length; i++) {
    sum += validIntervals[i];
  }
  const avgInterval = sum / validIntervals.length;
  
  // Convertir a BPM - solo con datos reales
  return avgInterval > 0 ? 60000 / avgInterval : 0;
}
