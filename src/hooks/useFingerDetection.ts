
import { useState, useEffect, useCallback } from 'react';
import FingerDetectionService from '../services/FingerDetectionService';

export function useFingerDetection() {
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [detectionQuality, setDetectionQuality] = useState(0);
  
  useEffect(() => {
    const service = FingerDetectionService.getInstance();
    const subscription = service.getStateObservable().subscribe(state => {
      setIsFingerDetected(state.isFingerDetected);
      setDetectionQuality(state.detectionQuality);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const updateDetection = useCallback((isDetected: boolean, quality: number) => {
    const service = FingerDetectionService.getInstance();
    service.updateDetection(isDetected, quality);
  }, []);
  
  const reset = useCallback(() => {
    const service = FingerDetectionService.getInstance();
    service.reset();
  }, []);
  
  const getQualityText = useCallback(() => {
    const service = FingerDetectionService.getInstance();
    return service.getQualityText();
  }, []);
  
  const getQualityColor = useCallback(() => {
    const service = FingerDetectionService.getInstance();
    return service.getQualityColor();
  }, []);
  
  return {
    isFingerDetected,
    detectionQuality,
    updateDetection,
    reset,
    getQualityText,
    getQualityColor
  };
}
