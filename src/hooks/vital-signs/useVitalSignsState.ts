
import { useState, useEffect } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for managing vital signs state
 */
export function useVitalSignsState() {
  console.log("DEBUG: useVitalSignsState - Hook initialization");
  
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Track state changes for debugging
  useEffect(() => {
    console.log("DEBUG: useVitalSignsState - lastValidResults updated:", {
      hasResults: !!lastValidResults,
      spo2: lastValidResults?.spo2,
      pressure: lastValidResults?.pressure,
      arrhythmiaStatus: lastValidResults?.arrhythmiaStatus,
      timestamp: new Date().toISOString()
    });
  }, [lastValidResults]);
  
  const wrappedSetLastValidResults = (results: VitalSignsResult | null) => {
    console.log("DEBUG: useVitalSignsState - Setting new results:", {
      hasResults: !!results,
      spo2: results?.spo2,
      pressure: results?.pressure,
      arrhythmiaStatus: results?.arrhythmiaStatus
    });
    setLastValidResults(results);
  };
  
  console.log("DEBUG: useVitalSignsState - Hook setup completed");
  
  return {
    lastValidResults,
    setLastValidResults: wrappedSetLastValidResults
  };
}
