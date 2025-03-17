
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
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
    if (lastValidResults) {
      console.log("DEBUG: useVitalSignsState - lastValidResults updated:", {
        hasResults: true,
        spo2: lastValidResults.spo2,
        pressure: lastValidResults.pressure,
        arrhythmiaStatus: lastValidResults.arrhythmiaStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log("DEBUG: useVitalSignsState - lastValidResults cleared");
    }
  }, [lastValidResults]);
  
  const wrappedSetLastValidResults = (results: VitalSignsResult | null) => {
    if (results) {
      console.log("DEBUG: useVitalSignsState - Setting new results:", {
        hasResults: true,
        spo2: results.spo2,
        pressure: results.pressure,
        arrhythmiaStatus: results.arrhythmiaStatus
      });
    } else {
      console.log("DEBUG: useVitalSignsState - Clearing results");
    }
    setLastValidResults(results);
  };
  
  console.log("DEBUG: useVitalSignsState - Hook setup completed");
  
  return {
    lastValidResults,
    setLastValidResults: wrappedSetLastValidResults
  };
}
