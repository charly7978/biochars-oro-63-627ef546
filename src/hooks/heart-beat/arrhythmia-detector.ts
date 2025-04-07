
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useCallback, useRef } from 'react';
import { ArrhythmiaDetectionService } from '../../services/ArrhythmiaDetectionService';

/**
 * Hook for arrhythmia detection based on real RR interval data
 * No simulation or data manipulation is used - direct measurement only
 */
export function useArrhythmiaDetector() {
  const detectionServiceRef = useRef<ArrhythmiaDetectionService | null>(null);
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);

  /**
   * Analyze real RR intervals to detect arrhythmias 
   * Using direct measurement algorithms only
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    // Initialize the service if needed
    if (!detectionServiceRef.current) {
      detectionServiceRef.current = new ArrhythmiaDetectionService();
      console.log("ArrhythmiaDetector: Detection service initialized");
    }
    
    // Prepare RR data
    const rrData = {
      intervals: rrIntervals,
      lastPeakTime: Date.now()
    };
    
    // Process detection
    const result = detectionServiceRef.current.detectArrhythmia(rrData);
    
    // Store internal states for persistence
    heartRateVariabilityRef.current = detectionServiceRef.current.getPersistedIntervals().slice(-10);
    lastRRIntervalsRef.current = rrIntervals;
    lastIsArrhythmiaRef.current = currentBeatIsArrhythmiaRef.current;
    currentBeatIsArrhythmiaRef.current = result.isArrhythmia;
    stabilityCounterRef.current = detectionServiceRef.current.getDiagnosticInfo().stabilityCounter;
    
    return {
      rmssd: result.rmssd || 0,
      rrVariation: result.rrVariation || 0,
      timestamp: result.timestamp,
      isArrhythmia: result.isArrhythmia
    };
  }, []);

  /**
   * Reset all tracking data
   */
  const reset = useCallback(() => {
    if (detectionServiceRef.current) {
      detectionServiceRef.current.reset();
    } else {
      detectionServiceRef.current = new ArrhythmiaDetectionService();
    }
    
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    
    console.log("ArrhythmiaDetector: Reset completed");
  }, []);

  return {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset
  };
}
