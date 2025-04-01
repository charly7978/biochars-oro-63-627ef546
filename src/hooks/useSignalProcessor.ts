
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { FingerDetectionSystem } from '../utils/signalProcessingUtils';

/**
 * Hook for managing PPG signal processing
 * Enhanced version with robust detection and adaptivity
 */
export const useSignalProcessor = () => {
  // Create a single processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creating new processor instance", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // State
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
  
  // References for history and stabilization
  const fingerDetectionSystemRef = useRef<FingerDetectionSystem>(new FingerDetectionSystem());
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 50; // Frames between adaptive adjustments
  
  /**
   * Process finger detection robustly and adaptively
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Get detection from the unified system
    const { fingerDetected, enhancedQuality } = fingerDetectionSystemRef.current.processDetection(
      signal.fingerDetected,
      signal.quality,
      Math.abs(signal.filteredValue)
    );
    
    // Periodically update detection thresholds
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      // Check for consistent detection patterns
      const status = fingerDetectionSystemRef.current.getStatus();
      const consistentDetection = status.detectionRatio > 0.8;
      const consistentNonDetection = status.detectionRatio < 0.2;
      
      // Update threshold based on detection patterns
      fingerDetectionSystemRef.current.updateDetectionThreshold(
        consistentDetection,
        consistentNonDetection,
        enhancedQuality
      );
    }
    
    // Return enhanced signal
    return {
      ...signal,
      fingerDetected: fingerDetected,
      quality: enhancedQuality,
      // Maintain perfusion index and spectrum data intact
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);

  // Set up callbacks and cleanup
  useEffect(() => {
    console.log("useSignalProcessor: Setting up callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    // Callback when signal is ready
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update statistics
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
          maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
        
        if (prev.totalValues % 50 === 0) {
          console.log("useSignalProcessor: Signal statistics:", newStats);
        }
        
        return newStats;
      });
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Detailed error:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Initialization error details:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Cleanup on unmount
    return () => {
      processor.stop();
    };
  }, [processor, processRobustFingerDetection]);

  /**
   * Start signal processing
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Starting processing", {
      previousState: isProcessing,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    // Reset finger detection system
    fingerDetectionSystemRef.current.reset();
    adaptiveCounterRef.current = 0;
    
    processor.start();
  }, [processor, isProcessing]);

  /**
   * Stop signal processing
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Stopping processing", {
      previousState: isProcessing,
      framesProcessed: framesProcessed,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processor.stop();
  }, [processor, isProcessing, framesProcessed]);

  /**
   * Calibrate processor for better results
   */
  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Starting calibration", {
        timestamp: new Date().toISOString()
      });
      
      // Reset adaptive systems during calibration
      fingerDetectionSystemRef.current.reset();
      adaptiveCounterRef.current = 0;
      
      await processor.calibrate();
      
      console.log("useSignalProcessor: Calibration successful", {
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Calibration error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }, [processor]);

  /**
   * Process an image frame
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
        setFramesProcessed(prev => prev + 1);
      } catch (err) {
        console.error("useSignalProcessor: Error processing frame:", err);
      }
    }
  }, [isProcessing, processor]);

  // Return the same public interface as before
  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame
  };
};
