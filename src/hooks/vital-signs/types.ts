
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE!
 * 
 * This file contains typescript interfaces for the vital signs processor
 */

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null;
  arrhythmiaWindows: Array<{start: number, end: number}>;
  debugInfo: {
    processedSignals: number;
    signalLog: Array<{timestamp: number, value: number, result: any}>;
  };
}
