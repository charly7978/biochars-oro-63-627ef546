
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { PPGProcessor } from '../core/signal/PPGProcessor';

/**
 * Hook for processing PPG signals
 * Simplified implementation focusing on stability
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creating new instance with basic capabilities", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGProcessor();
  });
  
  // Basic state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  
  // Simple stats for basic signal quality assessment
  const [signalStats, setSignalStats] = useState({
    red: {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    }
  });

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Simple signal callback
    processor.onSignalReady = (signal: ProcessedSignal) => {
      setLastSignal(signal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Basic signal statistics
      setSignalStats(prev => {
        return {
          red: {
            minValue: Math.min(prev.red.minValue, signal.filteredValue),
            maxValue: Math.max(prev.red.maxValue, signal.filteredValue),
            avgValue: (prev.red.avgValue * prev.red.totalValues + signal.filteredValue) / (prev.red.totalValues + 1),
            totalValues: prev.red.totalValues + 1
          }
        };
      });
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error in processing:", error);
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error initializing:", error);
    });

    // Cleanup
    return () => {
      processor.stop();
    };
  }, [processor]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Starting processing");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      red: { minValue: Infinity, maxValue: -Infinity, avgValue: 0, totalValues: 0 }
    });
    
    processor.start();
  }, [processor]);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Stopping processing");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Process a frame from camera
   * Simple implementation without complex algorithms
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
    processFrame
  };
};
