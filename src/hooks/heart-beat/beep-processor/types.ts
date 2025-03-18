
export interface PendingBeep {
  time: number;
  value: number;
}

export interface BeepProcessorRefs {
  pendingBeepsQueue: React.MutableRefObject<PendingBeep[]>;
  beepProcessorTimeoutRef: React.MutableRefObject<number | null>;
  lastBeepTimeRef: React.MutableRefObject<number>;
}

export interface BeepProcessorConfig {
  MIN_BEEP_INTERVAL_MS: number;
}
