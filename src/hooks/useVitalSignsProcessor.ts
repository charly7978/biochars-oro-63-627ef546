
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
 * Measurements always start from zero
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
  
  // Configuration with wider physiological ranges
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 8000, // 8 seconds between arrhythmias (reduced from 10000)
    MAX_ARRHYTHMIAS_PER_SESSION: 20,    // Increased from 10
    SIGNAL_QUALITY_THRESHOLD: 0.40,     // Reduced from 0.60 for lower quality threshold
    SEQUENTIAL_DETECTION_THRESHOLD: 0.40, // Reduced from 0.50
    SPECTRAL_FREQUENCY_THRESHOLD: 0.25    // Reduced from 0.35
  });
  
  // Initialize processor components
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor with zero reference", {
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
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) {
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
    
    // Logging for diagnostics (less frequent)
    if (processedSignals.current % 50 === 0) {
      console.log("useVitalSignsProcessor: Processing signal", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: arrhythmiaAnalyzerRef.current.getArrhythmiaCount(),
        signalNumber: processedSignals.current,
        sessionId: sessionId.current
      });
    }
    
    // Process signal directly through processor
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Process arrhythmias if there is enough data
    if (rrData && rrData.intervals.length >= 6) {
      // Analyze data directly
      const arrhythmiaResult = arrhythmiaAnalyzerRef.current.analyzeRRData(rrData, result);
      result = arrhythmiaResult;
      
      // If arrhythmia is detected, register visualization window
      if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Window based on heart rate
        let windowWidth = 600; // 600ms default
        
        // Adjust based on RR intervals
        if (rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-5);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          windowWidth = Math.max(400, Math.min(1000, avgInterval * 1.2));
        }
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
    }
    
    // Update signal log
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Only store valid results for this session, never reuse past results
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      if (processedSignals.current % 50 === 0) {
        console.log("useVitalSignsProcessor: New measurements", {
          spo2: result.spo2,
          pressure: result.pressure,
          glucose: result.glucose,
          lipids: result.lipids,
          timestamp: new Date().toISOString()
        });
      }
      setLastValidResults(result);
    }
    
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Perform complete reset - always start measurements from zero
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - starting from zero");
    
    processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
    setLastValidResults(null); // Always clear previous results
    
    console.log("Reset completed - all values at zero");
    return null; // Always return null to ensure measurements start from zero
  }, []);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - starting new session");
    
    processorRef.current.fullReset();
    arrhythmiaAnalyzerRef.current.reset();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
    processedSignals.current = 0;
    signalLog.current = [];
    console.log("Full reset complete - all data cleared");
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
