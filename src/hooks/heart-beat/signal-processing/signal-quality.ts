
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Functions for signal quality analysis
 */

import { HeartBeatResult } from '../types';

/**
 * Structure for signal quality check parameters
 */
interface SignalQualityParams {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Basic signal quality check to detect if a signal is too weak
 * Simple threshold-based implementation without complex processing
 */
export const checkWeakSignal = (
  value: number,
  currentWeakSignalCount: number, 
  params: SignalQualityParams
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } => {
  // Basic threshold check for low signal
  const isCurrentValueWeak = Math.abs(value) < params.lowSignalThreshold;
  
  // Simple counter increment/reset logic
  const updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignalCount + 1 
    : 0;
  
  // Signal is considered weak if too many consecutive low values
  const isWeakSignal = updatedWeakSignalsCount >= params.maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Check if a measurement has sufficient amplitude to process
 * Minimal implementation focused on stability
 */
export const shouldProcessMeasurement = (value: number): boolean => {
  return Math.abs(value) >= 0.05;
}

/**
 * Create result for when signal is too weak
 * Simple, stable implementation
 */
export const createWeakSignalResult = (arrhythmiaCount: number = 0): HeartBeatResult => {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCount,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Reset signal quality state
 * Simple helper function for state management
 */
export const resetSignalQualityState = (weakSignalsCountRef: React.MutableRefObject<number>): void => {
  weakSignalsCountRef.current = 0;
}

/**
 * Central function for signal quality analysis
 * Simple implementation with basic quality assessment
 */
export function checkSignalQuality(
  value: number,
  currentWeakSignalsCount: number,
  params: SignalQualityParams
) {
  return checkWeakSignal(value, currentWeakSignalsCount, params);
}
