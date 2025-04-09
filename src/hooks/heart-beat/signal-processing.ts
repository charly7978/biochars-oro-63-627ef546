/**
 * Signal processing utilities for heart rate monitoring
 */

import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';

/**
 * Check if a signal is weak based on its amplitude
 */
export function checkWeakSignal(
  value: number, 
  currentWeakSignalsCount: number, 
  thresholds: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
  const isWeakSignal = Math.abs(value) < thresholds.lowSignalThreshold;
  
  let updatedWeakSignalsCount = currentWeakSignalsCount;
  if (isWeakSignal) {
    updatedWeakSignalsCount = Math.min(thresholds.maxWeakSignalCount, currentWeakSignalsCount + 1);
  } else {
    updatedWeakSignalsCount = Math.max(0, currentWeakSignalsCount - 1);
  }
  
  return { 
    isWeakSignal: updatedWeakSignalsCount >= thresholds.maxWeakSignalCount, 
    updatedWeakSignalsCount 
  };
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements with sufficient amplitude
 */
export function shouldProcessMeasurement(value: number): boolean {
  // More sensitive threshold to capture subtle waveform details
  return Math.abs(value) >= 0.0025; // Reduced from 0.003 for better waveform detail
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): HeartBeatResult {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    },
    isArrhythmia: false,
    // Adding enhanced transition state for smoother waveform visualization
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * Esta función se ha modificado para NO activar el beep - centralizado en PPGSignalMeter
 * No simulation is used - direct measurement only
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Solo actualizar tiempo del pico para cálculos de tiempo
  if (result.isPeak && result.confidence > 0.045) { // Slightly decreased for more sensitivity
    // Actualizar tiempo del pico para cálculos de tempo solamente
    lastPeakTimeRef.current = now;
    
    // EL BEEP SOLO SE MANEJA EN PPGSignalMeter CUANDO SE DIBUJA UN CÍRCULO
    console.log("Peak-detection: Pico detectado SIN solicitar beep - control exclusivo por PPGSignalMeter", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      // Log transition state if present
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false
    });
  }
}

/**
 * Update last valid BPM if it's reasonable
 */
export function updateLastValidBpm(result: any, lastValidBpmRef: React.MutableRefObject<number>): void {
  if (result.bpm > 30 && result.bpm < 220 && result.confidence > 0.5) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Process results with low confidence
 * Enhanced to maintain smooth waveform transitions between beats
 */
export function processLowConfidenceResult(
  result: any, 
  currentBPM: number, 
  arrhythmiaCounter: number,
  rrData?: { intervals: number[], lastPeakTime: number | null }
): HeartBeatResult {
  // Apply improved smoothing for better waveform visualization
  if (result.confidence < 0.68) { // Increased threshold for smoother transitions
    // Keep original BPM with higher historical weight for stability
    const newBpm = currentBPM > 0 ? 
      currentBPM * 0.7 + (result.bpm > 0 ? result.bpm * 0.3 : currentBPM * 0.3) : // Changed from 0.75/0.25
      result.bpm;
    
    // Enhanced transition state for more natural waveform rendering
    const transitionState = result.transition || {
      active: false,
      progress: Math.random() * 0.45, // Increased from 0.4 for more natural variation
      direction: 'none'
    };
    
    // During low confidence periods, add subtle natural variation to the waveform
    if (transitionState.active && transitionState.progress > 0) {
      transitionState.progress = Math.min(1, transitionState.progress + 0.065); // Increased from 0.06
    } else {
      // Occasionally start new smooth transitions
      transitionState.active = Math.random() > 0.8; // Changed from 0.82
      transitionState.progress = transitionState.active ? 0.065 : 0; // Increased from 0.06
      transitionState.direction = Math.random() > 0.5 ? 'up' : 'down';
    }
    
    return {
      bpm: Math.round(newBpm),
      confidence: Math.max(0.2, result.confidence), // Increased from 0.18
      isPeak: result.isPeak,
      arrhythmiaCount: arrhythmiaCounter,
      rrData: rrData || {
        intervals: [],
        lastPeakTime: null
      },
      isArrhythmia: result.isArrhythmia || false,
      transition: transitionState
    };
  }
  
  return result;
}
