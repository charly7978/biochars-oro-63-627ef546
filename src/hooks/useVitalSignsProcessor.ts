
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer } from './arrhythmia/ArrhythmiaAnalyzer';
import { ArrhythmiaConfig } from './arrhythmia/types';

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Hook for processing vital signs with direct algorithms
 * Measurements ALWAYS start from zero with NO simulation
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaAnalyzerRef = useRef<ArrhythmiaAnalyzer | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Configuration with wider physiological ranges for direct measurement
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 3500, // 3.5 seconds between arrhythmias
    MAX_ARRHYTHMIAS_PER_SESSION: 40,    // Maximum arrhythmias per session
    SIGNAL_QUALITY_THRESHOLD: 0.45,     // Increased for more strict quality requirement
    SEQUENTIAL_DETECTION_THRESHOLD: 0.25, // Increased
    SPECTRAL_FREQUENCY_THRESHOLD: 0.15  // Increased
  });
  
  // Track when blood pressure values were last updated
  const lastBPUpdateRef = useRef<number>(Date.now());
  const forceBPUpdateInterval = useRef<number>(4000); // Force update every 4 seconds
  
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.10; // Increased threshold
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 3; // Decreased tolerance for weak signals
  
  // Initialize processor components - always direct measurement
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances to ensure clean state
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaAnalyzerRef.current?.getArrhythmiaCount() || 0,
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
   * ALWAYS uses direct measurement from signal
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) {
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
    
    // Check for weak signal to detect finger removal - stricter check
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
        arrhythmiaCount: arrhythmiaAnalyzerRef.current.getArrhythmiaCount(),
        signalNumber: processedSignals.current,
        sessionId: sessionId.current,
        weakSignalCount: consecutiveWeakSignalsRef.current
      });
    }
    
    // Process signal directly through processor - no simulation
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Process arrhythmias if there is enough data and signal is good
    // More strict requirements for valid signal
    if (rrData && 
        rrData.intervals.length >= 4 && // Increased requirement 
        consecutiveWeakSignalsRef.current === 0) {
      
      // Only process with good RR data quality
      const validRRIntervals = rrData.intervals.filter(interval => 
        interval > 400 && interval < 1500 // More strict range: 40-150 BPM
      );
      
      if (validRRIntervals.length >= 3) { // Require at least 3 valid intervals
        // Analyze data directly - no simulation
        const arrhythmiaResult = arrhythmiaAnalyzerRef.current.analyzeRRData(rrData, result);
        result = arrhythmiaResult;
        
        // If arrhythmia is detected, register visualization window
        if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
          const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
          
          // Window based on heart rate
          let windowWidth = 400; // 400ms default
          
          // Adjust based on RR intervals
          if (rrData.intervals.length > 0) {
            const lastIntervals = rrData.intervals.slice(-4);
            const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
            windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.1));
          }
          
          addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
        }
      }
    }
    
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
    
    // Always return current result, never cache old ones
    // This ensures every measurement is coming directly from the signal
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Perform complete reset - always start measurements from zero
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
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
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.fullReset();
    arrhythmiaAnalyzerRef.current.reset();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
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
    arrhythmiaCounter: arrhythmiaAnalyzerRef.current?.getArrhythmiaCount() || 0,
    lastValidResults: null, // Always return null to ensure measurements start from zero
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
