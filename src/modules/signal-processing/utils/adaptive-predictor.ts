
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptive prediction utilities for signal processing
 */

/**
 * Apply adaptive filtering to a signal value
 */
export function applyAdaptiveFilter(value: number, history: number[], adaptationRate: number = 0.3): number {
  if (history.length < 2) return value;
  
  const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
  const filtered = (1 - adaptationRate) * mean + adaptationRate * value;
  
  return filtered;
}

/**
 * Predict the next value based on recent history
 */
export function predictNextValue(history: number[]): number {
  if (history.length < 2) return 0;
  
  // Use linear prediction based on last few samples
  const last = history[history.length - 1];
  const prevLast = history[history.length - 2];
  const delta = last - prevLast;
  
  return last + delta * 0.8; // Slightly damped prediction
}

/**
 * Correct anomalies in the signal
 */
export function correctSignalAnomalies(value: number, history: number[], threshold: number = 0.5): number {
  if (history.length < 3) return value;
  
  const mean = history.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
  const deviation = Math.abs(value - mean);
  
  // If the deviation is too high, limit it
  if (deviation > threshold) {
    return mean + (value > mean ? threshold : -threshold);
  }
  
  return value;
}

/**
 * Update signal quality based on prediction accuracy
 */
export function updateQualityWithPrediction(
  currentQuality: number, 
  predictedValue: number, 
  actualValue: number,
  maxDeviation: number = 0.2
): number {
  const deviation = Math.abs(predictedValue - actualValue);
  const predictionAccuracy = Math.max(0, 1 - (deviation / maxDeviation));
  
  // Weight the current quality with prediction accuracy
  return currentQuality * 0.8 + predictionAccuracy * 0.2;
}
