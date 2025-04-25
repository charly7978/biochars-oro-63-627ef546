
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrhythmiaWindow } from '@/types/arrhythmia';
import { calculateRMSSD, calculateRRVariation } from '../../modules/vital-signs/arrhythmia/calculations';
import ArrhythmiaDetectionService from '../../services/ArrhythmiaDetectionService';

/**
 * Hook for arrhythmia detection and visualization
 */
export const useArrhythmiaVisualization = () => {
  // Visualization windows state
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // Detection state
  const heartRateVariabilityRef = useRef<number[]>([]);
  const stabilityCounterRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const lastArrhythmiaTriggeredRef = useRef<number>(0);
  const windowGenerationCounterRef = useRef<number>(0);
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 6000; // 6 seconds between notifications
  
  // Detection configuration
  const DETECTION_THRESHOLD = 0.22; // Increased from 0.20 to 0.22 para reducir falsos positivos
  
  /**
   * Register a new arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Verificar si ya existe una ventana similar
    setArrhythmiaWindows(prev => {
      const currentTime = Date.now();
      
      // Evitar añadir ventanas muy cortas
      if (end - start < 800) {
        console.log("Arrhythmia window rejected - too short", { duration: end - start });
        return prev;
      }
      
      const hasRecentWindow = prev.some(window => 
        Math.abs(window.start - start) < 800 && Math.abs(window.end - end) < 800
      );
      
      if (hasRecentWindow) {
        console.log("Duplicate arrhythmia window avoided");
        return prev; // Don't add duplicate windows
      }
      
      // Incrementar contador para seguimiento
      windowGenerationCounterRef.current += 1;
      
      // Add new arrhythmia window
      const newWindows = [...prev, { start, end }];
      
      // Sort by time for consistent visualization - newest first
      const sortedWindows = newWindows.sort((a, b) => b.start - a.start);
      
      // Limit to the 5 most recent windows
      const limitedWindows = sortedWindows.slice(0, 5);
      
      // Debug log
      console.log("Arrhythmia window added for visualization", {
        windowId: windowGenerationCounterRef.current,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        duration: end - start,
        windowsCount: limitedWindows.length
      });
      
      return limitedWindows;
    });
  }, []);
  
  /**
   * Analyze RR intervals to detect arrhythmias
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    return ArrhythmiaDetectionService.detectArrhythmia(rrIntervals);
  }, []);

  /**
   * Process arrhythmia detection from signal processor results
   */
  const processArrhythmiaStatus = useCallback((arrhythmiaStatus: string, lastArrhythmiaData: any) => {
    const currentTime = Date.now();
    
    // Check for arrhythmia detected message
    if (arrhythmiaStatus && 
        typeof arrhythmiaStatus === 'string' && 
        (arrhythmiaStatus.includes("ARRYTHMIA DETECTED") || 
         arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") ||
         arrhythmiaStatus.includes("ARRITMIA DETECTADA")) && 
        lastArrhythmiaData) {
      
      const arrhythmiaTime = lastArrhythmiaData.timestamp || currentTime;
      
      // Verificar si ha pasado tiempo suficiente desde la última notificación
      const timeElapsed = currentTime - lastArrhythmiaTriggeredRef.current;
      if (timeElapsed > MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
        // Create visualization window with amplio tamaño para visualización clara
        const windowWidth = 1500; // Increased from 1000 to 1500ms
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
        lastArrhythmiaTriggeredRef.current = currentTime;
        
        // Return true to indicate a new notification should be shown
        return true;
      }
    }
    
    return false;
  }, [addArrhythmiaWindow, MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL]);
  
  /**
   * Register an arrhythmia notification
   */
  const registerArrhythmiaNotification = useCallback(() => {
    lastArrhythmiaTriggeredRef.current = Date.now();
  }, []);
  
  /**
   * Auto-clean old arrhythmia windows
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setArrhythmiaWindows(prev => {
        const currentTime = Date.now();
        // Keep only windows from the last 15 seconds
        const validWindows = prev.filter(window => 
          currentTime - window.end < 20000
        );
        
        // Only update if there were changes
        if (validWindows.length !== prev.length) {
          console.log(`Auto-cleanup: Removed ${prev.length - validWindows.length} old arrhythmia windows`);
          return validWindows;
        }
        return prev;
      });
    }, 5000); // Clean every 5 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  /**
   * Force add an arrhythmia window - useful for testing
   */
  const forceAddArrhythmiaWindow = useCallback(() => {
    const now = Date.now();
    // Crear una ventana visible y amplia
    addArrhythmiaWindow(now - 800, now + 800);
    console.log("Arrhythmia window FORCED for visualization");
    return true;
  }, [addArrhythmiaWindow]);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
    stabilityCounterRef.current = 0;
    heartRateVariabilityRef.current = [];
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    lastArrhythmiaTriggeredRef.current = 0;
    windowGenerationCounterRef.current = 0;
    console.log("All arrhythmia windows cleared");
  }, []);
  
  /**
   * Reset all tracking data
   */
  const reset = useCallback(() => {
    clearArrhythmiaWindows();
    heartRateVariabilityRef.current = [];
    stabilityCounterRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    lastArrhythmiaTriggeredRef.current = 0;
    windowGenerationCounterRef.current = 0;
  }, [clearArrhythmiaWindows]);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    forceAddArrhythmiaWindow,
    clearArrhythmiaWindows,
    detectArrhythmia,
    processArrhythmiaStatus,
    registerArrhythmiaNotification,
    reset,
    lastIsArrhythmiaRef
  };
};
