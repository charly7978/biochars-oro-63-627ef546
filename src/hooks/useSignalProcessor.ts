
import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedSignal, ProcessingError } from '@/types/signal';
import { PPGProcessor } from '@/core/signal/PPGProcessor';

/**
 * Hook for processing PPG signals from camera frames
 * Only processes real data, no simulation
 */
export function useSignalProcessor() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const processorRef = useRef<PPGProcessor | null>(null);

  // Initialize the processor once
  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new PPGProcessor(
        // Signal ready callback
        (signal: ProcessedSignal) => {
          setLastSignal(signal);
        },
        // Error callback
        (err: ProcessingError) => {
          setError(err);
          console.error("Signal processing error:", err);
        }
      );
      
      // Initialize the processor
      processorRef.current.initialize().catch(err => {
        console.error("Failed to initialize signal processor:", err);
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (processorRef.current && isProcessing) {
        processorRef.current.stop();
      }
    };
  }, []);

  // Start processing
  const startProcessing = useCallback(async () => {
    if (!processorRef.current) return;
    
    try {
      await processorRef.current.calibrate();
      processorRef.current.start();
      setIsProcessing(true);
      setError(null);
    } catch (err) {
      console.error("Failed to start signal processing:", err);
      setError({
        code: "START_ERROR",
        message: "Failed to start signal processing",
        timestamp: Date.now()
      });
    }
  }, []);

  // Stop processing
  const stopProcessing = useCallback(() => {
    if (!processorRef.current) return;
    
    processorRef.current.stop();
    setIsProcessing(false);
  }, []);

  // Process a single frame
  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current || !isProcessing) return;
    
    processorRef.current.processFrame(imageData);
  }, [isProcessing]);

  return {
    startProcessing,
    stopProcessing,
    processFrame,
    lastSignal,
    error,
    isProcessing
  };
}
