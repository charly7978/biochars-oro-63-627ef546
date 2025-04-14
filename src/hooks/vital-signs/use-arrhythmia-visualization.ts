
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrhythmiaWindow } from './types';
import { calculateRMSSD, calculateRRVariation } from '../../modules/vital-signs/arrhythmia/calculations';

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
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 8000; // 8 seconds between notifications
  
  // Detection configuration
  const DETECTION_THRESHOLD = 0.24; // Increased from 0.22 to 0.24 para reducir falsos positivos
  
  // Window tracking to ensure consistent visualization
  const activeWindowsRef = useRef<{[key: string]: boolean}>({});
  
  /**
   * Register a new arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Verificar si ya existe una ventana similar
    setArrhythmiaWindows(prev => {
      const currentTime = Date.now();
      
      // Evitar añadir ventanas muy cortas
      if (end - start < 1000) { // Increased from 800 to 1000
        console.log("Arrhythmia window rejected - too short", { duration: end - start });
        return prev;
      }
      
      // Generate a unique ID for this window based on its timing
      const windowId = `${Math.round(start/100)}-${Math.round(end/100)}`;
      
      // Check if we're already tracking this window
      if (activeWindowsRef.current[windowId]) {
        console.log(`Window ${windowId} already being tracked, not duplicating`);
        return prev;
      }
      
      const hasRecentWindow = prev.some(window => 
        Math.abs(window.start - start) < 1000 && Math.abs(window.end - end) < 1000 // Increased from 800 to 1000
      );
      
      if (hasRecentWindow) {
        console.log("Duplicate arrhythmia window avoided");
        return prev; // Don't add duplicate windows
      }
      
      // Incrementar contador para seguimiento
      windowGenerationCounterRef.current += 1;
      
      // Add new arrhythmia window
      const newWindows = [...prev, { start, end }];
      
      // Add to active windows tracking
      activeWindowsRef.current[windowId] = true;
      
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
      
      // Setup auto-cleanup for this specific window
      setTimeout(() => {
        delete activeWindowsRef.current[windowId];
        console.log(`Window ${windowId} removed from active tracking`);
      }, (end - start) + 25000); // Keep tracking for duration + 25 seconds
      
      return limitedWindows;
    });
  }, []);
  
  /**
   * Analyze RR intervals to detect arrhythmias
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    if (rrIntervals.length < 5) {
      return {
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now(),
        isArrhythmia: false
      };
    }
    
    const lastIntervals = rrIntervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(lastIntervals);
    
    // Calculate RR variation
    const variationRatio = calculateRRVariation(lastIntervals);
    
    // Adjust threshold based on stability
    let thresholdFactor = DETECTION_THRESHOLD;
    if (stabilityCounterRef.current > 15) {
      thresholdFactor = 0.20; // Increased from 0.18 to 0.20
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.30; // Increased from 0.28 to 0.30
    }
    
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Arrhythmia detection
    const isArrhythmia = isIrregular && stabilityCounterRef.current < 20; // Changed from 22 to 20
    
    if (isArrhythmia) {
      // Generate an arrhythmia window when detected
      const currentTime = Date.now();
      
      // Solo generar ventana si ha pasado tiempo suficiente desde la última
      if (currentTime - lastArrhythmiaTriggeredRef.current > 3500) { // Increased from 3000 to 3500
        const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
        // Ventana más ancha para mejor visualización
        const windowWidth = Math.max(1200, Math.min(1800, avgInterval * 4.0)); // Increased from 3.5 to 4.0
        
        addArrhythmiaWindow(currentTime - windowWidth/2, currentTime + windowWidth/2);
        lastArrhythmiaTriggeredRef.current = currentTime;
        
        console.log("Arrhythmia detected in visualization", {
          rmssd,
          variationRatio,
          threshold: thresholdFactor,
          timestamp: new Date(currentTime).toISOString(),
          rrIntervals: lastIntervals
        });
        
        // Try to vibrate device
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 150]);
            console.log('Vibration triggered for arrhythmia visualization');
          }
        } catch (error) {
          console.error('Error triggering vibration:', error);
        }
      }
    }
    
    heartRateVariabilityRef.current.push(variationRatio);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    lastIsArrhythmiaRef.current = isArrhythmia;
    
    return {
      rmssd,
      rrVariation: variationRatio,
      timestamp: Date.now(),
      isArrhythmia
    };
  }, [addArrhythmiaWindow, DETECTION_THRESHOLD]);
  
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
        const windowWidth = 1800; // Increased from 1500 to 1800ms
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
        lastArrhythmiaTriggeredRef.current = currentTime;
        
        // Try to vibrate device
        try {
          if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 150]);
            console.log('Vibration triggered for arrhythmia status');
          }
        } catch (error) {
          console.error('Error triggering vibration:', error);
        }
        
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
    addArrhythmiaWindow(now - 900, now + 900); // Increased from 800 to 900
    console.log("Arrhythmia window FORCED for visualization");
    
    // Try to vibrate device
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 150]);
        console.log('Vibration triggered for forced arrhythmia');
      }
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
    
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
    activeWindowsRef.current = {};
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
    activeWindowsRef.current = {};
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
