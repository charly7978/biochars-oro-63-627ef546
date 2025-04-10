
import { useState, useCallback } from 'react';
import { ArrhythmiaWindow } from './types';

/**
 * Hook for managing arrhythmia visualization windows
 */
export function useArrhythmiaVisualization() {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  /**
   * Add a new arrhythmia window
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    const id = `arrhythmia-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setArrhythmiaWindows(prev => [...prev, { start, end, id }]);
  }, []);
  
  /**
   * Remove an arrhythmia window
   */
  const removeArrhythmiaWindow = useCallback((id: string) => {
    setArrhythmiaWindows(prev => prev.filter(window => window.id !== id));
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
    removeArrhythmiaWindow,
    clearArrhythmiaWindows
  };
}
