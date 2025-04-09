
import { useCallback, useRef } from 'react';
import { HeartBeatResult } from './types';
import { HeartBeatConfig } from '../../modules/heart-beat/config';
import * as tf from '@tensorflow/tfjs';
import { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult, 
  handlePeakDetection,
  updateLastValidBpm,
  processLowConfidenceResult
} from './signal-processing';

export function useSignalProcessor() {
  const lastPeakTimeRef = useRef<number | null>(null);
  const consistentBeatsCountRef = useRef<number>(0);
  const lastValidBpmRef = useRef<number>(0);
  const calibrationCounterRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const signalBufferRef = useRef<number[]>([]);
  const tfModelRef = useRef<tf.Sequential | null>(null);
  
  // Simple reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD; 
  const MAX_CONSECUTIVE_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;

  // TensorFlow-enhanced signal processing
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
      calibrationCounterRef.current++;
      
      // Store signal in buffer for TensorFlow processing
      signalBufferRef.current.push(value);
      if (signalBufferRef.current.length > 30) {
        signalBufferRef.current.shift();
      }
      
      // Check for weak signal
      const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
        value, 
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
      if (!shouldProcessMeasurement(value)) {
        return createWeakSignalResult(processor.getArrhythmiaCounter());
      }
      
      // Apply TensorFlow filtering if we have enough data and TF is available
      let processedValue = value;
      if (signalBufferRef.current.length >= 10 && typeof tf !== 'undefined') {
        try {
          const recentValues = signalBufferRef.current.slice(-10);
          
          // Create tensor
          const signalTensor = tf.tensor1d(recentValues);
          
          // Apply moving average filter using TensorFlow ops
          const result = tf.tidy(() => {
            // Create a kernel for moving average
            const kernelSize = 5;
            const kernel = tf.ones([kernelSize]).div(tf.scalar(kernelSize));
            
            // Pad the signal for convolution
            const paddedSignal = tf.pad(signalTensor, [[Math.floor(kernelSize/2), 
                                                      Math.floor(kernelSize/2)]]);
            
            // Apply convolution for filtering - fixing the tensor type issue
            const filtered = tf.conv1d(
              // Explicitly reshape to 3D tensor with correct shape
              paddedSignal.reshape([1, paddedSignal.shape[0], 1]) as tf.Tensor3D,
              kernel.reshape([kernelSize, 1, 1]) as tf.Tensor3D,
              1, 'valid'
            );
            
            // Get the filtered result
            return filtered.reshape([recentValues.length]).arraySync();
          });
          
          // Use the last value from the filtered result
          // Fix the type issue by ensuring we get a single number
          const resultArray = result as number[];
          processedValue = resultArray[resultArray.length - 1];
          
          // Clean up tensors
          signalTensor.dispose();
        } catch (tfError) {
          console.warn('TensorFlow filtering failed, using original value', tfError);
          processedValue = value;
        }
      }
      
      // Process signal with enhanced value
      const result = processor.processSignal(processedValue);
      const rrData = processor.getRRIntervals();
      
      if (rrData && rrData.intervals.length > 0) {
        lastRRIntervalsRef.current = [...rrData.intervals];
      }
      
      // Handle peak detection
      handlePeakDetection(
        result, 
        lastPeakTimeRef, 
        requestImmediateBeep, 
        isMonitoringRef,
        processedValue
      );
      
      // Update last valid BPM if it's reasonable
      updateLastValidBpm(result, lastValidBpmRef);
      
      lastSignalQualityRef.current = result.confidence;

      // Process result
      return processLowConfidenceResult(
        result, 
        currentBPM, 
        processor.getArrhythmiaCounter()
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
        }
      };
    }
  }, []);

  // Reset processor state
  const reset = useCallback(() => {
    lastPeakTimeRef.current = null;
    consistentBeatsCountRef.current = 0;
    lastValidBpmRef.current = 0;
    calibrationCounterRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    signalBufferRef.current = [];
    
    // Clean up TensorFlow resources
    if (tfModelRef.current) {
      tfModelRef.current.dispose();
      tfModelRef.current = null;
    }
    
    // Dispose any lingering tensors
    if (typeof tf !== 'undefined') {
      try {
        tf.dispose();
      } catch (error) {
        console.warn('Error disposing TensorFlow resources', error);
      }
    }
  }, []);

  return {
    processSignal,
    reset,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}
