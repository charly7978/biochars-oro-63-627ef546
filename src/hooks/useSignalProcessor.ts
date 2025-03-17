
import { useState, useEffect, useRef, useCallback } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal } from '../types/signal';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';

export const useSignalProcessor = (sharedSignalProcessor?: SignalProcessor) => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  
  // Use the shared signal processor if provided
  const signalProcessorRef = useRef<SignalProcessor>(sharedSignalProcessor || new SignalProcessor());
  
  // Create processor instance
  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new PPGSignalProcessor(
        (signal: ProcessedSignal) => {
          setLastSignal(signal);
          
          // Pass filtered value to shared signal processor only if finger is detected
          if (signal.fingerDetected && Math.abs(signal.filteredValue) > 0.005) {
            // This is for visualization only - we won't trigger peak detection here
            // we'll just store the value for visualization
            if (signalProcessorRef.current && !sharedSignalProcessor) {
              signalProcessorRef.current.addValue(signal.filteredValue);
            }
          }
        },
        (error) => {
          console.error("Signal processing error:", error);
        }
      );
    }
    
    if (sharedSignalProcessor) {
      signalProcessorRef.current = sharedSignalProcessor;
    }
    
    return () => {
      // Cleanup
      if (processorRef.current) {
        processorRef.current.stop();
        processorRef.current = null;
      }
    };
  }, [sharedSignalProcessor]);
  
  const startProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.start();
      isProcessingRef.current = true;
      
      // Reset the signal processor
      signalProcessorRef.current.reset();
    }
  }, []);
  
  const stopProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.stop();
      isProcessingRef.current = false;
      setLastSignal(null);
    }
  }, []);
  
  const processFrame = useCallback((imageData: ImageData) => {
    if (processorRef.current && isProcessingRef.current) {
      processorRef.current.processFrame(imageData);
    }
  }, []);
  
  return {
    lastSignal,
    startProcessing,
    stopProcessing,
    processFrame,
    isProcessing: isProcessingRef.current,
    // Expose the signal processor for PPG rendering
    signalProcessor: signalProcessorRef.current
  };
};
