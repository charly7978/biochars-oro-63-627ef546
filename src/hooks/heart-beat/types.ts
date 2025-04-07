
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  isArrhythmia?: boolean;
  arrhythmiaCount?: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export interface UseHeartBeatReturn {
  currentBPM: number;
  confidence: number;
  isArrhythmia: boolean;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

export interface ArrhythmiaData {
  timestamp: number;
  rmssd: number;
  rrVariation: number;
}

/**
 * Window of time where arrhythmia was detected
 */
export interface ArrhythmiaWindow {
  start: number;
  end: number;
}
