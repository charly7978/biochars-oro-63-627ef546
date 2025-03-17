
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaProcessor } from '../modules/arrhythmia-processor';

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Hook for processing vital signs with direct algorithms
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaProcessorRef = useRef<ArrhythmiaProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.10;
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 3;
  
  // Initialize processor components
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances to ensure clean state
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaProcessorRef.current = new ArrhythmiaProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Register a new arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((start: number, end: number) => {
    // Limit to most recent arrhythmia windows for visualization
    setArrhythmiaWindows(prev => {
      const newWindows = [...prev, { start, end }];
      return newWindows.slice(-3); // Keep only the 3 most recent
    });
  }, []);
  
  /**
   * Process PPG signal directly without simulation or reference values
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    processedSignals.current++;
    
    // Check for weak signal to detect finger removal
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
      
      // If too many weak signals, return zeros
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        console.log("useVitalSignsProcessor: Too many weak signals, returning zeros", {
          weakSignals: consecutiveWeakSignalsRef.current,
          threshold: MAX_CONSECUTIVE_WEAK_SIGNALS,
          value
        });
        return {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "--",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          }
        };
      }
    } else {
      // Reset weak signal counter
      consecutiveWeakSignalsRef.current = 0;
    }
    
    // Process vital signs
    let result = processorRef.current.processSignal(value, rrData);
    
    // Process arrhythmias if there is enough data and signal is good
    if (rrData && rrData.intervals.length >= 4 && consecutiveWeakSignalsRef.current === 0) {
      const arrhythmiaResult = arrhythmiaProcessorRef.current.processRRData(rrData);
      
      // Add arrhythmia status to result
      result = {
        ...result,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus
      };
      
      // If new arrhythmia detected, register visualization window
      if (
        arrhythmiaResult.lastArrhythmiaData && 
        arrhythmiaResult.lastArrhythmiaData.timestamp > lastArrhythmiaTimeRef.current
      ) {
        lastArrhythmiaTimeRef.current = arrhythmiaResult.lastArrhythmiaData.timestamp;
        
        // Create arrhythmia window
        const timestamp = arrhythmiaResult.lastArrhythmiaData.timestamp;
        const avgInterval = rrData.intervals.length > 0 
          ? rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length
          : 800;
          
        const windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.2));
        addArrhythmiaWindow(timestamp - windowWidth/2, timestamp + windowWidth/2);
      }
    }
    
    // Log processed signals less frequently
    if (processedSignals.current % 100 === 0) {
      console.log("useVitalSignsProcessor: Processing status", {
        processed: processedSignals.current,
        pressure: result.pressure,
        spo2: result.spo2,
        glucose: result.glucose,
        arrhythmiaStatus: result.arrhythmiaStatus,
        weakSignalCount: consecutiveWeakSignalsRef.current
      });
    }
    
    // Update signal log
    const currentTime = Date.now();
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Perform complete reset - always start measurements from zero
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated");
    
    processorRef.current.reset();
    arrhythmiaProcessorRef.current.reset();
    setArrhythmiaWindows([]);
    setLastValidResults(null);
    lastArrhythmiaTimeRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    
    console.log("useVitalSignsProcessor: Reset completed");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated");
    
    processorRef.current.fullReset();
    arrhythmiaProcessorRef.current.reset();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
    processedSignals.current = 0;
    signalLog.current = [];
    lastArrhythmiaTimeRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    
    console.log("useVitalSignsProcessor: Full reset complete");
  }, []);

  /**
   * Get the arrhythmia processor instance for external access
   */
  const getArrhythmiaProcessor = useCallback(() => {
    return arrhythmiaProcessorRef.current;
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    getArrhythmiaProcessor,
    arrhythmiaCounter: arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0,
    lastValidResults: null,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
