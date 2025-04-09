
import { useState, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../core/VitalSignsProcessor';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';
import { RRData } from '../core/signal/PeakDetector';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: RRData) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  calibrate: () => void;
  isCalibrating: boolean;
  fullReset: () => void;
  lastValidResults: VitalSignsResult | null;
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
  const [lastResults, setLastResults] = useState<VitalSignsResult | null>(null);

  /**
   * Process a signal value and return vital signs
   */
  const processSignal = useCallback((value: number, rrData?: RRData): VitalSignsResult => {
    const results = processor.processSignal(value, rrData);
    setLastResults(results);
    return results;
  }, [processor]);

  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    setIsCalibrating(false);
    return processor.reset();
  }, [processor]);

  /**
   * Full reset of the processor
   */
  const fullReset = useCallback(() => {
    setIsCalibrating(false);
    setLastResults(null);
    processor.fullReset();
  }, [processor]);

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
    isCalibrating,
    fullReset,
    lastValidResults: lastResults
  };
};
