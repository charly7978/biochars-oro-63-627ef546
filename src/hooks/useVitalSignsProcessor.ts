
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { updateSignalLog } from '../utils/signalLogUtils';
import { ArrhythmiaAnalyzer } from './arrhythmia/ArrhythmiaAnalyzer';
import { ProcessingConfig } from './arrhythmia/types';

/**
 * Hook for processing vital signs with direct algorithms
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const heartRateAnalyzerRef = useRef<ArrhythmiaAnalyzer | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Configuration with wider physiological ranges for direct measurement
  const processingConfig = useRef<ProcessingConfig>({
    SIGNAL_QUALITY_THRESHOLD: 0.45
  });
  
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
    heartRateAnalyzerRef.current = new ArrhythmiaAnalyzer(processingConfig.current);
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Process PPG signal
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => {
    if (!processorRef.current || !heartRateAnalyzerRef.current) {
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
    
    // Process signal directly through processor
    let result = processorRef.current.processSignal(value, rrData);
    const currentTime = Date.now();
    
    // Process heart rate data if there is enough data and signal is good
    if (rrData && 
        rrData.intervals.length >= 4 && 
        consecutiveWeakSignalsRef.current === 0) {
      
      // Only process with good RR data quality
      const validRRIntervals = rrData.intervals.filter(interval => 
        interval > 400 && interval < 1500 // Range: 40-150 BPM
      );
      
      if (validRRIntervals.length >= 3) {
        // Analyze data directly
        result = heartRateAnalyzerRef.current.analyzeRRData(rrData, result);
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
    
    // Always return current result
    return result;
  }, []);

  /**
   * Perform complete reset
   */
  const reset = useCallback(() => {
    if (!processorRef.current || !heartRateAnalyzerRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.reset();
    heartRateAnalyzerRef.current.reset();
    setLastValidResults(null);
    lastBPUpdateRef.current = Date.now();
    consecutiveWeakSignalsRef.current = 0;
    
    console.log("useVitalSignsProcessor: Reset completed - all values at zero for direct measurement");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data and reinitialize processors
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current || !heartRateAnalyzerRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode");
    
    processorRef.current.fullReset();
    heartRateAnalyzerRef.current.reset();
    setLastValidResults(null);
    processedSignals.current = 0;
    signalLog.current = [];
    lastBPUpdateRef.current = Date.now();
    consecutiveWeakSignalsRef.current = 0;
    
    console.log("useVitalSignsProcessor: Full reset complete - direct measurement mode active");
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: 0,
    lastValidResults: null,
    arrhythmiaWindows: [],
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};
