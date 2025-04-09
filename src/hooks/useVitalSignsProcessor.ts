
import { useState, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../core/VitalSignsProcessor';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';
import { RRData } from '../core/signal/PeakDetector';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: RRData) => VitalSignsResult;
  reset: () => void;
  calibrate: () => void;
  isCalibrating: boolean;
}

/**
 * Hook for using the VitalSignsProcessor
 */
export const useVitalSignsProcessor = (
  config?: Partial<ProcessorConfig>
): UseVitalSignsProcessorReturn => {
  const [processor] = useState<VitalSignsProcessor>(() => 
    new VitalSignsProcessor({ ...DEFAULT_PROCESSOR_CONFIG, ...config })
  );
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  /**
   * Process a signal value and return vital signs
   */
  const processSignal = useCallback((value: number, rrData?: RRData): VitalSignsResult => {
    return processor.processSignal(value, rrData);
  }, [processor]);

  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    setIsCalibrating(false);
  }, []);

  /**
   * Start calibration
   */
  const calibrate = useCallback(() => {
    setIsCalibrating(true);
    processor.startCalibration();
  }, [processor]);

  return {
    processSignal,
    reset,
    calibrate,
    isCalibrating
  };
};
