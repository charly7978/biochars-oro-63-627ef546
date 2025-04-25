
/**
 * Hook for detecting signal quality
 * Uses real data only - no simulation
 */
import { useCallback, useState, useRef } from "react";

export function useSignalQualityDetector() {
  // Signal quality tracking
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const qualityBufferRef = useRef<number[]>([]);
  const qualityThresholdRef = useRef<number>(30);
  
  // Finger detection tracking
  const [fingerDetected, setFingerDetected] = useState<boolean>(false);
  const consecutiveDetectionsRef = useRef<number>(0);
  const requiredConsecutiveRef = useRef<number>(5);
  const weakSignalCountRef = useRef<number>(0);
  const MAX_WEAK_SIGNALS = 10;

  /**
   * Reset all quality detection
   */
  const reset = useCallback(() => {
    setSignalQuality(0);
    setFingerDetected(false);
    qualityBufferRef.current = [];
    consecutiveDetectionsRef.current = 0;
    weakSignalCountRef.current = 0;
  }, []);

  /**
   * Detect if signal is weak based on value
   */
  const detectWeakSignal = useCallback((value: number): boolean => {
    const isWeak = Math.abs(value) < 0.05;
    
    if (isWeak) {
      weakSignalCountRef.current++;
    } else {
      weakSignalCountRef.current = Math.max(0, weakSignalCountRef.current - 1);
    }
    
    return weakSignalCountRef.current >= MAX_WEAK_SIGNALS;
  }, []);

  /**
   * Check if finger is currently detected
   */
  const isFingerDetected = useCallback((): boolean => {
    return fingerDetected;
  }, [fingerDetected]);

  /**
   * Update signal quality based on real data
   */
  const updateQuality = useCallback((value: number, variance: number) => {
    // Calculate quality based on signal amplitude and variance
    const absValue = Math.abs(value);
    const signalStrength = absValue > 0.05 ? Math.min(absValue * 20, 100) : 0;
    const varianceQuality = variance < 0.01 ? 100 : Math.max(0, 100 - variance * 1000);
    
    // Combined quality metric
    const combinedQuality = (signalStrength * 0.7) + (varianceQuality * 0.3);
    
    // Keep running buffer of quality values
    qualityBufferRef.current.push(combinedQuality);
    if (qualityBufferRef.current.length > 10) {
      qualityBufferRef.current.shift();
    }
    
    // Calculate average quality over buffer
    const avgQuality = qualityBufferRef.current.reduce((sum, q) => sum + q, 0) / 
                      qualityBufferRef.current.length;
    
    // Update signal quality
    setSignalQuality(avgQuality);
    
    // Finger detection logic
    const isFingerPresent = avgQuality > qualityThresholdRef.current;
    
    if (isFingerPresent) {
      consecutiveDetectionsRef.current++;
    } else {
      consecutiveDetectionsRef.current = 0;
    }
    
    // Only update finger detection state after consistent detection
    if (consecutiveDetectionsRef.current >= requiredConsecutiveRef.current && !fingerDetected) {
      setFingerDetected(true);
    } else if (consecutiveDetectionsRef.current === 0 && fingerDetected) {
      setFingerDetected(false);
    }
    
    return {
      quality: avgQuality,
      fingerDetected: consecutiveDetectionsRef.current >= requiredConsecutiveRef.current
    };
  }, [fingerDetected]);

  return {
    signalQuality,
    fingerDetected,
    updateQuality,
    detectWeakSignal,
    isFingerDetected,
    reset
  };
}
