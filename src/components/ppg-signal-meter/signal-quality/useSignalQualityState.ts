
/**
 * Hook for managing signal quality state
 */
import { useRef } from 'react';
import { SignalQualityState } from './types';
import { 
  QUALITY_DECAY_RATE, 
  QUALITY_HISTORY_SIZE,
  NOISE_BUFFER_SIZE,
  AMPLITUDE_HISTORY_SIZE,
  STABILITY_TIMEOUT_MS
} from './constants';

export function useSignalQualityState() {
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const signalAmplitudeHistoryRef = useRef<number[]>([]);
  const fingerprintConfidenceRef = useRef<number>(0);
  const detectionStabilityCounterRef = useRef<number>(0);
  const lastDetectionStateRef = useRef<boolean>(false);
  const noiseBufferRef = useRef<number[]>([]);
  const peakVarianceRef = useRef<number[]>([]);
  const lastStableDetectionTimeRef = useRef<number>(0);
  const derivativeBufferRef = useRef<number[]>([]);

  const updateQualityHistory = (quality: number, isFingerDetected: boolean) => {
    if (isFingerDetected && quality > 5) {
      qualityHistoryRef.current.push(quality);
    } else {
      qualityHistoryRef.current.push(Math.max(0, quality * QUALITY_DECAY_RATE));
    }
    
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
  };

  const updateAmplitudeHistory = (value: number, lastValue: number | null, baseline: number | null) => {
    if (lastValue !== null && baseline !== null) {
      const amplitude = Math.abs(lastValue - baseline);
      signalAmplitudeHistoryRef.current.push(amplitude);
      if (signalAmplitudeHistoryRef.current.length > AMPLITUDE_HISTORY_SIZE) {
        signalAmplitudeHistoryRef.current.shift();
      }
      
      noiseBufferRef.current.push(value);
      if (noiseBufferRef.current.length > NOISE_BUFFER_SIZE) {
        noiseBufferRef.current.shift();
      }
    }
  };
  
  const updateDerivativeBuffer = (value: number, lastValue: number | null) => {
    if (lastValue !== null) {
      const derivative = Math.abs(value - lastValue);
      derivativeBufferRef.current.push(derivative);
      if (derivativeBufferRef.current.length > NOISE_BUFFER_SIZE) {
        derivativeBufferRef.current.shift();
      }
    }
  };
  
  const updateDetectionStability = (isFingerDetected: boolean, quality: number) => {
    const now = Date.now();
    
    if (now - lastStableDetectionTimeRef.current > STABILITY_TIMEOUT_MS) {
      detectionStabilityCounterRef.current = 0;
      consecutiveFingerFramesRef.current = 0;
    }
    
    if (isFingerDetected) {
      if (quality > 55) {
        consecutiveFingerFramesRef.current++;
        detectionStabilityCounterRef.current = Math.min(10, detectionStabilityCounterRef.current + 0.5);
        
        if (detectionStabilityCounterRef.current >= 5) {
          lastStableDetectionTimeRef.current = now;
        }
      } else {
        consecutiveFingerFramesRef.current = Math.max(0, consecutiveFingerFramesRef.current - 0.3);
        detectionStabilityCounterRef.current = Math.max(0, detectionStabilityCounterRef.current - 0.7);
      }
    } else {
      consecutiveFingerFramesRef.current = Math.max(0, consecutiveFingerFramesRef.current - 1.5);
      detectionStabilityCounterRef.current = Math.max(0, detectionStabilityCounterRef.current - 1.2);
    }
    
    lastDetectionStateRef.current = isFingerDetected;
  };
  
  const updateConfidence = () => {
    const highQualityFrames = qualityHistoryRef.current.filter(q => q > 55);
    const detectionRatio = highQualityFrames.length / Math.max(1, qualityHistoryRef.current.length);
    fingerprintConfidenceRef.current = Math.min(1, detectionRatio * 1.3);
  };
  
  const reset = () => {
    signalAmplitudeHistoryRef.current = [];
    qualityHistoryRef.current = [];
    fingerprintConfidenceRef.current = 0;
    detectionStabilityCounterRef.current = 0;
    consecutiveFingerFramesRef.current = 0;
    noiseBufferRef.current = [];
    peakVarianceRef.current = [];
    derivativeBufferRef.current = [];
    lastStableDetectionTimeRef.current = 0;
  };
  
  return {
    qualityHistoryRef,
    consecutiveFingerFramesRef,
    signalAmplitudeHistoryRef,
    fingerprintConfidenceRef,
    detectionStabilityCounterRef,
    lastDetectionStateRef,
    noiseBufferRef,
    peakVarianceRef,
    lastStableDetectionTimeRef,
    derivativeBufferRef,
    updateQualityHistory,
    updateAmplitudeHistory,
    updateDerivativeBuffer,
    updateDetectionStability,
    updateConfidence,
    reset,
  };
}
