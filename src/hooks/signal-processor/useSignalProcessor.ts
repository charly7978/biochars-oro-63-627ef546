
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Hook for managing PPG signal processing
 */
import { useState, useEffect, useCallback } from 'react';
import { PPGSignalProcessor } from '../../modules/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../../types/signal-processor';
import { DETECTION_CONFIG } from './constants';
import { useDetectionState } from './useDetectionState';
import { useRobustDetection } from './useRobustDetection';
import { useSignalStats } from './useSignalStats';

export const useSignalProcessor = () => {
  // Processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creating new instance", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Processor state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  
  // Detection state
  const {
    qualityHistoryRef,
    fingerDetectedHistoryRef,
    consecutiveNonDetectionRef,
    detectionThresholdRef,
    adaptiveCounterRef,
    signalLockCounterRef,
    resetDetectionState
  } = useDetectionState(DETECTION_CONFIG);
  
  // Signal statistics
  const { signalStats, resetStats, updateStats } = useSignalStats();
  
  // Robust detection
  const { processRobustFingerDetection } = useRobustDetection(
    DETECTION_CONFIG,
    qualityHistoryRef,
    fingerDetectedHistoryRef,
    consecutiveNonDetectionRef,
    detectionThresholdRef,
    adaptiveCounterRef,
    signalLockCounterRef
  );

  // Set up callbacks and cleanup
  useEffect(() => {
    // Callback when signal is ready
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update statistics
      updateStats(modifiedSignal.filteredValue);
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Processing error:", error);
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Initialization error:", error);
    });

    // Cleanup when unmounting
    return () => {
      processor.stop();
    };
  }, [processor, processRobustFingerDetection, updateStats]);

  /**
   * Start signal processing
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Starting processing");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    resetStats();
    
    // Reset adaptive variables
    resetDetectionState();
    
    processor.start();
  }, [processor, resetDetectionState, resetStats]);

  /**
   * Stop signal processing
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Stopping processing");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Reset all processing state
   */
  const resetProcessing = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Resetting all processing state");
      
      // Reset detection state
      resetDetectionState();
      
      // For PPGSignalProcessor's reset method
      if (typeof processor.reset === 'function') {
        processor.reset();
      } else {
        // Fallback if reset isn't available
        processor.stop();
        processor.initialize();
      }
      
      console.log("useSignalProcessor: Reset successful");
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Reset error:", error);
      return false;
    }
  }, [processor, resetDetectionState]);

  /**
   * Process an image frame
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error processing frame:", err);
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
    resetProcessing,
    processFrame
  };
};
