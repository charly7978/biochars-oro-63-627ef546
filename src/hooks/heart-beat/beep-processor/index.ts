
import { useState, useCallback, useRef } from 'react';
import { BeepProcessorRefs, PendingBeep } from './types';
import { useBeepQueueProcessor } from './queue-processor';
import { useImmediateBeep } from './immediate-beep';
import { useBeepProcessorCleanup } from './cleanup';

export function useBeepProcessor() {
  const pendingBeepsQueue = useRef<PendingBeep[]>([]);
  const beepProcessorTimeoutRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  
  const MIN_BEEP_INTERVAL_MS = 250; // Minimum time between beeps
  
  const refs: BeepProcessorRefs = {
    pendingBeepsQueue,
    beepProcessorTimeoutRef,
    lastBeepTimeRef
  };
  
  const processBeepQueue = useBeepQueueProcessor(refs, { MIN_BEEP_INTERVAL_MS });
  const requestImmediateBeep = useImmediateBeep(refs, { MIN_BEEP_INTERVAL_MS }, processBeepQueue);
  const cleanup = useBeepProcessorCleanup(refs);

  return {
    requestImmediateBeep,
    processBeepQueue,
    pendingBeepsQueue,
    lastBeepTimeRef,
    beepProcessorTimeoutRef,
    cleanup
  };
}
