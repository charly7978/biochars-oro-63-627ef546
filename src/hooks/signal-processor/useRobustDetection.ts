
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import { useCallback } from 'react';
import { ProcessedSignal } from '../../types/signal-processor';
import { DetectionConfig } from './types';

/**
 * Hook that provides robust finger detection processing logic
 */
export const useRobustDetection = (
  config: DetectionConfig,
  qualityHistoryRef: React.MutableRefObject<number[]>,
  fingerDetectedHistoryRef: React.MutableRefObject<boolean[]>,
  consecutiveNonDetectionRef: React.MutableRefObject<number>,
  detectionThresholdRef: React.MutableRefObject<number>,
  adaptiveCounterRef: React.MutableRefObject<number>,
  signalLockCounterRef: React.MutableRefObject<number>
) => {
  /**
   * Process finger detection robustly and adaptively
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Update histories
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > config.HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > config.HISTORY_SIZE) {
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
    if (adaptiveCounterRef.current >= config.ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.8;
      const consistentNonDetection = rawDetectionRatio < 0.2;
      
      if (consistentNonDetection) {
        // Make detection easier
        detectionThresholdRef.current = Math.max(
          config.MIN_DETECTION_THRESHOLD,
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
      signalLockCounterRef.current = Math.min(config.MAX_SIGNAL_LOCK, signalLockCounterRef.current + 1);
    } else {
      if (signalLockCounterRef.current >= config.MAX_SIGNAL_LOCK) {
        consecutiveNonDetectionRef.current++;
        
        if (consecutiveNonDetectionRef.current > config.RELEASE_GRACE_PERIOD) {
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
        }
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
      }
    }
    
    // Final determination
    const isLockedIn = signalLockCounterRef.current >= config.MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    const robustFingerDetected = isLockedIn || rawDetectionRatio >= currentThreshold;
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: signal.quality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, [
    config.ADAPTIVE_ADJUSTMENT_INTERVAL, 
    config.HISTORY_SIZE, 
    config.MAX_SIGNAL_LOCK,
    config.MIN_DETECTION_THRESHOLD,
    config.RELEASE_GRACE_PERIOD,
    adaptiveCounterRef,
    consecutiveNonDetectionRef,
    detectionThresholdRef,
    fingerDetectedHistoryRef,
    qualityHistoryRef,
    signalLockCounterRef
  ]);

  return { processRobustFingerDetection };
};
