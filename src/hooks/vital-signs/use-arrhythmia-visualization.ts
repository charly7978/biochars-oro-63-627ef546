
import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrhythmiaWindow } from './types';
import { calculateRMSSD, calculateRRVariation } from '../../modules/vital-signs/arrhythmia/calculations';

/**
 * Centralized hook for arrhythmia detection and visualization
 * Based on real data only
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
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 5000; // 5 seconds between notifications (reduced from 10s)
  
  // Detection configuration - more sensitive settings
  const DETECTION_THRESHOLD = 0.20; // Reduced for better sensitivity
  
  /**
   * Register a new arrhythmia window for visualization
   * Based on real data only
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Check if there's a similar recent window (within 500ms)
    setArrhythmiaWindows(prev => {
      const currentTime = Date.now();
      const hasRecentWindow = prev.some(window => 
        Math.abs(window.start - start) < 500 && Math.abs(window.end - end) < 500
      );
      
      if (hasRecentWindow) {
        return prev; // Don't add duplicate windows
      }
      
      // Add new arrhythmia window
      const newWindows = [...prev, { start, end }];
      
      // Sort by time for consistent visualization
      const sortedWindows = newWindows.sort((a, b) => b.start - a.start);
      
      // Limit to the 5 most recent windows (increased from 3)
      return sortedWindows.slice(0, 5);
    });
    
    // Debug log
    console.log("Arrhythmia window added for visualization", {
      startTime: new Date(start).toISOString(),
      endTime: new Date(end).toISOString(),
      duration: end - start,
      windowsCount: arrhythmiaWindows.length + 1
    });
  }, [arrhythmiaWindows.length]);
  
  /**
   * Analyze RR intervals to detect arrhythmias
   * Using direct measurement algorithms only - more sensitive settings
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
      thresholdFactor = 0.15; // Lower threshold when stable for higher sensitivity
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.25; // Higher threshold when unstable
    }
    
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // More aggressive arrhythmia detection
    const isArrhythmia = isIrregular;
    
    if (isArrhythmia) {
      // Generate an arrhythmia window when detected
      const currentTime = Date.now();
      const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
      const windowWidth = Math.max(800, Math.min(1200, avgInterval * 3));
      
      addArrhythmiaWindow(currentTime - windowWidth/2, currentTime + windowWidth/2);
      
      console.log("Arrhythmia detected", {
        rmssd,
        variationRatio,
        threshold: thresholdFactor,
        timestamp: new Date(currentTime).toISOString(),
        rrIntervals: lastIntervals
      });
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
  }, [addArrhythmiaWindow]);
  
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
      
      // Create visualization window
      let windowWidth = 1000; // Wider window for clear visualization
      addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      
      // Return true if this is a new arrhythmia notification
      return currentTime - lastArrhythmiaTriggeredRef.current > MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL;
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
        // Mantener solo ventanas que estén dentro de los últimos 10 segundos
        const validWindows = prev.filter(window => 
          currentTime - window.end < 15000
        );
        
        // Only update if there were changes
        if (validWindows.length !== prev.length) {
          return validWindows;
        }
        return prev;
      });
    }, 5000); // Clean every 5 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  /**
   * Force add an arrhythmia window - useful for testing and manual triggers
   */
  const forceAddArrhythmiaWindow = useCallback(() => {
    const now = Date.now();
    addArrhythmiaWindow(now - 500, now + 500);
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
