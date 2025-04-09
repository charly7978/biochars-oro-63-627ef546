/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback } from 'react';
import { ArrhythmiaWindow } from './types';

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
      // Keep only the most recent 5 windows for better visibility
      return newWindows.slice(-5);
    });
    
    console.log("ArrhythmiaVisualization: Added window", { start, end, timestamp: new Date().toISOString() });
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
    console.log("ArrhythmiaVisualization: Cleared all windows");
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
