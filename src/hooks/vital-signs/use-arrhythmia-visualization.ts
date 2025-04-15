
import { useState, useCallback, useEffect } from 'react';
import { ArrhythmiaWindow } from './types';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

/**
 * Hook for arrhythmia detection and visualization
 * Now uses the centralized ArrhythmiaDetectionService
 */
export const useArrhythmiaVisualization = () => {
  // Visualization windows state - get directly from service
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>(
    ArrhythmiaDetectionService.getArrhythmiaWindows()
  );
  
  // Update local state when service windows change
  useEffect(() => {
    const handleArrhythmiaWindow = (window: ArrhythmiaWindow) => {
      setArrhythmiaWindows(ArrhythmiaDetectionService.getArrhythmiaWindows());
    };
    
    ArrhythmiaDetectionService.addArrhythmiaListener(handleArrhythmiaWindow);
    
    return () => {
      ArrhythmiaDetectionService.removeArrhythmiaListener(handleArrhythmiaWindow);
    };
  }, []);
  
  /**
   * Register a new arrhythmia window for visualization
   * Delegates to centralized service
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    ArrhythmiaDetectionService.addArrhythmiaWindow({ start, end });
  }, []);
  
  /**
   * Detect arrhythmia
   * Now delegates to the centralized ArrhythmiaDetectionService
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    return ArrhythmiaDetectionService.detectArrhythmia(rrIntervals);
  }, []);
  
  /**
   * Process arrhythmia detection from signal processor results
   */
  const processArrhythmiaStatus = useCallback((arrhythmiaStatus: string, lastArrhythmiaData: any) => {
    if (!arrhythmiaStatus || !lastArrhythmiaData) return false;
    
    // Check for arrhythmia detected message
    if (typeof arrhythmiaStatus === 'string' && 
        (arrhythmiaStatus.includes("ARRYTHMIA DETECTED") || 
         arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") ||
         arrhythmiaStatus.includes("ARRITMIA DETECTADA"))) {
      
      // Delegate to the service
      const arrhythmiaTime = lastArrhythmiaData.timestamp || Date.now();
      const windowWidth = 1500;
      
      // Add to centralized service
      ArrhythmiaDetectionService.addArrhythmiaWindow({
        start: arrhythmiaTime - windowWidth/2, 
        end: arrhythmiaTime + windowWidth/2
      });
      
      // Return true to indicate a new notification should be shown
      return true;
    }
    
    return false;
  }, []);
  
  /**
   * Register an arrhythmia notification
   */
  const registerArrhythmiaNotification = useCallback(() => {
    // This is handled by ArrhythmiaDetectionService internally now
  }, []);
  
  /**
   * Force add an arrhythmia window - useful for testing
   */
  const forceAddArrhythmiaWindow = useCallback(() => {
    ArrhythmiaDetectionService.forceAddArrhythmiaWindow();
    return true;
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    ArrhythmiaDetectionService.reset();
    setArrhythmiaWindows([]);
  }, []);
  
  /**
   * Reset all tracking data
   */
  const reset = useCallback(() => {
    clearArrhythmiaWindows();
    ArrhythmiaDetectionService.reset();
  }, [clearArrhythmiaWindows]);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    forceAddArrhythmiaWindow,
    clearArrhythmiaWindows,
    detectArrhythmia,
    processArrhythmiaStatus,
    registerArrhythmiaNotification,
    reset,
    lastIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); }
    }
  };
};
