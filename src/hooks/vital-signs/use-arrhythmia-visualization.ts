
/**
 * Hook para visualización de arritmias en el PPG
 */

import { useState, useCallback } from 'react';

export interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Hook to manage arrhythmia visualization windows
 * Based on real data only
 */
export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  /**
   * Register a new arrhythmia window for visualization
   * Based on real data only
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limit to most recent arrhythmia windows for visualization
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      if (newWindows.length > 3) {
        return newWindows.slice(-3);
      }
      return newWindows;
    });
    
    console.log(`Nueva ventana de arritmia registrada: ${start} - ${end}`);
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
