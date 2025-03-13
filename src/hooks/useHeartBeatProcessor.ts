import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  detectedPeaks?: {timestamp: number, value: number, isArrhythmia?: boolean, offset?: number}[];
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processingStatsRef = useRef<{
    latency: number;
    peakTimestamps: number[];
  }>({
    latency: 0,
    peakTimestamps: []
  });
  const inputBufferRef = useRef<{value: number, timestamp: number}[]>([]);
  const MAX_BUFFER_SIZE = 2; // Minimal buffer for low latency
  const maxLatencyRef = useRef<number>(0);
  const lastProcessedTimestampRef = useRef<number>(0);
  const realTimeRef = useRef<number>(Date.now());
  const detectedPeaksRef = useRef<{timestamp: number, value: number, isArrhythmia?: boolean, offset?: number}[]>([]);
  const peakValueHistoryRef = useRef<number[]>([]);
  const activeValueRef = useRef<number>(0);
  const peakCounterRef = useRef<number>(0);
  const lastArrhythmiaRef = useRef<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      realTimeRef.current = Date.now();
    }, 5); // 5ms update for precise timing
    
    console.log('useHeartBeatProcessor: Started high-precision timer');
    
    return () => {
      clearInterval(timer);
      console.log('useHeartBeatProcessor: Cleared high-precision timer');
    };
  }, []);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creating new HeartBeatProcessor instance', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registered in window', {
        processorRegistered: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleaning processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
        console.log('useHeartBeatProcessor: Processor removed from window', {
          processorExists: !!(window as any).heartBeatProcessor,
          timestamp: new Date().toISOString()
        });
      }
    };
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor not initialized', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        },
        detectedPeaks: []
      };
    }

    const now = realTimeRef.current;
    activeValueRef.current = value;
    
    peakValueHistoryRef.current.push(value);
    if (peakValueHistoryRef.current.length > 20) {
      peakValueHistoryRef.current.shift();
    }
    
    let peakScaleFactor = 40; // Default scaling
    if (peakValueHistoryRef.current.length > 5) {
      const maxVal = Math.max(...peakValueHistoryRef.current);
      const minVal = Math.min(...peakValueHistoryRef.current);
      const range = maxVal - minVal;
      
      if (range > 0 && range < 0.1) {
        peakScaleFactor = 80; // Boost small signals
      } else if (range >= 0.1 && range < 0.5) {
        peakScaleFactor = 60; // Medium scaling
      } else if (range >= 0.5) {
        peakScaleFactor = 40; // Normal scaling for large signals
      }
    }
    
    inputBufferRef.current.push({value, timestamp: now});
    if (inputBufferRef.current.length > MAX_BUFFER_SIZE) {
      inputBufferRef.current.shift();
    }
    
    const processStart = performance.now();
    const result = processorRef.current.processSignal(value);
    const processingLatency = performance.now() - processStart;
    
    if (processingLatency > maxLatencyRef.current) {
      maxLatencyRef.current = processingLatency;
    }
    
    lastProcessedTimestampRef.current = now;
    
    const rrData = processorRef.current.getRRIntervals();
    const processingStats = processorRef.current.getProcessingStats ? 
                            processorRef.current.getProcessingStats() : 
                            { latency: processingLatency };
    
    processingStatsRef.current.latency = processingStats.latency || processingLatency;
    
    const isArrhythmia = checkForArrhythmia(rrData);
    lastArrhythmiaRef.current = isArrhythmia;
    
    if (result.isPeak) {
      peakCounterRef.current++;
      const peakId = peakCounterRef.current;
      const peakScaleFactor = 100; // Higher scaling for visibility
      const scaledValue = value * peakScaleFactor;
      
      console.log('useHeartBeatProcessor - PEAK DETECTED!', {
        peakId,
        timestamp: now,
        value: value.toFixed(4),
        scaledValue: scaledValue.toFixed(2),
        isArrhythmia
      });
      
      processingStatsRef.current.peakTimestamps.push(now);
      if (processingStatsRef.current.peakTimestamps.length > 10) {
        processingStatsRef.current.peakTimestamps.shift();
      }
      
      detectedPeaksRef.current.push({
        timestamp: now,
        value: scaledValue,
        isArrhythmia
      });
      
      if (detectedPeaksRef.current.length > 40) {
        detectedPeaksRef.current.shift();
      }
    }

    if (result.confidence >= 0.65 && result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    const peaksCopy = detectedPeaksRef.current.map(peak => ({...peak}));

    if (peaksCopy.length > 0) {
      console.log('useHeartBeatProcessor - Returning peaks data:', {
        peakCount: peaksCopy.length,
        firstPeak: peaksCopy[0],
        lastPeak: peaksCopy[peaksCopy.length - 1],
        hasArrhythmia: peaksCopy.some(p => p.isArrhythmia)
      });
    }
    
    return {
      ...result,
      rrData,
      detectedPeaks: peaksCopy
    };
  }, []);

  const checkForArrhythmia = (rrData: {intervals: number[], lastPeakTime: number | null}): boolean => {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) {
      return false;
    }
    
    const recentIntervals = rrData.intervals.slice(-3);
    const avg = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    const lastInterval = recentIntervals[recentIntervals.length - 1];
    const percentDiff = Math.abs(lastInterval - avg) / avg;
    
    return percentDiff > 0.2;
  };

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString(),
      peakCount: detectedPeaksRef.current.length
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      console.log('useHeartBeatProcessor: Processor reset successfully', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('useHeartBeatProcessor: Could not reset - processor does not exist', {
        timestamp: new Date().toISOString()
      });
    }
    
    processingStatsRef.current = {
      latency: 0,
      peakTimestamps: []
    };
    
    inputBufferRef.current = [];
    detectedPeaksRef.current = [];
    peakValueHistoryRef.current = [];
    maxLatencyRef.current = 0;
    lastProcessedTimestampRef.current = 0;
    activeValueRef.current = 0;
    lastArrhythmiaRef.current = false;
    
    setCurrentBPM(0);
    setConfidence(0);
  }, [currentBPM, confidence]);

  const getProcessingStats = useCallback(() => {
    const stats = { 
      ...processingStatsRef.current,
      maxLatency: maxLatencyRef.current,
      inputBufferSize: inputBufferRef.current.length,
      lastProcessedTimestamp: lastProcessedTimestampRef.current,
      timeSinceLastProcessed: realTimeRef.current - lastProcessedTimestampRef.current,
      realTime: realTimeRef.current,
      peaksCount: detectedPeaksRef.current.length,
      activeValue: activeValueRef.current
    };
    
    return stats;
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    getProcessingStats
  };
};
