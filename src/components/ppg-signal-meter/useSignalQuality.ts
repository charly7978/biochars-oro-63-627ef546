
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
    // Update derivative buffer - more sensitive to changes
    updateDerivativeBuffer(value, lastValue);
    
    // Update quality history with higher weights for good values
    const adjustedQuality = isFingerDetected ? Math.max(quality, 20) : quality;
    updateQualityHistory(adjustedQuality, isFingerDetected);
    
    // Update amplitude history with more sensitivity
    updateAmplitudeHistory(value, lastValue, baseline);
    
    // Update detection stability with more permissive parameters
    updateDetectionStability(isFingerDetected, quality);
    
    // Update confidence with more weight on history
    updateConfidence();
  }, [updateDerivativeBuffer, updateQualityHistory, updateAmplitudeHistory, updateDetectionStability, updateConfidence]);

  const getAverageQuality = useCallback(() => {
    // More permissive quality calculation
    return calculateAverageQuality(
      qualityHistoryRef.current,
      signalAmplitudeHistoryRef.current,
      noiseBufferRef.current,
      derivativeBufferRef.current
    );
  }, [qualityHistoryRef, signalAmplitudeHistoryRef, noiseBufferRef, derivativeBufferRef]);

  const getTrueFingerDetection = useCallback(() => {
    const avgQuality = getAverageQuality();
    
    // More permissive finger detection
    return detectFingerPresence(
      avgQuality,
      detectionStabilityCounterRef.current,
      consecutiveFingerFramesRef.current,
      derivativeBufferRef.current,
      signalAmplitudeHistoryRef.current
    );
  }, [getAverageQuality, detectionStabilityCounterRef, consecutiveFingerFramesRef, derivativeBufferRef, signalAmplitudeHistoryRef]);

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
