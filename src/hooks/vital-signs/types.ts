
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

/**
 * Interface for arrhythmia windows used in visualization
 */
export interface ArrhythmiaWindow {
  start: number;
  end: number;
  id: string;
}

/**
 * Return type for the useVitalSignsProcessor hook
 */
export interface UseVitalSignsProcessorReturn {
  /**
   * Process a PPG signal value to calculate vital signs
   */
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  
  /**
   * Reset the processor to initial state
   */
  reset: () => VitalSignsResult | null;
  
  /**
   * Perform a complete reset of all data
   */
  fullReset: () => void;
  
  /**
   * Current count of arrhythmias detected
   */
  arrhythmiaCounter: number;
  
  /**
   * Last valid results
   */
  lastValidResults: VitalSignsResult | null;
  
  /**
   * Arrhythmia windows for visualization
   */
  arrhythmiaWindows: ArrhythmiaWindow[];
  
  /**
   * Debug information about the processor
   */
  debugInfo: any;
}

/**
 * Return type for the useSignalProcessing hook
 */
export interface UseSignalProcessingReturn {
  /**
   * Process a PPG signal value
   */
  processSignal: (value: number, rrData?: any, isWeakSignal?: boolean) => VitalSignsResult;
  
  /**
   * Initialize the processor
   */
  initializeProcessor: () => void;
  
  /**
   * Reset the processor
   */
  reset: () => VitalSignsResult | null;
  
  /**
   * Perform a complete reset of the processor
   */
  fullReset: () => void;
  
  /**
   * Get the current count of arrhythmias
   */
  getArrhythmiaCounter: () => number;
  
  /**
   * Get debug information about the processor
   */
  getDebugInfo: () => any;
  
  /**
   * Reference to the processor
   */
  processorRef: React.MutableRefObject<any>;
  
  /**
   * Count of processed signals
   */
  processedSignals: React.MutableRefObject<number>;
  
  /**
   * Log of signal data
   */
  signalLog: React.MutableRefObject<any[]>;
}
