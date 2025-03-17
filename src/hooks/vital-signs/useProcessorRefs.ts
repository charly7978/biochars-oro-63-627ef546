
import { useRef } from 'react';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaProcessor } from '../../modules/arrhythmia-processor';

/**
 * Hook for managing processor references
 */
export function useProcessorRefs() {
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaProcessorRef = useRef<ArrhythmiaProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  return {
    processorRef,
    arrhythmiaProcessorRef,
    sessionId,
    lastArrhythmiaTimeRef
  };
}
