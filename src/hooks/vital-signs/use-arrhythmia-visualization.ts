
/**
 * Hook for visualizing arrhythmia events in a timeline
 */
import { useState, useCallback } from 'react';
import { ArrhythmiaWindow } from './types';

export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  /**
   * Add an arrhythmia visualization window
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    setArrhythmiaWindows(prev => {
      // Limit to 10 most recent windows
      const updated = [...prev, { start, end }];
      if (updated.length > 10) {
        return updated.slice(updated.length - 10);
      }
      return updated;
    });
  }, []);
  
  /**
   * Clear all arrhythmia windows
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
