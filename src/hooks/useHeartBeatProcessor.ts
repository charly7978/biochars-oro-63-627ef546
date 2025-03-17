
import { useCallback, useEffect, useRef, useState } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const [lastResult, setLastResult] = useState<HeartBeatResult>({
    bpm: 0,
    confidence: 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  });

  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isMonitoringRef = useRef<boolean>(false);
  const processedSignals = useRef<number>(0);

  // Initialize processor on mount
  useEffect(() => {
    console.log("useHeartBeatProcessor: Initializing new processor", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    processorRef.current = new HeartBeatProcessor();
    processorRef.current.setMonitoring(false);

    return () => {
      console.log("useHeartBeatProcessor: Cleanup", {
        sessionId: sessionId.current,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  const startMonitoring = useCallback(() => {
    if (processorRef.current) {
      console.log("useHeartBeatProcessor: Starting monitoring", {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (processorRef.current) {
      console.log("useHeartBeatProcessor: Stopping monitoring", {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
    }
  }, []);

  const processSignal = useCallback((signalValue: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn("useHeartBeatProcessor: Processor not initialized");
      return {
        bpm: 0,
        confidence: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    processedSignals.current++;

    // Process signal
    const result = processorRef.current.processSignal(signalValue);
    const rrData = processorRef.current.getRRIntervals();

    // Limit how many intervals we pass back
    const limitedIntervals = rrData.intervals.slice(-30);

    const finalResult: HeartBeatResult = {
      bpm: result.bpm,
      confidence: result.confidence,
      rrData: {
        intervals: limitedIntervals,
        lastPeakTime: rrData.lastPeakTime
      }
    };

    // Periodically log (not every time to avoid overwhelming logs)
    if (processedSignals.current % 100 === 0) {
      console.log("useHeartBeatProcessor: Processing signal", {
        inputValue: signalValue,
        bpm: result.bpm,
        confidence: result.confidence,
        rrIntervals: limitedIntervals.length,
        signalCount: processedSignals.current,
        isMonitoring: isMonitoringRef.current
      });
    }

    setLastResult(finalResult);
    return finalResult;
  }, []);

  const reset = useCallback(() => {
    if (processorRef.current) {
      console.log("useHeartBeatProcessor: Resetting processor", {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      processorRef.current.reset();
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      processedSignals.current = 0;
      
      setLastResult({
        bpm: 0,
        confidence: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      });
    }
  }, []);

  return {
    processSignal,
    startMonitoring,
    stopMonitoring,
    reset,
    lastResult
  };
};
