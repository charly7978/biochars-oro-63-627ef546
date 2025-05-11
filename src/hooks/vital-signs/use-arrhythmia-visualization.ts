
import { useCallback, useState } from 'react';

export interface ArrhythmiaWindow {
  id: string;
  start: number;
  end: number;
}

export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setArrhythmiaWindows(prev => {
      // Limit to 5 most recent windows
      const updated = [...prev, { id, start, end }];
      if (updated.length > 5) {
        return updated.slice(-5);
      }
      return updated;
    });
  }, []);
  
  const removeArrhythmiaWindow = useCallback((id: string) => {
    setArrhythmiaWindows(prev => prev.filter(window => window.id !== id));
  }, []);
  
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    removeArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
