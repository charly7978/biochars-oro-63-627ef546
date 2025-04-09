
import { useCallback, useRef, useEffect } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

// Enhanced device capability detection for adaptive processing
const detectDeviceCapabilities = (): { 
  isLowPower: boolean, 
  refreshInterval: number,
  bufferSize: number,
  useFloat32Arrays: boolean,
  useInlineProcessing: boolean,
  useDedicatedWorker: boolean,
  samplingRate: number
} => {
  // Check for low-end device indicators
  const isLowMemory = (navigator as any).deviceMemory !== undefined && 
                     (navigator as any).deviceMemory < 4;
  const isSlowCPU = (navigator as any).hardwareConcurrency !== undefined && 
                    (navigator as any).hardwareConcurrency < 4;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  
  // Check for high-end device capability
  const isHighEndDevice = (navigator as any).hardwareConcurrency !== undefined && 
                         (navigator as any).hardwareConcurrency >= 8 &&
                         (navigator as any).deviceMemory !== undefined && 
                         (navigator as any).deviceMemory >= 8;
  
  const isLowPower = (isLowMemory || isSlowCPU) && isMobile;
  const isHighPower = isHighEndDevice && !isMobile;
  
  // Set appropriate refresh interval based on device capability
  const refreshInterval = isLowPower ? 50 : isHighPower ? 25 : 33; 
  
  // Set buffer size based on device capability
  const bufferSize = isLowPower ? 128 : isHighPower ? 512 : 256;
  
  // Determine if we should use Float32Arrays for better performance
  const useFloat32Arrays = !isLowPower;
  
  // Determine if we should use inline processing or web workers
  const useInlineProcessing = isLowPower || isIOS; // iOS has issues with workers
  
  // Determine if we should use a dedicated worker
  const useDedicatedWorker = !useInlineProcessing && 
                           (isHighPower || (!isLowPower && !isIOS && !isAndroid));
  
  // Determine optimal sampling rate
  const samplingRate = isLowPower ? 20 : isHighPower ? 40 : 30;
  
  return { 
    isLowPower, 
    refreshInterval, 
    bufferSize,
    useFloat32Arrays,
    useInlineProcessing,
    useDedicatedWorker,
    samplingRate
  };
};

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  
  // Simple reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  // Optimized signal processing with adaptive parameters
  const samplingBufferRef = useRef<number[]>([]);
  const samplingIntervalRef = useRef<number>(0);
  const lastSamplingTimeRef = useRef<number>(0);
  const processingTimingRef = useRef<{
    lastProcessed: number,
    processingTimes: number[],
    bufferFullness: number
  }>({
    lastProcessed: 0,
    processingTimes: [],
    bufferFullness: 0
  });
  
  // Web Worker reference
  const workerRef = useRef<Worker | null>(null);
  const isWorkerAvailableRef = useRef<boolean>(true);
  const deviceCapabilitiesRef = useRef(detectDeviceCapabilities());
  
  // Performance optimization - prefiltered buffers
  const filteredBufferRef = useRef<Float32Array | number[]>(
    deviceCapabilitiesRef.current.useFloat32Arrays 
      ? new Float32Array(deviceCapabilitiesRef.current.bufferSize) 
      : []
  );
  const filteredBufferIndexRef = useRef<number>(0);
  
  // Initialize worker if supported
  const initWorker = useCallback(() => {
    const { useDedicatedWorker } = deviceCapabilitiesRef.current;
    
    if (!useDedicatedWorker || typeof Worker === 'undefined') {
      console.log(
        useDedicatedWorker 
          ? 'Web Workers not supported in this browser, falling back to main thread processing' 
          : 'Using inline processing for optimal performance on this device'
      );
      isWorkerAvailableRef.current = false;
      return;
    }
    
    try {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      
      workerRef.current = new Worker(new URL('../../workers/signal-processor.worker.ts', import.meta.url), { type: 'module' });
      
      // Configure worker with device-specific settings
      workerRef.current.postMessage({
        type: 'INIT',
        config: {
          bufferSize: deviceCapabilitiesRef.current.bufferSize,
          samplingRate: deviceCapabilitiesRef.current.samplingRate,
          useFloat32Arrays: deviceCapabilitiesRef.current.useFloat32Arrays,
          weakSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxConsecutiveWeakSignals: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      });
      
      workerRef.current.onmessage = (event) => {
        // Handle worker messages here if needed
        if (event.data.type === 'ERROR') {
          console.error('Worker error:', event.data.error);
          isWorkerAvailableRef.current = false; // Fall back to main thread on error
        } else if (event.data.type === 'PERFORMANCE') {
          // Track worker performance
          processingTimingRef.current.processingTimes.push(event.data.processingTime);
          if (processingTimingRef.current.processingTimes.length > 10) {
            processingTimingRef.current.processingTimes.shift();
          }
          processingTimingRef.current.bufferFullness = event.data.bufferFullness;
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Worker initialization error:', error);
        isWorkerAvailableRef.current = false; // Fall back to main thread on error
      };
      
      console.log('Signal processor worker initialized');
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      isWorkerAvailableRef.current = false;
    }
  }, []);

  // Set up worker on component mount
  useEffect(() => {
    initWorker();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [initWorker]);
  
  // Optimized filter implementation
  const filterSignal = useCallback((value: number): number => {
    const { bufferSize, useFloat32Arrays } = deviceCapabilitiesRef.current;
    
    // Simple low-pass filter for noise reduction
    if (filteredBufferIndexRef.current === 0) {
      // Initialize buffer with current value
      if (useFloat32Arrays) {
        (filteredBufferRef.current as Float32Array).fill(value);
      } else {
        filteredBufferRef.current = Array(bufferSize).fill(value);
      }
    }
    
    // Update buffer using circular buffering
    if (useFloat32Arrays) {
      (filteredBufferRef.current as Float32Array)[filteredBufferIndexRef.current] = value;
    } else {
      (filteredBufferRef.current as number[])[filteredBufferIndexRef.current] = value;
    }
    
    filteredBufferIndexRef.current = (filteredBufferIndexRef.current + 1) % bufferSize;
    
    // Apply exponential moving average filter
    const ALPHA = 0.3; // Filter strength
    
    let filteredValue: number;
    if (useFloat32Arrays) {
      const prevIndex = (filteredBufferIndexRef.current - 2 + bufferSize) % bufferSize;
      const prevValue = (filteredBufferRef.current as Float32Array)[prevIndex];
      filteredValue = prevValue * (1 - ALPHA) + value * ALPHA;
    } else {
      const prevIndex = (filteredBufferIndexRef.current - 2 + bufferSize) % bufferSize;
      const prevValue = (filteredBufferRef.current as number[])[prevIndex];
      filteredValue = prevValue * (1 - ALPHA) + value * ALPHA;
    }
    
    return filteredValue;
  }, []);

  const processSignal = useCallback((
    value: number,
    currentBPM: number,
    confidence: number,
    processor: any,
    requestImmediateBeep: (value: number) => boolean,
    isMonitoringRef: React.MutableRefObject<boolean>,
    lastRRIntervalsRef: React.MutableRefObject<number[]>,
    currentBeatIsArrhythmiaRef: React.MutableRefObject<boolean>
  ): HeartBeatResult => {
    if (!processor) {
      return createWeakSignalResult();
    }

    try {
      // Apply optimized signal flow based on device capabilities
      const { useInlineProcessing, refreshInterval } = deviceCapabilitiesRef.current;
      
      // Performance timing
      const startTime = performance.now();
      
      // Apply filtering
      const filteredValue = filterSignal(value);
      
      // Increment calibration counter
      calibrationCounterRef.current++;
      
      // Check for weak signal
      const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
        filteredValue, 
        consecutiveWeakSignalsRef.current, 
        {
          lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
          maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
        }
      );
      
      consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
      
      if (isWeakSignal) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Only process signals with sufficient amplitude
      if (!shouldProcessMeasurement(filteredValue)) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Add to sampling buffer with timing control
      const now = performance.now();
      const timeSinceLastSample = now - lastSamplingTimeRef.current;
      
      if (timeSinceLastSample >= samplingIntervalRef.current || samplingBufferRef.current.length === 0) {
        samplingBufferRef.current.push(filteredValue);
        lastSamplingTimeRef.current = now;
        
        // Adjust sampling interval based on processing performance
        if (processingTimingRef.current.processingTimes.length > 5) {
          const avgProcessingTime = processingTimingRef.current.processingTimes.reduce((a, b) => a + b, 0) / 
                                  processingTimingRef.current.processingTimes.length;
          
          // Adaptive sampling rate based on processing time
          samplingIntervalRef.current = Math.max(refreshInterval, avgProcessingTime * 1.2);
        } else {
          samplingIntervalRef.current = refreshInterval;
        }
      }
      
      // Throttle processing if buffer isn't full enough
      if (samplingBufferRef.current.length < 5 && lastValidBpmRef.current > 0) {
        // Return last valid result if not enough samples yet
        return {
          bpm: lastValidBpmRef.current,
          confidence: Math.max(0.5, confidence * 0.9),
          isPeak: false,
          arrhythmiaCount: processor.getArrhythmiaCounter(),
          rrData: {
            intervals: lastRRIntervalsRef.current,
            lastPeakTime: lastPeakTimeRef.current
          },
          isArrhythmia: false
        };
      }
      
      // Process signal - direct or via worker
      let result;
      if (useInlineProcessing || !isWorkerAvailableRef.current || !workerRef.current) {
        // Direct processing on main thread
        result = processor.processSignal(filteredValue);
        
        if (result && result.isPeak) {
          lastPeakTimeRef.current = now;
        }
      } else {
        // Worker-based processing
        // For simplicity, we're still using the direct method but would handle async processing
        result = processor.processSignal(filteredValue);
        
        if (result && result.isPeak) {
          lastPeakTimeRef.current = now;
        }
      }
      
      // Get RR interval data
      const rrData = processor.getRRIntervals();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Handle peak detection for UI feedback
      handlePeakDetection(
        result, 
        lastPeakTimeRef, 
        requestImmediateBeep, 
        isMonitoringRef,
        filteredValue
      );
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      // Store signal quality
      lastSignalQualityRef.current = result.confidence;
      
      // Track processing time
      const processingTime = performance.now() - startTime;
      processingTimingRef.current.processingTimes.push(processingTime);
      if (processingTimingRef.current.processingTimes.length > 10) {
        processingTimingRef.current.processingTimes.shift();
      }
      processingTimingRef.current.lastProcessed = now;
      processingTimingRef.current.bufferFullness = samplingBufferRef.current.length;
      
      // Process result
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter(),
        rrData
      );
    } catch (error) {
      console.error('useHeartBeatProcessor: Error processing signal', error);
      return {
        bpm: currentBPM,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        },
        isArrhythmia: false
      };
    }
  }, [filterSignal]);

  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    samplingBufferRef.current = [];
    lastSamplingTimeRef.current = 0;
    filteredBufferIndexRef.current = 0;
    
    // Reset filtered buffer
    const { bufferSize, useFloat32Arrays } = deviceCapabilitiesRef.current;
    if (useFloat32Arrays) {
      filteredBufferRef.current = new Float32Array(bufferSize);
    } else {
      filteredBufferRef.current = [];
    }
    
    // Reset processing timing
    processingTimingRef.current = {
      lastProcessed: 0,
      processingTimes: [],
      bufferFullness: 0
    };
    
    // Reset worker if available
    if (workerRef.current && isWorkerAvailableRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
    }
    
    // Re-detect device capabilities on reset
    deviceCapabilitiesRef.current = detectDeviceCapabilities();
    
    // Reinitialize worker with new capabilities
    initWorker();
  }, [initWorker]);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    deviceCapabilities: deviceCapabilitiesRef.current,
    processingStats: processingTimingRef.current
  };
}
