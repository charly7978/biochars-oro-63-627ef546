
import { useRef, useCallback } from 'react';
import { 
  QUALITY_HISTORY_SIZE, 
  QUALITY_DECAY_RATE, 
  AMPLITUDE_HISTORY_SIZE, 
  MIN_AMPLITUDE_THRESHOLD,
  NOISE_BUFFER_SIZE, 
  MAX_NOISE_RATIO, 
  MIN_DERIVATIVE_THRESHOLD,
  REQUIRED_STABILITY_FRAMES,
  STABILITY_TIMEOUT_MS,
  REQUIRED_FINGER_FRAMES
} from './constants';

export function useSignalQuality() {
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

  const updateSignalQuality = useCallback((value: number, quality: number, isFingerDetected: boolean, lastValue: number | null, baseline: number | null) => {
    if (lastValue !== null) {
      const derivative = Math.abs(lastValue !== null ? value - lastValue : 0);
      derivativeBufferRef.current.push(derivative);
      if (derivativeBufferRef.current.length > NOISE_BUFFER_SIZE) {
        derivativeBufferRef.current.shift();
      }
    }
    
    if (isFingerDetected && quality > 5) {
      qualityHistoryRef.current.push(quality);
    } else {
      qualityHistoryRef.current.push(Math.max(0, quality * QUALITY_DECAY_RATE));
    }
    
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
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
    
    const now = Date.now();
    
    if (now - lastStableDetectionTimeRef.current > STABILITY_TIMEOUT_MS) {
      detectionStabilityCounterRef.current = 0;
      consecutiveFingerFramesRef.current = 0;
    }
    
    if (isFingerDetected) {
      if (quality > 55) {
        consecutiveFingerFramesRef.current++;
        detectionStabilityCounterRef.current = Math.min(10, detectionStabilityCounterRef.current + 0.5);
        
        if (detectionStabilityCounterRef.current >= REQUIRED_STABILITY_FRAMES) {
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
    
    const highQualityFrames = qualityHistoryRef.current.filter(q => q > 55);
    const detectionRatio = highQualityFrames.length / Math.max(1, qualityHistoryRef.current.length);
    fingerprintConfidenceRef.current = Math.min(1, detectionRatio * 1.3);
    
    lastDetectionStateRef.current = isFingerDetected;
  }, []);

  const calculateNoiseLevel = useCallback((values: number[]): number => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / (Math.abs(mean) + 0.001);
  }, []);

  const getAverageQuality = useCallback(() => {
    if (qualityHistoryRef.current.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    qualityHistoryRef.current.forEach((q, index) => {
      const weight = Math.pow(1.3, index);
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    let avgQuality = weightSum > 0 ? weightedSum / weightSum : 0;
    
    if (signalAmplitudeHistoryRef.current.length > 10) {
      const avgAmplitude = signalAmplitudeHistoryRef.current.reduce((sum, amp) => sum + amp, 0) / 
                          signalAmplitudeHistoryRef.current.length;
      
      if (avgAmplitude < MIN_AMPLITUDE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.4);
      }
    }
    
    if (noiseBufferRef.current.length > 10) {
      const noiseLevel = calculateNoiseLevel(noiseBufferRef.current);
      if (noiseLevel > MAX_NOISE_RATIO) {
        avgQuality = Math.max(0, avgQuality * 0.5);
      }
    }
    
    if (derivativeBufferRef.current.length > 10) {
      const avgDerivative = derivativeBufferRef.current.reduce((sum, d) => sum + d, 0) / 
                           derivativeBufferRef.current.length;
      
      if (avgDerivative < MIN_DERIVATIVE_THRESHOLD) {
        avgQuality = Math.max(0, avgQuality * 0.6);
      }
    }
    
    return avgQuality;
  }, [calculateNoiseLevel]);

  const getTrueFingerDetection = useCallback(() => {
    const avgQuality = getAverageQuality();
    
    const hasStableDetection = detectionStabilityCounterRef.current >= REQUIRED_STABILITY_FRAMES;
    const hasMinimumQuality = avgQuality > 35;
    const hasRequiredFrames = consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES;
    
    let hasSignalVariability = false;
    if (derivativeBufferRef.current.length > 10) {
      const maxDerivative = Math.max(...derivativeBufferRef.current);
      hasSignalVariability = maxDerivative > MIN_DERIVATIVE_THRESHOLD;
    }
    
    let hasSufficientAmplitude = false;
    if (signalAmplitudeHistoryRef.current.length > 10) {
      const avgAmplitude = signalAmplitudeHistoryRef.current.reduce((sum, a) => sum + a, 0) / 
                          signalAmplitudeHistoryRef.current.length;
      hasSufficientAmplitude = avgAmplitude > MIN_AMPLITUDE_THRESHOLD;
    }
    
    return hasStableDetection && hasMinimumQuality && hasRequiredFrames && 
           (hasSignalVariability || hasSufficientAmplitude);
  }, [getAverageQuality]);

  const getQualityColor = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    if (!isFingerDetected) return 'from-gray-400 to-gray-500';
    if (avgQuality > 70) return 'from-green-500 to-emerald-500';
    if (avgQuality > 45) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  }, [getAverageQuality, getTrueFingerDetection]);

  const getQualityText = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    if (!isFingerDetected) return 'Sin detección';
    if (avgQuality > 70) return 'Señal óptima';
    if (avgQuality > 45) return 'Señal aceptable';
    return 'Señal débil';
  }, [getAverageQuality, getTrueFingerDetection]);

  const resetSignalQuality = useCallback(() => {
    signalAmplitudeHistoryRef.current = [];
    qualityHistoryRef.current = [];
    fingerprintConfidenceRef.current = 0;
    detectionStabilityCounterRef.current = 0;
    consecutiveFingerFramesRef.current = 0;
    noiseBufferRef.current = [];
    peakVarianceRef.current = [];
    derivativeBufferRef.current = [];
    lastStableDetectionTimeRef.current = 0;
  }, []);

  return {
    getAverageQuality,
    getTrueFingerDetection,
    getQualityColor,
    getQualityText,
    updateSignalQuality,
    resetSignalQuality
  };
}
