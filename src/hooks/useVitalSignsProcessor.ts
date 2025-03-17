
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';

/**
 * Hook for processing vital signs with direct algorithms
 * Measurements ALWAYS start from zero with NO simulation
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Track when blood pressure values were last updated
  const lastBPUpdateRef = useRef<number>(Date.now());
  const forceBPUpdateInterval = useRef<number>(4000); // Force update every 4 seconds
  
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
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Process PPG signal directly without simulation or reference values
   * ALWAYS uses direct measurement from signal
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current) {
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
    
    // Logging for diagnostics (less frequent)
    if (processedSignals.current % 45 === 0) {
      console.log("useVitalSignsProcessor: Processing signal DIRECTLY", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        signalNumber: processedSignals.current,
        sessionId: sessionId.current,
        weakSignalCount: consecutiveWeakSignalsRef.current
      });
    }
    
    // Process signal directly through processor - no simulation
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Log processed signals every 100 frames
    if (processedSignals.current % 100 === 0) {
      console.log("useVitalSignsProcessor: Processing status", {
        processed: processedSignals.current,
        pressure: result.pressure,
        spo2: result.spo2,
        glucose: result.glucose,
        hasValidBP: result.pressure !== "--/--",
        timeSinceLastBPUpdate: currentTime - lastBPUpdateRef.current,
        weakSignalCount: consecutiveWeakSignalsRef.current
      });
    }
    
    // Update signal log
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Ensure arrhythmia status is empty
    result.arrhythmiaStatus = "--";
    
    // Always return current result, never cache old ones
    return result;
  }, []);

  /**
   * Perform complete reset - always start measurements from zero
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.reset();
    setLastValidResults(null); // Always clear previous results
    lastBPUpdateRef.current = Date.now(); // Reset BP update timer
    consecutiveWeakSignalsRef.current = 0; // Reset weak signal counter
    
    console.log("useVitalSignsProcessor: Reset completed - all values at zero for direct measurement");
    return null; // Always return null to ensure measurements start from zero
  }, []);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.fullReset();
    setLastValidResults(null);
    processedSignals.current = 0;
    signalLog.current = [];
    lastBPUpdateRef.current = Date.now(); // Reset BP update timer
    consecutiveWeakSignalsRef.current = 0; // Reset weak signal counter
    
    console.log("useVitalSignsProcessor: Full reset complete - direct measurement mode active");
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults: null, // Always return null to ensure measurements start from zero
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
