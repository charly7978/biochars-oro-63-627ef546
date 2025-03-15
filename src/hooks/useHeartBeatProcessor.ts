
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
  const arrhythmiaCountRef = useRef<number>(0);

  useEffect(() => {
    // High-precision timer for accurate timing
    const timer = setInterval(() => {
      realTimeRef.current = Date.now();
    }, 5);
    
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
      // Make processor accessible for debugging
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
    
    // Track peak value history for scaling
    peakValueHistoryRef.current.push(value);
    if (peakValueHistoryRef.current.length > 20) {
      peakValueHistoryRef.current.shift();
    }
    
    // Adaptive peak scaling based on signal characteristics
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
    
    // Buffer inputs with timestamps for processing latency calculation
    inputBufferRef.current.push({value, timestamp: now});
    if (inputBufferRef.current.length > MAX_BUFFER_SIZE) {
      inputBufferRef.current.shift();
    }
    
    // Process signal with performance measurement
    const processStart = performance.now();
    const result = processorRef.current.processSignal(value);
    const processingLatency = performance.now() - processStart;
    
    if (processingLatency > maxLatencyRef.current) {
      maxLatencyRef.current = processingLatency;
    }
    
    lastProcessedTimestampRef.current = now;
    
    // Get RR interval data for advanced analysis
    const rrData = processorRef.current.getRRIntervals ? 
                   processorRef.current.getRRIntervals() : 
                   { intervals: [], lastPeakTime: null };
    
    // Get processing stats if available
    const processingStats = processorRef.current.getProcessingStats ? 
                            processorRef.current.getProcessingStats() : 
                            { latency: processingLatency };
    
    processingStatsRef.current.latency = processingStats.latency || processingLatency;
    
    // Process detected peaks from the result
    if (result.detectedPeaks && result.detectedPeaks.length > 0) {
      // Update our local peaks reference
      detectedPeaksRef.current = result.detectedPeaks.map(peak => ({
        ...peak,
        // Ensure value is properly scaled for visualization
        value: typeof peak.value === 'number' ? peak.value : 0
      }));
      
      // Count arrhythmias
      const arrhythmiaCount = result.detectedPeaks.filter(p => p.isArrhythmia).length;
      if (arrhythmiaCount > arrhythmiaCountRef.current) {
        console.log('useHeartBeatProcessor: Arrhythmia count updated', {
          previous: arrhythmiaCountRef.current,
          current: arrhythmiaCount
        });
        arrhythmiaCountRef.current = arrhythmiaCount;
      }
    }
    
    // Process result.isPeak for immediate peaks
    if (result.isPeak) {
      peakCounterRef.current++;
      const peakId = peakCounterRef.current;
      
      // If a peak is detected but somehow not in detectedPeaks, add it manually
      if (!result.detectedPeaks || result.detectedPeaks.length === 0) {
        console.log('useHeartBeatProcessor - Peak detected but not in peaks array, adding manually', {
          peakId,
          timestamp: now,
          value: value.toFixed(4)
        });
        
        // Check if this could be an arrhythmia
        const isArrhythmia = checkForArrhythmia(rrData);
        
        // Store for visualization (scale value for display)
        const scaledValue = value * 100;
        
        detectedPeaksRef.current.push({
          timestamp: now,
          value: scaledValue,
          isArrhythmia
        });
        
        // Limit the number of stored peaks
        if (detectedPeaksRef.current.length > 40) {
          detectedPeaksRef.current.shift();
        }
      }
      
      processingStatsRef.current.peakTimestamps.push(now);
      if (processingStatsRef.current.peakTimestamps.length > 10) {
        processingStatsRef.current.peakTimestamps.shift();
      }
    }

    // Update BPM if confidence is good
    if (result.confidence >= 0.65 && result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Make a deep copy of peaks to prevent reference issues
    const peaksCopy = detectedPeaksRef.current.map(peak => ({...peak}));

    // Log peaks data for debugging
    if (peaksCopy.length > 0 && peaksCopy.length % 5 === 0) {
      console.log('useHeartBeatProcessor - Current peaks data:', {
        peakCount: peaksCopy.length,
        firstPeak: peaksCopy[0],
        lastPeak: peaksCopy[peaksCopy.length - 1],
        hasArrhythmia: peaksCopy.some(p => p.isArrhythmia),
        arrhythmiaCount: peaksCopy.filter(p => p.isArrhythmia).length
      });
    }
    
    return {
      ...result,
      rrData,
      detectedPeaks: peaksCopy,
      arrhythmiaCount: arrhythmiaCountRef.current
    };
  }, []);

  // Helper function to check for arrhythmia
  const checkForArrhythmia = (rrData: {intervals: number[], lastPeakTime: number | null}): boolean => {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) {
      return false;
    }
    
    const recentIntervals = rrData.intervals.slice(-3);
    const avg = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    const lastInterval = recentIntervals[recentIntervals.length - 1];
    
    // Detect significant deviation (>20%)
    const percentDiff = Math.abs(lastInterval - avg) / avg;
    const isArrhythmia = percentDiff > 0.2;
    
    if (isArrhythmia && !lastArrhythmiaRef.current) {
      console.log('useHeartBeatProcessor: Arrhythmia detected', {
        percentDiff: (percentDiff * 100).toFixed(1) + '%',
        threshold: '20%',
        lastInterval,
        avgInterval: avg,
        timestamp: new Date().toISOString()
      });
    }
    
    lastArrhythmiaRef.current = isArrhythmia;
    return isArrhythmia;
  };

  // Reset all state
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
    
    // Reset all local state
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
    arrhythmiaCountRef.current = 0;
    
    setCurrentBPM(0);
    setConfidence(0);
  }, [currentBPM, confidence]);

  // Get processing stats for debugging
  const getProcessingStats = useCallback(() => {
    const stats = { 
      ...processingStatsRef.current,
      maxLatency: maxLatencyRef.current,
      inputBufferSize: inputBufferRef.current.length,
      lastProcessedTimestamp: lastProcessedTimestampRef.current,
      timeSinceLastProcessed: realTimeRef.current - lastProcessedTimestampRef.current,
      realTime: realTimeRef.current,
      peaksCount: detectedPeaksRef.current.length,
      activeValue: activeValueRef.current,
      arrhythmiaCount: arrhythmiaCountRef.current
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
