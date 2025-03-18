
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { 
  calculateWeightedQuality, 
  getQualityColor, 
  getQualityText 
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
  
  // Adaptive detection parameters - real signals only
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.45);
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 40;
  const MIN_DETECTION_THRESHOLD = 0.30;
  
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
    
    // Calculate detection ratio from real measurements
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calculate weighted signal quality
    const avgQuality = calculateWeightedQuality(qualityHistoryRef.current);
    
    // Adaptive threshold adjustment based on real detection history
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.8;
      const consistentNonDetection = rawDetectionRatio < 0.2;
      
      if (consistentNonDetection) {
        // Make detection easier when consistently not detecting
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.08
        );
      } else if (consistentDetection && avgQuality < 35) {
        // Be more strict when consistently detecting but quality is low
        detectionThresholdRef.current = Math.min(
          0.6,
          detectionThresholdRef.current + 0.05
        );
      }
    }
    
    // Signal lock logic for stability
    if (signal.fingerDetected) {
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = Math.min(MAX_SIGNAL_LOCK, signalLockCounterRef.current + 1);
    } else {
      if (signalLockCounterRef.current >= MAX_SIGNAL_LOCK) {
        consecutiveNonDetectionRef.current++;
        
        if (consecutiveNonDetectionRef.current > RELEASE_GRACE_PERIOD) {
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
        }
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
      }
    }
    
    // Final detection determination
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    const robustFingerDetected = isLockedIn || rawDetectionRatio >= currentThreshold;
    
    // Quality enhancement factor
    const enhancementFactor = robustFingerDetected ? 1.08 : 1.0;
    const enhancedQuality = Math.min(100, avgQuality * enhancementFactor);
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality,
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
    
    // Reset adaptive variables
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.45;
    adaptiveCounterRef.current = 0;
    
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
