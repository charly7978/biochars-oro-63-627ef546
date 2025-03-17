
import { useState } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for managing vital signs state
 */
export function useVitalSignsState() {
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  return {
    lastValidResults,
    setLastValidResults
  };
}
