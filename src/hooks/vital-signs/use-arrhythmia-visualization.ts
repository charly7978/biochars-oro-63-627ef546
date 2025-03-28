
/**
 * Hook para visualización de arritmias en el PPG
 */

import { useState, useCallback, useEffect } from 'react';

export interface ArrhythmiaWindow {
  start: number;
  end: number;
  severity?: 'media' | 'alta';
  type?: string;
}

/**
 * Hook to manage arrhythmia visualization windows
 * Connects directly with PPG graph for visual representation
 */
export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  /**
   * Register a new arrhythmia window for visualization in PPG graph
   */
  const addArrhythmiaWindow = useCallback((
    start: number, 
    end: number, 
    severity: 'media' | 'alta' = 'alta',
    type: string = 'irregular'
  ) => {
    // Limit to most recent arrhythmia windows for visualization
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end, severity, type }];
      if (newWindows.length > 3) {
        return newWindows.slice(-3);
      }
      return newWindows;
    });
    
    // Log for debugging
    console.log(`ArrhythmiaVisualization: Nueva ventana de arritmia registrada para gráfico PPG: ${start} - ${end}, severidad: ${severity}`);
    
    // Dispatch custom event for PPG graph to listen to
    const arrhythmiaEvent = new CustomEvent('arrhythmia-detected', {
      detail: { 
        start, 
        end, 
        timestamp: Date.now(),
        severity,
        type
      }
    });
    document.dispatchEvent(arrhythmiaEvent);
    
    // Force the PPGSignalMeter to redraw by dispatching another event
    setTimeout(() => {
      const refreshEvent = new CustomEvent('refresh-ppg-visualization');
      document.dispatchEvent(refreshEvent);
    }, 100);
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
    
    // Dispatch clear event
    const clearEvent = new CustomEvent('arrhythmia-windows-cleared');
    document.dispatchEvent(clearEvent);
  }, []);
  
  // Listen for external arrhythmia signals from the processor
  useEffect(() => {
    const handleExternalArrhythmia = (event: CustomEvent) => {
      const { timestamp, window, severity, type } = event.detail;
      if (window && window.start && window.end) {
        addArrhythmiaWindow(
          window.start, 
          window.end, 
          severity || 'alta',
          type || 'irregular'
        );
      }
    };
    
    document.addEventListener('external-arrhythmia-detected', 
      handleExternalArrhythmia as EventListener);
      
    return () => {
      document.removeEventListener('external-arrhythmia-detected', 
        handleExternalArrhythmia as EventListener);
    };
  }, [addArrhythmiaWindow]);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
