
import { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';

// Define the response from the signal processor
export interface ProcessedSignalResult {
  filtered: number;
  heartRate: {
    bpm: number;
    confidence: number;
  } | null;
  spo2: number | null;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  } | null;
  arrhythmia: boolean;
  calibration: {
    isCalibrating: boolean;
    progress: number;
    remainingTime: number;
  } | null;
  processingTime: number;
}

// Define the hook return type
export interface UseUnifiedSignalProcessorReturn {
  isInitialized: boolean;
  isProcessing: boolean;
  lastResult: ProcessedSignalResult | null;
  processSignal: (value: number) => void;
  processFrame: (imageData: ImageData) => void;
  startCalibration: () => void;
  reset: () => void;
  updateConfig: (config: Partial<ProcessorConfig>) => void;
  error: Error | null;
  stats: {
    avgProcessingTime: number;
    totalProcessed: number;
    bufferFullness: number;
  };
}

/**
 * Hook for unified signal processing with WebWorker and TensorFlow.js
 */
export const useUnifiedSignalProcessor = (
  initialConfig?: Partial<ProcessorConfig>
): UseUnifiedSignalProcessorReturn => {
  // State
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ProcessedSignalResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState({
    avgProcessingTime: 0,
    totalProcessed: 0,
    bufferFullness: 0
  });
  
  // Refs
  const workerRef = useRef<Worker | null>(null);
  const configRef = useRef<ProcessorConfig>({
    ...DEFAULT_PROCESSOR_CONFIG,
    ...initialConfig
  });
  const processingTimesRef = useRef<number[]>([]);
  const bufferRef = useRef<number[]>([]);
  const totalProcessedRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  
  /**
   * Initialize the worker
   */
  const initWorker = useCallback(() => {
    try {
      // Clean up existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      
      console.log('Initializing signal processor worker');
      
      // Create new worker
      workerRef.current = new Worker(
        new URL('../workers/unified-signal-processor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Set up message handler
      workerRef.current.onmessage = (event) => {
        const { type, payload, error: workerError, processingTime } = event.data;
        
        switch (type) {
          case 'INITIALIZED':
            console.log('Worker initialized:', payload);
            setIsInitialized(true);
            isInitializedRef.current = true;
            setError(null);
            break;
            
          case 'SIGNAL_PROCESSED':
          case 'FRAME_PROCESSED':
            // Update last result
            setLastResult(payload);
            
            // Update stats
            if (processingTime) {
              processingTimesRef.current.push(processingTime);
              if (processingTimesRef.current.length > 50) {
                processingTimesRef.current.shift();
              }
              
              const avgTime = processingTimesRef.current.reduce((a, b) => a + b, 0) / 
                            processingTimesRef.current.length;
              
              totalProcessedRef.current++;
              
              setStats({
                avgProcessingTime: avgTime,
                totalProcessed: totalProcessedRef.current,
                bufferFullness: bufferRef.current.length / configRef.current.bufferSize
              });
            }
            break;
            
          case 'ERROR':
            console.error('Worker error:', workerError);
            setError(new Error(workerError));
            break;
            
          default:
            console.log('Worker message:', type, payload);
        }
      };
      
      // Handle worker errors
      workerRef.current.onerror = (e) => {
        console.error('Worker error event:', e);
        setError(new Error('Worker error: ' + e.message));
      };
      
      // Initialize worker with config
      workerRef.current.postMessage({
        type: 'INITIALIZE',
        config: configRef.current
      });
      
    } catch (err) {
      console.error('Failed to initialize worker:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize worker'));
    }
  }, []);
  
  // Initialize worker on mount
  useEffect(() => {
    initWorker();
    
    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [initWorker]);
  
  /**
   * Process a single signal value
   */
  const processSignal = useCallback((value: number) => {
    if (!workerRef.current || !isInitializedRef.current) {
      if (!isInitializedRef.current) {
        initWorker();
      }
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Add to buffer
      bufferRef.current.push(value);
      if (bufferRef.current.length > configRef.current.bufferSize) {
        bufferRef.current.shift();
      }
      
      // Send to worker
      workerRef.current.postMessage({
        type: 'PROCESS_SIGNAL',
        payload: value
      });
    } catch (err) {
      console.error('Error processing signal:', err);
      setError(err instanceof Error ? err : new Error('Error processing signal'));
    }
  }, [initWorker]);
  
  /**
   * Process an image frame
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!workerRef.current || !isInitializedRef.current) {
      if (!isInitializedRef.current) {
        initWorker();
      }
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Send to worker
      workerRef.current.postMessage({
        type: 'PROCESS_FRAME',
        payload: imageData
      }, [imageData.data.buffer]);
    } catch (err) {
      console.error('Error processing frame:', err);
      setError(err instanceof Error ? err : new Error('Error processing frame'));
    }
  }, [initWorker]);
  
  /**
   * Start calibration process
   */
  const startCalibration = useCallback(() => {
    if (!workerRef.current || !isInitializedRef.current) {
      return;
    }
    
    workerRef.current.postMessage({
      type: 'CALIBRATE'
    });
  }, []);
  
  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    if (!workerRef.current) {
      return;
    }
    
    workerRef.current.postMessage({
      type: 'RESET'
    });
    
    bufferRef.current = [];
    processingTimesRef.current = [];
    totalProcessedRef.current = 0;
    setLastResult(null);
    setStats({
      avgProcessingTime: 0,
      totalProcessed: 0,
      bufferFullness: 0
    });
  }, []);
  
  /**
   * Update processor configuration
   */
  const updateConfig = useCallback((newConfig: Partial<ProcessorConfig>) => {
    configRef.current = {
      ...configRef.current,
      ...newConfig
    };
    
    if (workerRef.current && isInitializedRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_CONFIG',
        config: newConfig
      });
    }
  }, []);
  
  return {
    isInitialized,
    isProcessing,
    lastResult,
    processSignal,
    processFrame,
    startCalibration,
    reset,
    updateConfig,
    error,
    stats
  };
};
