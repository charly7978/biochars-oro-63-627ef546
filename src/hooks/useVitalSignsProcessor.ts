
import { useState, useRef, useCallback, useEffect } from 'react';
import { VitalSignsProcessor } from '../modules/VitalSignsProcessor';
import type { VitalSignsResult } from '../types/vital-signs';
import { ArrhythmiaWindow, ArrhythmiaAnalyzer, ArrhythmiaConfig } from './arrhythmia/arrhythmiaTypes';
import { updateSignalLog } from '../utils/signalLogUtils';

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
  const calibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const calibrationProgressRef = useRef<number>(0);
  
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
  
  // Track when calibration was last checked
  const calibrationCheckIntervalRef = useRef<number>(0);
  const CALIBRATION_CHECK_INTERVAL = 50; // ms
  
  // Initialize processor components - always direct measurement
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances to ensure clean state
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaAnalyzerRef.current = new ArrhythmiaAnalyzer(arrhythmiaConfig.current);
    
    // Set up an interval to continuously check calibration progress
    const checkInterval = setInterval(() => {
      if (processorRef.current) {
        const progress = processorRef.current.getCalibrationProgress();
        calibrationProgressRef.current = progress;
        console.log("useVitalSignsProcessor: Continuous calibration check:", progress);
      }
    }, 200); // Check every 200ms
    
    calibrationIntervalRef.current = checkInterval;
    
    return () => {
      if (calibrationIntervalRef.current) {
        clearInterval(calibrationIntervalRef.current);
        calibrationIntervalRef.current = null;
      }
      
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
   * Process PPG signal with improved calibration feedback
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
    
    // More frequent logging for calibration progress
    const now = Date.now();
    if (now - calibrationCheckIntervalRef.current > CALIBRATION_CHECK_INTERVAL) {
      calibrationCheckIntervalRef.current = now;
      
      // Log calibration progress more frequently during early calibration phase
      if (!processorRef.current.isCalibrationComplete() && processedSignals.current < 100) {
        const progress = processorRef.current.getCalibrationProgress();
        calibrationProgressRef.current = progress;
        console.log("useVitalSignsProcessor: Current calibration progress:", progress);
      }
    }
    
    // Periodic logging for calibration progress - helps debug stalled calibration
    if (processedSignals.current % 10 === 0) {
      const progress = processorRef.current.getCalibrationProgress();
      calibrationProgressRef.current = progress;
      console.log("useVitalSignsProcessor: Calibration progress check:", {
        progress,
        phase: processorRef.current.isCalibrationComplete() ? 'completed' : 'calibrating',
        processedSignals: processedSignals.current,
        value: Math.abs(value)
      });
    }
    
    // Check for weak signal to detect finger removal
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
      
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
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
      consecutiveWeakSignalsRef.current = 0;
    }
    
    // Periodic logging for debugging (reduced frequency)
    if (processedSignals.current % 100 === 0) {
      console.log("useVitalSignsProcessor: Processing signal", {
        inputValue: value,
        rrDataPresent: !!rrData,
        calibrationProgress: processorRef.current.getCalibrationProgress()
      });
    }
    
    // Process signal through the processor
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Process arrhythmias if there is enough data and signal is good
    if (rrData && 
        rrData.intervals.length >= 4 && 
        consecutiveWeakSignalsRef.current === 0) {
      
      // Only process with good RR data quality
      const validRRIntervals = rrData.intervals.filter(interval => 
        interval > 400 && interval < 1500
      );
      
      if (validRRIntervals.length >= 3) {
        // Analyze data directly
        const arrhythmiaResult = arrhythmiaAnalyzerRef.current.analyzeRRData(rrData, result);
        result = arrhythmiaResult;
        
        // Handle arrhythmia visualization
        if (result.arrhythmiaStatus.includes("ARRITMIA DETECTADA") && result.lastArrhythmiaData) {
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
    
    // Update signal log
    signalLog.current = updateSignalLog(signalLog.current, currentTime, value, result, processedSignals.current);
    
    return result;
  }, [addArrhythmiaWindow]);
  
  /**
   * Check if calibration is complete
   */
  const isCalibrationComplete = useCallback(() => {
    if (!processorRef.current) return false;
    const isComplete = processorRef.current.isCalibrationComplete();
    console.log("useVitalSignsProcessor: Calibration complete check:", isComplete);
    return isComplete;
  }, []);
  
  /**
   * Get current calibration progress percentage
   */
  const getCalibrationProgress = useCallback(() => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized for getCalibrationProgress");
      return 1;
    }
    const progress = processorRef.current.getCalibrationProgress();
    calibrationProgressRef.current = progress;
    
    // More frequent logging for debugging early calibration
    if (progress < 10 || progress % 10 < 1) {
      console.log("useVitalSignsProcessor: Calibration progress update:", progress);
    }
    
    return progress;
  }, []);

  /**
   * Reset processors but retain last valid results
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !arrhythmiaAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated with calibration");
    
    const lastResults = processorRef.current.reset();
    if (lastResults) {
      setLastValidResults(lastResults);
    }
    
    arrhythmiaAnalyzerRef.current.reset();
    setArrhythmiaWindows([]);
    lastBPUpdateRef.current = Date.now();
    consecutiveWeakSignalsRef.current = 0;
    calibrationProgressRef.current = 1;
    
    console.log("useVitalSignsProcessor: Reset completed with calibration retention");
    return lastResults;
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
    lastBPUpdateRef.current = Date.now();
    consecutiveWeakSignalsRef.current = 0;
    calibrationProgressRef.current = 1;
    
    console.log("useVitalSignsProcessor: Full reset complete - all data cleared");
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    isCalibrationComplete,
    getCalibrationProgress,
    arrhythmiaCounter: arrhythmiaAnalyzerRef.current?.getArrhythmiaCount() || 0,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10),
      calibrationProgress: calibrationProgressRef.current
    }
  };
};
