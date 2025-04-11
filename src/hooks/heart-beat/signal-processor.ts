
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Simple reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD * 2; // Duplicado para ser más estricto
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  // Nuevas variables para filtrar falsos positivos
  const signalHistoryRef = useRef<number[]>([]);
  const MAX_HISTORY_SIZE = 15;
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 500; // Intervalo mínimo entre beeps

  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    confidence: number,
    processor: any,
    requestImmediateBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): HeartBeatResult => {
    if (!processor) {
      return createWeakSignalResult();
    }

    try {
      calibrationCounterRef.current++;
      
      // Registrar valor en el historial para análisis de variabilidad
      signalHistoryRef.current.push(value);
      if (signalHistoryRef.current.length > MAX_HISTORY_SIZE) {
        signalHistoryRef.current.shift();
      }
      
      // Check for weak signal - fixed property access
      const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
        value, 
        consecutiveWeakSignalsRef.current, 
        {
          lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      );
      
      consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
      
      if (isWeakSignal) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Verificar variabilidad de la señal para detectar posibles interferencias
      if (signalHistoryRef.current.length >= 5) {
        const recentValues = signalHistoryRef.current.slice(-5);
        const max = Math.max(...recentValues);
        const min = Math.min(...recentValues);
        const range = max - min;
        
        // Si la señal es demasiado estable (sin variación cardiaca), probablemente sea ruido
        if (range < 0.01) {
          console.log("useSignalProcessor: Señal sin variación cardiaca, ignorando");
          return createWeakSignalResult(processor.getArrhythmiaCounter());
        }
      }
      
      // Only process signals with sufficient amplitude
      if (!shouldProcessMeasurement(value)) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Process real signal
      const result = processor.processSignal(value);
      const rrData = processor.getRRIntervals();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Verificar tiempo mínimo entre beeps
      const now = Date.now();
      const timeElapsedSinceLastBeep = now - lastBeepTimeRef.current;
      
      const shouldTriggerBeep = 
        result.isPeak && 
        result.confidence > 0.45 && // Umbral de confianza más alto
        timeElapsedSinceLastBeep >= MIN_BEEP_INTERVAL_MS;
      
      // Handle peak detection con control de tiempo
      if (shouldTriggerBeep) {
        handlePeakDetection(
          result, 
          lastPeakTimeRef, 
          requestImmediateBeep, 
          isMonitoringRef,
          value
        );
        
        // Actualizar tiempo del último beep si se procesó correctamente
        if (result.isPeak) {
          lastBeepTimeRef.current = now;
        }
      }
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence;

      // Process result
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter()
      );
    } catch (error) {
      console.error('useHeartBeatProcessor: Error processing signal', error);
      return {
        bpm: currentBPM,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
  }, []);

  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    signalHistoryRef.current = [];
    lastBeepTimeRef.current = 0;
  }, []);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}
