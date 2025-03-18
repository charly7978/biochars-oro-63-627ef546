
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { 
  calculateWeightedQuality, 
  getQualityColor, 
  getQualityText,
  checkSignalQuality
} from '../modules/heart-beat/signal-quality';

/**
 * Hook for processing PPG signals directly
 * Only uses real data without simulation
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  // Signal quality history
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5;
  
  // Weak signal detection parameters
  const weakSignalsCountRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.10;
  const MAX_WEAK_SIGNALS = 3;
  
  // Signal lock parameters - real signals only
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 4;
  const RELEASE_GRACE_PERIOD = 3;

  /**
   * Process finger detection robustly from real signal
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Update signal history
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calculate weighted signal quality using centralized function
    const avgQuality = calculateWeightedQuality(qualityHistoryRef.current);
    
    // Check for weak signal using centralized function
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      signal.filteredValue,
      weakSignalsCountRef.current,
      {
        lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_WEAK_SIGNALS
      }
    );
    
    weakSignalsCountRef.current = updatedWeakSignalsCount;
    
    // Signal lock logic for stability
    if (!isWeakSignal) {
      signalLockCounterRef.current = Math.min(MAX_SIGNAL_LOCK, signalLockCounterRef.current + 1);
    } else {
      signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
    }
    
    // Final detection determination
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const robustFingerDetected = isLockedIn && !isWeakSignal;
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: avgQuality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update signal statistics
      setSignalStats(prev => {
        return {
          minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
          maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
      });
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup
    return () => {
      processor.stop();
    };
  }, [processor, processRobustFingerDetection]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    // Reset signal quality variables
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    weakSignalsCountRef.current = 0;
    signalLockCounterRef.current = 0;
    
    processor.start();
  }, [processor]);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
