
import { useState, useCallback } from 'react';
import { ArrhythmiaWindow } from './types';
import { toast } from 'sonner';

export const useArrhythmiaVisualization = () => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  
  // Add a new arrhythmia window
  const addArrhythmiaWindow = useCallback((window: ArrhythmiaWindow) => {
    setArrhythmiaWindows(prev => [...prev, window]);
  }, []);
  
  // Add a timestamp-based arrhythmia window
  const addTimestampWindow = useCallback((timestamp: number, duration: number = 5000) => {
    const newWindow: ArrhythmiaWindow = {
      id: `arrhythmia-${timestamp}`,
      start: timestamp,
      end: timestamp + duration,
      type: 'irregular',
      intensity: 0.7
    };
    
    setArrhythmiaWindows(prev => [...prev, newWindow]);
  }, []);
  
  // Clear all arrhythmia windows
  const clearArrhythmiaWindows = useCallback(() => {
    setArrhythmiaWindows([]);
  }, []);
  
  // Process arrhythmia status for visualization
  const processArrhythmiaStatus = useCallback((status: string, data: any) => {
    // Check if status indicates arrhythmia
    if (status && status.includes('ARRHYTHMIA DETECTED')) {
      const now = Date.now();
      
      // Prevent too frequent notifications (minimum 5 seconds apart)
      if (now - lastNotificationTime > 5000) {
        setLastNotificationTime(now);
        
        // Create a new visualization window
        const newWindow: ArrhythmiaWindow = {
          id: `arrhythmia-${now}`,
          start: now,
          end: now + 5000,
          type: 'irregular',
          intensity: 0.7
        };
        
        setArrhythmiaWindows(prev => [...prev, newWindow]);
        return true; // Should notify
      }
    }
    
    return false; // No notification needed
  }, [lastNotificationTime]);
  
  // Register a notification for arrhythmia
  const registerArrhythmiaNotification = useCallback(() => {
    const now = Date.now();
    setLastNotificationTime(now);
    
    // Show toast notification
    toast.warning("¡Arritmia detectada!", {
      description: "Se ha detectado un posible patrón de arritmia.",
      duration: 5000
    });
    
    return true;
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    addTimestampWindow,
    clearArrhythmiaWindows,
    processArrhythmiaStatus,
    registerArrhythmiaNotification
  };
};
