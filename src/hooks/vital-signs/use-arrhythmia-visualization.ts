
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

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
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 10000; // 10 seconds between notifications
  
  // Detection configuration
  const DETECTION_THRESHOLD = 0.25; // Threshold for variation ratio to detect arrhythmia
  
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
      
      // Limit to the 3 most recent windows
      return sortedWindows.slice(0, 3);
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
   * Using direct measurement algorithms only
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
      thresholdFactor = 0.20;
    } else if (stabilityCounterRef.current < 5) {
      thresholdFactor = 0.30;
    }
    
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      stabilityCounterRef.current = Math.min(30, stabilityCounterRef.current + 1);
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Require more stability before reporting arrhythmia
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 10;
    
    if (isArrhythmia) {
      // Generate an arrhythmia window when detected
      const currentTime = Date.now();
      const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
      const windowWidth = Math.max(600, Math.min(1000, avgInterval * 2));
      
      addArrhythmiaWindow(currentTime - windowWidth/2, currentTime + windowWidth/2);
      
      console.log("Arrhythmia detected", {
        rmssd,
        variationRatio,
        threshold: thresholdFactor,
        timestamp: new Date(currentTime).toISOString()
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
        arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
        lastArrhythmiaData) {
      
      const arrhythmiaTime = lastArrhythmiaData.timestamp;
      
      // Create visualization window
      let windowWidth = 800; // Wider window for clear visualization
      addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      
      // Return true if this is a new arrhythmia notification
      return currentTime - lastArrhythmiaTriggeredRef.current > MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL;
    }
    
    return false;
  }, [addArrhythmiaWindow]);
  
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
          currentTime - window.end < 10000
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
    clearArrhythmiaWindows,
    detectArrhythmia,
    processArrhythmiaStatus,
    registerArrhythmiaNotification,
    reset,
    lastIsArrhythmiaRef
  };
};
