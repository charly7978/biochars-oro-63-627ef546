
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/PPGSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal-processor';

/**
 * Hook for managing PPG signal processing
 */
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
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  // References for history and stabilization
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5;
  
  // Variables for adaptive handling
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.45);
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 40;
  const MIN_DETECTION_THRESHOLD = 0.30;
  
  // Counter to avoid rapid signal losses
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 4;
  const RELEASE_GRACE_PERIOD = 3;

  /**
   * Process finger detection robustly and adaptively
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Update histories
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calculate detection ratio
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calculate weighted quality (more weight to recent values)
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.2, index);
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Adaptive logic to adjust threshold
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.8;
      const consistentNonDetection = rawDetectionRatio < 0.2;
      
      if (consistentNonDetection) {
        // Make detection easier
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.08
        );
      } else if (consistentDetection && avgQuality < 35) {
        // Be more strict with detection but low quality
        detectionThresholdRef.current = Math.min(
          0.6,
          detectionThresholdRef.current + 0.05
        );
      }
    }
    
    // "Lock-in" logic for stability
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
    
    // Final determination
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    const robustFingerDetected = isLockedIn || rawDetectionRatio >= currentThreshold;
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: signal.quality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);

  // Set up callbacks and cleanup
  useEffect(() => {
    // Callback when signal is ready
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update statistics
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
  }, [processor, processRobustFingerDetection]);

  /**
   * Start signal processing
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Starting processing");
    
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
   * Stop signal processing
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Stopping processing");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Calibrate the processor for better results
   */
  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Starting calibration");
      
      // Reset adaptive counters
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = 0;
      detectionThresholdRef.current = 0.40;
      adaptiveCounterRef.current = 0;
      
      await processor.calibrate();
      
      console.log("useSignalProcessor: Calibration successful");
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Calibration error:", error);
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
    calibrate,
    processFrame
  };
};
