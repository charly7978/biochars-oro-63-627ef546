
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

interface ProcessorConfig {
  fingerDetectionThreshold?: number;
  minSignalQuality?: number;
  adaptiveSensitivity?: boolean;
  enhancedProcessing?: boolean;
}

export const useSignalProcessor = () => {
  // Use lazy initialization for processor to avoid unnecessary instantiation
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  
  // Create processor on first use, not during component initialization
  const getProcessor = () => {
    if (!processorRef.current) {
      console.log("useSignalProcessor: Creating new processor instance", {
        timestamp: new Date().toISOString(),
        sessionId: Math.random().toString(36).substring(2, 9)
      });
      
      processorRef.current = new PPGSignalProcessor();
    }
    return processorRef.current;
  };
  
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
  
  // Use fixed-size arrays for history to prevent unbounded growth
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5; // Window size for averaging
  
  // Use a debounce mechanism to batch updates and reduce processing frequency
  const throttleTimerRef = useRef<number | null>(null);
  const pendingSignalRef = useRef<ProcessedSignal | null>(null);
  
  // Batch process signals to reduce UI updates
  const processPendingSignal = useCallback(() => {
    if (pendingSignalRef.current) {
      const signal = pendingSignalRef.current;
      pendingSignalRef.current = null;
      
      const modifiedSignal = processRobustFingerDetection(signal);
      
      console.log("useSignalProcessor: Processed signal:", {
        timestamp: modifiedSignal.timestamp,
        formattedTime: new Date(modifiedSignal.timestamp).toISOString(),
        quality: modifiedSignal.quality.toFixed(1),
        rawQuality: signal.quality.toFixed(1),
        rawValue: modifiedSignal.rawValue.toFixed(3),
        filteredValue: modifiedSignal.filteredValue.toFixed(3),
        fingerDetected: modifiedSignal.fingerDetected,
        originalFingerDetected: signal.fingerDetected,
        processingTime: Date.now() - modifiedSignal.timestamp
      });
      
      // Update state in one batch to reduce renders
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
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
    }
  }, []);
  
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = index + 1; // More weight to recent samples
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    // Use a more demanding threshold for robust detection (3 of 5 = 0.6)
    const robustFingerDetected = detectionRatio >= 0.6;
    
    // Slight quality enhancement for better user experience
    const enhancedQuality = Math.min(100, avgQuality * 1.1);
    
    console.log("useSignalProcessor: Robust detection", {
      original: signal.fingerDetected,
      robust: robustFingerDetected,
      detectionRatio,
      trueCount,
      historyLength: fingerDetectedHistoryRef.current.length,
      originalQuality: signal.quality,
      enhancedQuality,
      rawValue: signal.rawValue.toFixed(2),
      filteredValue: signal.filteredValue.toFixed(2)
    });
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, []);

  useEffect(() => {
    const processor = getProcessor();
    
    console.log("useSignalProcessor: Setting up callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Store the signal for batched processing
      pendingSignalRef.current = signal;
      
      // Cancel any pending timer
      if (throttleTimerRef.current) {
        cancelAnimationFrame(throttleTimerRef.current);
      }
      
      // Schedule processing on next animation frame to batch multiple signals
      throttleTimerRef.current = requestAnimationFrame(() => {
        processPendingSignal();
        throttleTimerRef.current = null;
      });
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Detailed error:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      setError(error);
    };

    console.log("useSignalProcessor: Starting processor", {
      timestamp: new Date().toISOString()
    });
    
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Initialization error details:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    return () => {
      console.log("useSignalProcessor: Cleaning up", {
        framesProcessed: framesProcessed,
        lastSignal: lastSignal ? {
          quality: lastSignal.quality,
          fingerDetected: lastSignal.fingerDetected
        } : null,
        timestamp: new Date().toISOString()
      });
      
      // Cancel any pending processing
      if (throttleTimerRef.current) {
        cancelAnimationFrame(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      
      // Clear any pending signals
      pendingSignalRef.current = null;
      
      // Stop processor
      processor.stop();
      
      // Clear history buffers
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
    };
  }, [processPendingSignal, framesProcessed, lastSignal]);

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
    
    // Clear history buffers
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    
    // Clear any pending signals
    pendingSignalRef.current = null;
    
    // Start processor
    getProcessor().start();
  }, [isProcessing]);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Stopping processing", {
      previousState: isProcessing,
      framesProcessed: framesProcessed,
      finalStats: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    
    // Cancel any pending processing
    if (throttleTimerRef.current) {
      cancelAnimationFrame(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    
    // Clear any pending signals
    pendingSignalRef.current = null;
    
    // Stop processor
    getProcessor().stop();
  }, [isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Starting calibration", {
        timestamp: new Date().toISOString()
      });
      
      await getProcessor().calibrate();
      
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
  }, []);

  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        getProcessor().processFrame(imageData);
        // Don't update framesProcessed on every frame to reduce state updates
        // Only update in batches via the onSignalReady callback
      } catch (err) {
        console.error("useSignalProcessor: Error processing frame:", err);
      }
    }
  }, [isProcessing]);

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
