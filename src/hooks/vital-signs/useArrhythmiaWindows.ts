
import { useState, useCallback } from 'react';
import { ArrhythmiaWindow } from './types';

/**
 * Hook for managing arrhythmia visualization windows
 */
export function useArrhythmiaWindows() {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  /**
   * Register a new arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limit to most recent arrhythmia windows for visualization
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      return newWindows.slice(-3); // Keep only the 3 most recent
    });
  }, []);

  const resetArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
  }, []);

  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    resetArrhythmiaWindows
  };
}
