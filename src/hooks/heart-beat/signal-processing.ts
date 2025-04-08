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
  return Math.abs(value) >= 0.005; // Reduced from 0.008 for better waveform detail
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
    // Adding transition state to ensure continuous color rendering
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
  if (result.isPeak && result.confidence > 0.05) {
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
  // Apply gentle smoothing to maintain waveform continuity during transitions
  if (result.confidence < 0.5) {
    // Keep original BPM with higher historical weight for stability
    const newBpm = currentBPM > 0 ? 
      currentBPM * 0.85 + (result.bpm > 0 ? result.bpm * 0.15 : currentBPM * 0.15) : 
      result.bpm;
    
    return {
      bpm: Math.round(newBpm),
      confidence: Math.max(0.1, result.confidence),
      isPeak: result.isPeak,
      arrhythmiaCount: arrhythmiaCounter,
      rrData: rrData || {
        intervals: [],
        lastPeakTime: null
      },
      isArrhythmia: result.isArrhythmia || false,
      // Enhance transition state for smoother waveform rendering
      transition: result.transition || {
        active: false,
        progress: 0,
        direction: 'none'
      }
    };
  }
  
  return result;
}
