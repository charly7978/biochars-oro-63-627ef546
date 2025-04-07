
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import { ProcessedSignal } from '../types/signal';

/**
 * Hook for processing camera frames to extract PPG signal
 */
export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const processorRef = useRef<SignalProcessor | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const framesProcessedRef = useRef<number>(0);
  
  // Initialize processor on mount
  useEffect(() => {
    processorRef.current = new SignalProcessor();
    console.log("Signal processor initialized");
    
    return () => {
      console.log("Signal processor cleanup");
    };
  }, []);
  
  /**
   * Start processing frames
   */
  const startProcessing = useCallback(() => {
    console.log("Starting signal processing");
    isProcessingRef.current = true;
  }, []);
  
  /**
   * Stop processing frames
   */
  const stopProcessing = useCallback(() => {
    console.log("Stopping signal processing");
    isProcessingRef.current = false;
  }, []);
  
  /**
   * Process an image frame to extract PPG signal
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current || !isProcessingRef.current) {
      return;
    }
    
    framesProcessedRef.current++;
    
    try {
      // Apply simple filtering
      const { filteredValue, quality, fingerDetected } = 
        processorRef.current.applyFilters(0);
      
      const signal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: 0,
        filteredValue,
        quality,
        fingerDetected,
        roi: { x: 0, y: 0, width: 0, height: 0 },
        perfusionIndex: 0
      };
      
      setLastSignal(signal);
      
      // Log occasional debug information
      if (framesProcessedRef.current % 100 === 0) {
        console.log("Processed 100 frames:", {
          quality,
          fingerDetected
        });
      }
      
    } catch (error) {
      console.error("Error processing frame:", error);
    }
  }, []);
  
  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setLastSignal(null);
    framesProcessedRef.current = 0;
  }, []);
  
  return {
    startProcessing,
    stopProcessing,
    processFrame,
    lastSignal,
    reset
  };
};
