
/**
 * Central Signal Processor
 * Coordinates all signal processing and vital signs calculation
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSignalProcessor } from './useSignalProcessor';
import { useHeartBeatProcessor } from './heart-beat/useHeartBeatProcessor';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';
import { VitalSignsResult } from '../core/VitalSignsProcessor';
import tensorFlowModelRegistry from '../core/neural/tensorflow/TensorFlowModelRegistry';

export interface SignalProcessingResult {
  value: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  heartRate: number;
  isArrhythmia: boolean;
  vitalSigns: VitalSignsResult;
  arrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Hook for unified signal processing
 */
export const useCentralSignalProcessor = () => {
  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<SignalProcessingResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  
  // Refs
  const timerRef = useRef<number | null>(null);
  
  // TensorFlow
  const [modelsInitialized, setModelsInitialized] = useState(false);
  
  // Initialize TensorFlow models
  useEffect(() => {
    const initializeModels = async () => {
      try {
        await tensorFlowModelRegistry.initialize();
        setModelsInitialized(true);
        console.log("Central Signal Processor: TensorFlow models initialized");
      } catch (error) {
        console.error("Central Signal Processor: Error initializing TensorFlow models", error);
      }
    };
    
    initializeModels();
  }, []);
  
  // Hooks
  const { 
    startProcessing: startSignalProcessor, 
    stopProcessing: stopSignalProcessor, 
    processFrame,
    lastSignal
  } = useSignalProcessor();
  
  const { 
    processSignal: processHeartBeat,
    heartBeatResult
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    arrhythmiaCounter,
    lastValidResults
  } = useVitalSignsProcessor();
  
  // Start processing
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    startSignalProcessor();
    
    // Reset timers
    setElapsedTime(0);
    
    // Start timer
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    
    timerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const next = prev + 1;
        if (next >= 60) {
          window.clearInterval(timerRef.current as number);
          // Don't stop processing automatically
          return 60;
        }
        return next;
      });
    }, 1000);
    
    console.log("Central Signal Processor: Started");
  }, [startSignalProcessor]);
  
  // Stop processing
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    stopSignalProcessor();
    
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log("Central Signal Processor: Stopped");
  }, [stopSignalProcessor]);
  
  // Reset everything
  const reset = useCallback(() => {
    setIsProcessing(false);
    stopSignalProcessor();
    resetVitalSigns();
    setElapsedTime(0);
    setLastResult(null);
    setArrhythmiaCount(0);
    
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    console.log("Central Signal Processor: Reset");
  }, [stopSignalProcessor, resetVitalSigns]);
  
  // Process signal
  const processSignal = useCallback((value: number) => {
    if (!isProcessing) return null;
    
    // Process heartbeat
    const heartbeat = processHeartBeat(value);
    
    // Get RR data from heartbeat result if available
    const rrData = heartbeat?.rrData || undefined;
    
    // Process vital signs with RR data from heartbeat
    const vitals = processVitalSigns(value, rrData);
    
    // Check for arrhythmia counter changes
    if (arrhythmiaCounter !== arrhythmiaCount) {
      setArrhythmiaCount(arrhythmiaCounter);
    }
    
    // Create result
    const result: SignalProcessingResult = {
      value,
      filteredValue: value, // Using raw value as filtered for now
      quality: lastSignal?.quality || 0,
      fingerDetected: lastSignal?.fingerDetected || false,
      heartRate: heartbeat?.bpm || 0,
      isArrhythmia: vitals.arrhythmiaStatus.includes("ARRHYTHMIA"),
      vitalSigns: vitals,
      arrhythmiaData: vitals.lastArrhythmiaData
    };
    
    setLastResult(result);
    return result;
  }, [
    isProcessing, 
    processHeartBeat, 
    processVitalSigns, 
    lastSignal, 
    arrhythmiaCounter, 
    arrhythmiaCount
  ]);
  
  // Process frame (from camera)
  useEffect(() => {
    if (lastSignal && isProcessing) {
      processSignal(lastSignal.filteredValue);
    }
  }, [lastSignal, isProcessing, processSignal]);

  return {
    // Methods
    startProcessing,
    stopProcessing,
    reset,
    processSignal,
    processFrame,
    
    // State
    isProcessing,
    elapsedTime,
    lastResult,
    lastSignal,
    heartBeatResult,
    vitalSigns: lastValidResults,
    arrhythmiaCount,
    modelsInitialized
  };
};
