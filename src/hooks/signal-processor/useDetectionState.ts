
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import { useRef } from 'react';
import { DetectionConfig } from './types';

/**
 * Hook that manages the state for robust finger detection
 */
export const useDetectionState = (config: DetectionConfig) => {
  // References for history and stabilization
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  
  // Variables for adaptive handling
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.45);
  const adaptiveCounterRef = useRef<number>(0);
  
  // Counter to avoid rapid signal losses
  const signalLockCounterRef = useRef<number>(0);

  /**
   * Reset all detection state variables
   */
  const resetDetectionState = () => {
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.40;
    adaptiveCounterRef.current = 0;
  };

  return {
    qualityHistoryRef,
    fingerDetectedHistoryRef,
    consecutiveNonDetectionRef,
    detectionThresholdRef,
    adaptiveCounterRef,
    signalLockCounterRef,
    resetDetectionState
  };
};
