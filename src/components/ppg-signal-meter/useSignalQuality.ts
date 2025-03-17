
import { useCallback } from 'react';
import { useSignalQualityState } from './signal-quality/useSignalQualityState';
import { calculateAverageQuality, getQualityColor, getQualityText } from './signal-quality/qualityCalculator';
import { detectFingerPresence } from './signal-quality/fingerDetector';

export function useSignalQuality() {
  const {
    qualityHistoryRef,
    consecutiveFingerFramesRef,
    signalAmplitudeHistoryRef,
    detectionStabilityCounterRef,
    noiseBufferRef,
    derivativeBufferRef,
    updateQualityHistory,
    updateAmplitudeHistory,
    updateDerivativeBuffer,
    updateDetectionStability,
    updateConfidence,
    reset: resetSignalQualityState
  } = useSignalQualityState();

  const updateSignalQuality = useCallback((
    value: number, 
    quality: number, 
    isFingerDetected: boolean, 
    lastValue: number | null, 
    baseline: number | null
  ) => {
    // Update derivative buffer
    updateDerivativeBuffer(value, lastValue);
    
    // Update quality history
    updateQualityHistory(quality, isFingerDetected);
    
    // Update amplitude history
    updateAmplitudeHistory(value, lastValue, baseline);
    
    // Update detection stability
    updateDetectionStability(isFingerDetected, quality);
    
    // Update confidence
    updateConfidence();
  }, [updateDerivativeBuffer, updateQualityHistory, updateAmplitudeHistory, updateDetectionStability, updateConfidence]);

  const getAverageQuality = useCallback(() => {
    return calculateAverageQuality(
      qualityHistoryRef.current,
      signalAmplitudeHistoryRef.current,
      noiseBufferRef.current,
      derivativeBufferRef.current
    );
  }, []);

  const getTrueFingerDetection = useCallback(() => {
    const avgQuality = getAverageQuality();
    
    return detectFingerPresence(
      avgQuality,
      detectionStabilityCounterRef.current,
      consecutiveFingerFramesRef.current,
      derivativeBufferRef.current,
      signalAmplitudeHistoryRef.current
    );
  }, [getAverageQuality]);

  const getQualityColorWrapper = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    return getQualityColor(avgQuality, isFingerDetected);
  }, [getAverageQuality, getTrueFingerDetection]);

  const getQualityTextWrapper = useCallback((q: number) => {
    const avgQuality = getAverageQuality();
    const isFingerDetected = getTrueFingerDetection();
    
    return getQualityText(avgQuality, isFingerDetected);
  }, [getAverageQuality, getTrueFingerDetection]);

  const resetSignalQuality = useCallback(() => {
    resetSignalQualityState();
  }, [resetSignalQualityState]);

  return {
    getAverageQuality,
    getTrueFingerDetection,
    getQualityColor: getQualityColorWrapper,
    getQualityText: getQualityTextWrapper,
    updateSignalQuality,
    resetSignalQuality
  };
}
