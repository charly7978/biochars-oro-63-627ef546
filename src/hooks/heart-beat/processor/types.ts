
import { UseHeartBeatReturn } from '../types';

export interface ProcessorRefs {
  isMonitoringRef: React.MutableRefObject<boolean>;
  initializedRef: React.MutableRefObject<boolean>;
  missedBeepsCounter: React.MutableRefObject<number>;
  sessionId: React.MutableRefObject<string>;
}

export interface ProcessorState {
  currentBPM: number;
  setCurrentBPM: React.Dispatch<React.SetStateAction<number>>;
  confidence: number;
  setConfidence: React.Dispatch<React.SetStateAction<number>>;
}

export interface ProcessorCleanup {
  cleanupProcessor: () => void;
}
