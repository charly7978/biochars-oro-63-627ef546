
import { useCallback } from 'react';
import { BeepProcessorRefs } from './types';

export function useBeepProcessorCleanup(refs: BeepProcessorRefs) {
  const cleanup = useCallback(() => {
    refs.pendingBeepsQueue.current = [];
    
    if (refs.beepProcessorTimeoutRef.current) {
      clearTimeout(refs.beepProcessorTimeoutRef.current);
      refs.beepProcessorTimeoutRef.current = null;
    }
  }, [refs]);

  return cleanup;
}
