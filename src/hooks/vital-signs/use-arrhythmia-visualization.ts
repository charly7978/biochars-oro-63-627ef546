
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrhythmiaWindow } from './types';

/**
 * Hook to manage arrhythmia visualization windows
 * Based on real data only
 */
export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const lastAddedWindowRef = useRef<number>(0);
  
  /**
   * Register a new arrhythmia window for visualization
   * Based on real data only
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    const currentTime = Date.now();
    
    // Prevenir demasiadas ventanas en corto tiempo para evitar sobrecarga visual
    if (currentTime - lastAddedWindowRef.current < 1000) {
      console.log("Skipping arrhythmia window - too close to previous window");
      return;
    }
    
    lastAddedWindowRef.current = currentTime;
    
    // Verificar si ya existe una ventana reciente similar (dentro de 500ms)
    setArrhythmiaWindows(prev => {
      const hasRecentWindow = prev.some(window => 
        Math.abs(window.start - start) < 500 && Math.abs(window.end - end) < 500
      );
      
      if (hasRecentWindow) {
        return prev; // No agregar ventanas duplicadas
      }
      
      // Crear nueva ventana con un margen más amplio para mejor visualización
      const expandedStart = start - 100; // Ampliar ventana 100ms antes
      const expandedEnd = end + 150;   // Ampliar ventana 150ms después
      
      // Agregar nueva ventana de arritmia
      const newWindows = [...prev, { start: expandedStart, end: expandedEnd }];
      
      // Ordenar por tiempo para mantener consistencia visual
      const sortedWindows = newWindows.sort((a, b) => b.start - a.start);
      
      // Limitar a las 5 ventanas más recientes para mejor rendimiento
      return sortedWindows.slice(0, 5);
    });
    
    // Log más detallado para depuración
    console.log("Arrhythmia window added for visualization", {
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      duration: end - start,
      totalWindows: arrhythmiaWindows.length + 1
    });
  }, [arrhythmiaWindows.length]);
  
  /**
   * Auto-clean old arrhythmia windows
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setArrhythmiaWindows(prev => {
        const currentTime = Date.now();
        // Mantener solo ventanas que estén dentro de los últimos 15 segundos para mayor persistencia visual
        const validWindows = prev.filter(window => 
          currentTime - window.end < 15000
        );
        
        // Solo actualizar si hubo cambios
        if (validWindows.length !== prev.length) {
          console.log(`Cleaned up old arrhythmia windows. Had: ${prev.length}, Now: ${validWindows.length}`);
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
    lastAddedWindowRef.current = 0;
    console.log("All arrhythmia windows cleared");
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows
  };
};
