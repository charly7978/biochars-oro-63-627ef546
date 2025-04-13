
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useEffect } from 'react';
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
    // Verificar si ya existe una ventana reciente similar (dentro de 500ms)
    setArrhythmiaWindows(prev => {
      const currentTime = Date.now();
      const hasRecentWindow = prev.some(window => 
        Math.abs(window.start - start) < 500 && Math.abs(window.end - end) < 500
      );
      
      if (hasRecentWindow) {
        return prev; // No agregar ventanas duplicadas
      }
      
      // Agregar nueva ventana de arritmia
      const newWindows = [...prev, { start, end }];
      
      // Ordenar por tiempo para mantener consistencia visual
      const sortedWindows = newWindows.sort((a, b) => b.start - a.start);
      
      // Limitar a las 3 ventanas más recientes
      return sortedWindows.slice(0, 3);
    });
    
    // Log para depuración
    console.log("Arrhythmia window added for visualization", {
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      duration: end - start
    });
  }, []);
  
  /**
   * Auto-clean old arrhythmia windows
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setArrhythmiaWindows(prev => {
        const currentTime = Date.now();
        // Mantener solo ventanas que estén dentro de los últimos 10 segundos
        const validWindows = prev.filter(window => 
          currentTime - window.end < 10000
        );
        
        // Solo actualizar si hubo cambios
        if (validWindows.length !== prev.length) {
          return validWindows;
        }
        return prev;
      });
    }, 5000); // Limpiar cada 5 segundos
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
    console.log("All arrhythmia windows cleared");
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
