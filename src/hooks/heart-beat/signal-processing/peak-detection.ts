
/**
 * Functions for peak detection logic, working with real data only
 */
import React from 'react';

/**
 * Determines if a measurement should be processed based on signal strength
 * Only processes real measurements
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Umbral para capturar señales reales mientras filtra ruido
  return Math.abs(value) >= 0.01;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
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
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with natural synchronization
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
  
  // Actualizar tiempo del pico para cálculos de ritmo cardíaco
  if (result.isPeak && result.confidence > 0.05) {
    lastPeakTimeRef.current = now;
    
    // Solicitar beep si estamos monitoreando y la confianza es buena
    if (isMonitoringRef.current && result.confidence > 0.4) {
      requestBeepCallback(value);
    }
    
    console.log("Peak-detection: Pico detectado", {
      confianza: result.confidence,
      valor: value,
      tiempo: new Date(now).toISOString(),
      transicion: result.transition ? {
        activa: result.transition.active,
        progreso: result.transition.progress,
        direccion: result.transition.direction
      } : 'no hay transición',
      isArrhythmia: result.isArrhythmia || false
    });
  }
}
