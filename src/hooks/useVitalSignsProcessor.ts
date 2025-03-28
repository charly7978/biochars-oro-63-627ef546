
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
 * Advanced hook for processing vital signs with cutting-edge algorithms
 * Implements natural signal processing and accurate arrhythmia detection
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
  
  // Advanced configuration with optimized parameters
  const arrhythmiaConfig = useRef<ArrhythmiaConfig>({
    MIN_TIME_BETWEEN_ARRHYTHMIAS: 10000, // 10 seconds between arrhythmias
    MAX_ARRHYTHMIAS_PER_SESSION: 10,     // Maximum 10 per session to avoid data loss
    SIGNAL_QUALITY_THRESHOLD: 0.60,      // Adjusted quality threshold
    SEQUENTIAL_DETECTION_THRESHOLD: 0.50, // Sequential detection threshold
    SPECTRAL_FREQUENCY_THRESHOLD: 0.35    // Frequency validation threshold
  });
  
  // Initialize processor components
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor with new configuration", {
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
   * Process PPG signal using advanced algorithms for vital signs extraction
   * and arrhythmia detection with real-time classification
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
    
    // Processing log for diagnostics
    if (processedSignals.current % 30 === 0) {
      console.log("useVitalSignsProcessor: Processing signal", {
        inputValue: value,
        rrDataPresent: !!rrData,
        rrIntervals: rrData?.intervals.length || 0,
        arrhythmiaCount: arrhythmiaAnalyzerRef.current.getArrhythmiaCount(),
        signalNumber: processedSignals.current,
        sessionId: sessionId.current
      });
    }
    
    // Process signal through main processor
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Process arrhythmias only if there is enough data
    if (rrData && rrData.intervals.length >= 6) {
      // Analyze data with advanced algorithms
      const arrhythmiaResult = arrhythmiaAnalyzerRef.current.analyzeRRData(rrData, result);
      result = arrhythmiaResult;
      
      // If arrhythmia is detected, register visualization window
      if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Dynamic window based on heart rate
        let windowWidth = 600; // 600ms default window
        
        // Adjust width based on RR intervals
        if (rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-5);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          // Window proportional to RR interval
          windowWidth = Math.max(400, Math.min(1000, avgInterval * 1.2));
        }
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
    }
    
    // Update signal log
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    // Store valid results
    if (result.spo2 > 0 && result.glucose > 0 && result.lipids.totalCholesterol > 0) {
      if (processedSignals.current % 50 === 0) {
        console.log("useVitalSignsProcessor: Valid result detected", {
          spo2: result.spo2,
          pressure: result.pressure,
          timestamp: new Date().toISOString()
        });
      }
      setLastValidResults(result);
    }
    
    return result;
  }, [addArrhythmiaWindow]);

  /**
   * Perform soft reset - maintain results but reinitialize processors
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Soft reset initiated");
    
    const savedResults = processorRef.current.reset();
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
    
    if (savedResults) {
      setLastValidResults(savedResults);
    }
    
    console.log("Soft reset completed - keeping results");
    return savedResults;
  }, []);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated");
    
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
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
