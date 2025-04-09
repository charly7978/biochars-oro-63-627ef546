
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

// Device capability detection for adaptive refresh
const detectDeviceCapabilities = (): { isLowPower: boolean, refreshInterval: number } => {
  // Check for low-end device indicators
  const isLowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4;
  const isSlowCPU = (navigator as any).hardwareConcurrency !== undefined && (navigator as any).hardwareConcurrency < 4;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  const isLowPower = (isLowMemory || isSlowCPU) && isMobile;
  
  // Set appropriate refresh interval
  const refreshInterval = isLowPower ? 50 : 30; // 20Hz for low-power devices, 33Hz for standard
  
  return { isLowPower, refreshInterval };
};

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Simple reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  // Web Worker reference
  const workerRef = useRef<Worker | null>(null);
  const isWorkerAvailableRef = useRef<boolean>(true);
  const deviceCapabilitiesRef = useRef(detectDeviceCapabilities());
  
  // Initialize worker if supported
  const initWorker = useCallback(() => {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported in this browser, falling back to main thread processing');
      isWorkerAvailableRef.current = false;
      return;
    }
    
    try {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      
      workerRef.current = new Worker(new URL('../../workers/signal-processor.worker.ts', import.meta.url), { type: 'module' });
      
      workerRef.current.onmessage = (event) => {
        // Handle worker messages here if needed
        if (event.data.type === 'ERROR') {
          console.error('Worker error:', event.data.error);
          isWorkerAvailableRef.current = false; // Fall back to main thread on error
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Worker initialization error:', error);
        isWorkerAvailableRef.current = false; // Fall back to main thread on error
      };
      
      console.log('Signal processor worker initialized');
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      isWorkerAvailableRef.current = false;
    }
  }, []);

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
      
      // Check for weak signal
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
      
      // Handle peak detection
      handlePeakDetection(
        result, 
        lastPeakTimeRef, 
        requestImmediateBeep, 
        isMonitoringRef,
        value
      );
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence;

      // Process result
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter(),
        rrData
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
    
    // Reset worker if available
    if (workerRef.current && isWorkerAvailableRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
    }
    
    // Re-detect device capabilities on reset
    deviceCapabilitiesRef.current = detectDeviceCapabilities();
  }, []);

  // Initialize worker on first load
  useCallback(() => {
    initWorker();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [initWorker]);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    deviceCapabilities: deviceCapabilitiesRef.current
  };
}
