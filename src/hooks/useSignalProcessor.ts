
import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedSignal, ProcessingError } from '@/types/signal';
import { PPGProcessor } from '@/core/signal/PPGProcessor';
import { useSignalQualityDetector } from './vital-signs/use-signal-quality-detector';

/**
 * Hook for processing PPG signals from camera frames
 * Only processes real data, no simulation
 */
export function useSignalProcessor() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const processorRef = useRef<PPGProcessor | null>(null);
  
  // Use our specialized signal quality detector
  const { 
    updateQuality, 
    detectWeakSignal, 
    isFingerDetected, 
    reset: resetSignalDetector 
  } = useSignalQualityDetector();

  // Initialize the processor once
  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new PPGProcessor(
        // Signal ready callback
        (signal: ProcessedSignal) => {
          const isWeak = detectWeakSignal(signal.filteredValue);
          
          // Enhance the signal with finger detection
          const enhancedSignal: ProcessedSignal = {
            ...signal,
            fingerDetected: !isWeak && isFingerDetected()
          };
          
          setLastSignal(enhancedSignal);
          
          // Log periodically for debugging
          if (Math.random() < 0.01) { // Log approximately 1% of signals
            console.log("Signal processor:", {
              quality: signal.quality,
              fingerDetected: enhancedSignal.fingerDetected,
              value: signal.filteredValue,
              isWeak
            });
          }
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
  }, [detectWeakSignal, isFingerDetected]);

  // Start processing
  const startProcessing = useCallback(async () => {
    if (!processorRef.current) return;
    
    try {
      resetSignalDetector();
      await processorRef.current.calibrate();
      processorRef.current.start();
      setIsProcessing(true);
      setError(null);
      console.log("Signal processor: Processing started");
    } catch (err) {
      console.error("Failed to start signal processing:", err);
      setError({
        code: "START_ERROR",
        message: "Failed to start signal processing"
      });
    }
  }, [resetSignalDetector]);

  // Stop processing
  const stopProcessing = useCallback(() => {
    if (!processorRef.current) return;
    
    processorRef.current.stop();
    resetSignalDetector();
    setIsProcessing(false);
    console.log("Signal processor: Processing stopped");
  }, [resetSignalDetector]);

  // Process a single frame
  const processFrame = useCallback((imageData: ImageData) => {
    if (!processorRef.current || !isProcessing) return;
    
    try {
      processorRef.current.processFrame(imageData);
    } catch (error) {
      console.error("Error processing frame:", error);
    }
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
