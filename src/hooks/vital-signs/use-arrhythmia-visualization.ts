
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useEffect } from 'react';
import { ArrhythmiaWindow } from './types';

/**
 * Duración máxima (en ms) que debe mostrarse un segmento de arritmia
 * antes de desactivarse automáticamente
 */
const ARRHYTHMIA_DISPLAY_DURATION = 2000;

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
      const newWindows = [...prev, { start, end, isActive: true }];
      return newWindows.slice(-3);
    });
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
  }, []);
  
  /**
   * Efecto para automatizar la desactivación de visualizaciones de arritmia
   * después de un tiempo específico
   */
  useEffect(() => {
    const now = Date.now();
    let hasChanges = false;
    
    const updatedWindows = arrhythmiaWindows.map(window => {
      // Si el segmento está activo y ha pasado el tiempo suficiente
      if (window.isActive && (now - window.end) > ARRHYTHMIA_DISPLAY_DURATION) {
        hasChanges = true;
        return { ...window, isActive: false };
      }
      return window;
    });
    
    if (hasChanges) {
      setArrhythmiaWindows(updatedWindows);
    }
    
    // Configurar el intervalo para comprobar y actualizar las ventanas de arritmia
    const checkInterval = setInterval(() => {
      const currentTime = Date.now();
      let needsUpdate = false;
      
      setArrhythmiaWindows(prev => {
        const updated = prev.map(window => {
          if (window.isActive && (currentTime - window.end) > ARRHYTHMIA_DISPLAY_DURATION) {
            needsUpdate = true;
            return { ...window, isActive: false };
          }
          return window;
        });
        
        return needsUpdate ? updated : prev;
      });
    }, 1000);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [arrhythmiaWindows]);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
