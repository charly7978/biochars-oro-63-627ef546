
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrhythmiaWindow } from '@/types/arrhythmia';
import ArrhythmiaDetectionService from '@/services/arrhythmia';

/**
 * Hook for arrhythmia visualization
 * Simplified to act as a bridge between ArrhythmiaDetectionService and UI components
 */
export const useArrhythmiaVisualization = () => {
  // Visualization windows state
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // Tracking state
  const lastArrhythmiaTriggeredRef = useRef<number>(0);
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 6000; // 6 seconds between notifications
  
  /**
   * Update from ArrhythmiaDetectionService
   */
  useEffect(() => {
    // Add listener for ArrhythmiaDetectionService
    const handleNewArrhythmiaWindow = (window: ArrhythmiaWindow) => {
      setArrhythmiaWindows(prev => {
        // Add new window
        const newWindows = [...prev, window];
        
        // Sort by time for consistent visualization - newest first
        const sortedWindows = newWindows.sort((a, b) => b.start - a.start);
        
        // Limit to the 5 most recent windows
        const limitedWindows = sortedWindows.slice(0, 5);
        
        return limitedWindows;
      });
    };
    
    // Register listener
    ArrhythmiaDetectionService.addArrhythmiaListener(handleNewArrhythmiaWindow);
    
    // Clean up on unmount
    return () => {
      ArrhythmiaDetectionService.removeArrhythmiaListener(handleNewArrhythmiaWindow);
    };
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
         arrhythmiaStatus.includes("ARRITMIA DETECTADA"))) {
      
      // Verificar si ha pasado tiempo suficiente desde la última notificación
      const timeElapsed = currentTime - lastArrhythmiaTriggeredRef.current;
      if (timeElapsed > MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
        lastArrhythmiaTriggeredRef.current = currentTime;
        
        // Return true to indicate a new notification should be shown
        return true;
      }
    }
    
    return false;
  }, [MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL]);
  
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
        // Get updated windows from service
        const serviceWindows = ArrhythmiaDetectionService.getArrhythmiaWindows();
        
        // Return updated windows if different
        if (JSON.stringify(prev) !== JSON.stringify(serviceWindows)) {
          return serviceWindows;
        }
        return prev;
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  /**
   * Force add an arrhythmia window - useful for testing
   */
  const forceAddArrhythmiaWindow = useCallback(() => {
    const now = Date.now();
    // Create a window and add to service
    const window = {
      start: now - 800,
      end: now + 800
    };
    
    ArrhythmiaDetectionService.windowManager.addArrhythmiaWindow(window);
    console.log("Arrhythmia window FORCED for visualization");
    return true;
  }, []);
  
  /**
   * Clear all arrhythmia visualization windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    ArrhythmiaDetectionService.reset();
    setArrhythmiaWindows([]);
    lastArrhythmiaTriggeredRef.current = 0;
    console.log("All arrhythmia windows cleared");
  }, []);
  
  /**
   * Reset all tracking data
   */
  const reset = useCallback(() => {
    clearArrhythmiaWindows();
    lastArrhythmiaTriggeredRef.current = 0;
  }, [clearArrhythmiaWindows]);
  
  return {
    arrhythmiaWindows: ArrhythmiaDetectionService.getArrhythmiaWindows(), // Always get latest from service
    addArrhythmiaWindow: (start: number, end: number) => {
      ArrhythmiaDetectionService.windowManager.addArrhythmiaWindow({ start, end });
    },
    forceAddArrhythmiaWindow,
    clearArrhythmiaWindows,
    detectArrhythmia: ArrhythmiaDetectionService.detectArrhythmia.bind(ArrhythmiaDetectionService),
    processArrhythmiaStatus,
    registerArrhythmiaNotification,
    reset,
    lastIsArrhythmiaRef: { 
      get current() { return ArrhythmiaDetectionService.isArrhythmia(); } 
    }
  };
};
