
/**
 * Hook for diagnostics data
 */
import { useState, useCallback } from 'react';
import { 
  addDiagnosticsData, 
  getDiagnosticsData, 
  clearDiagnosticsData 
} from '../modules/signal-processing/diagnostics';

export function useDiagnostics() {
  const [isEnabled, setIsEnabled] = useState(false);
  
  const enableDiagnostics = useCallback(() => {
    setIsEnabled(true);
  }, []);
  
  const disableDiagnostics = useCallback(() => {
    setIsEnabled(false);
    clearDiagnosticsData();
  }, []);
  
  const logDiagnostics = useCallback((data: any) => {
    if (!isEnabled) return;
    
    addDiagnosticsData({
      timestamp: Date.now(),
      processingTime: data.processingTime || 0,
      signalStrength: data.signalStrength || 0,
      signalQuality: data.signalQuality || 0
    });
  }, [isEnabled]);
  
  const getDiagnostics = useCallback(() => {
    return getDiagnosticsData();
  }, []);
  
  const clearDiagnostics = useCallback(() => {
    clearDiagnosticsData();
  }, []);
  
  return {
    isEnabled,
    enableDiagnostics,
    disableDiagnostics,
    logDiagnostics,
    getDiagnostics,
    clearDiagnostics
  };
}
