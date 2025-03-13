
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
  detectedPeaks?: {timestamp: number, value: number}[];
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
  const detectedPeaksRef = useRef<{timestamp: number, value: number, isArrhythmia?: boolean}[]>([]);
  const peakValueHistoryRef = useRef<number[]>([]);
  const activeValueRef = useRef<number>(0);

  // High precision timer for real-time tracking
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

    // Capture precise current time for synchronization
    const now = realTimeRef.current;
    activeValueRef.current = value;
    
    console.log('useHeartBeatProcessor - processSignal input:', {
      value: value.toFixed(4),
      timestamp: now,
      timeString: new Date(now).toISOString(),
      existingPeaks: detectedPeaksRef.current.length
    });
    
    // Track value history for scaling calculations
    peakValueHistoryRef.current.push(value);
    if (peakValueHistoryRef.current.length > 20) {
      peakValueHistoryRef.current.shift();
    }
    
    // Use minimal input buffering for low latency while maintaining signal quality
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
    const processingStats = processorRef.current.getProcessingStats();
    
    processingStatsRef.current.latency = processingStats.latency;
    
    console.log('useHeartBeatProcessor - processSignal result:', {
      bpm: result.bpm,
      isPeak: result.isPeak,
      confidence: result.confidence.toFixed(2),
      timestamp: now,
      processingLatency: processingLatency.toFixed(2) + 'ms',
      detectedPeaksCount: detectedPeaksRef.current.length
    });
    
    // CRITICAL FIX: When a peak is detected, record it for visualization with accurate timing
    if (result.isPeak) {
      console.log('useHeartBeatProcessor - PEAK DETECTED!', {
        timestamp: now,
        value: value.toFixed(4),
        isArrhythmia: result.arrhythmiaCount > 0
      });
      
      // Store peak information with current timestamp for minimal delay
      processingStatsRef.current.peakTimestamps.push(now);
      if (processingStatsRef.current.peakTimestamps.length > 10) {
        processingStatsRef.current.peakTimestamps.shift();
      }
      
      // Store peak for visualization with proper timestamp
      detectedPeaksRef.current.push({
        timestamp: now,
        value: value * 40, // Scale value for visualization
        isArrhythmia: result.arrhythmiaCount > 0
      });
      
      // Maintain reasonable buffer size
      if (detectedPeaksRef.current.length > 40) {
        detectedPeaksRef.current.shift();
      }
      
      console.log('useHeartBeatProcessor - Peak details:', {
        peakTime: new Date(now).toISOString(),
        peakValue: value.toFixed(4),
        scaledValue: (value * 40).toFixed(4),
        currentPeakCount: detectedPeaksRef.current.length,
        lastFewPeaks: detectedPeaksRef.current.slice(-3).map(p => ({
          time: new Date(p.timestamp).toISOString(),
          value: p.value.toFixed(2)
        }))
      });
    }

    // Only update BPM display when signal confidence is good
    if (result.confidence >= 0.65 && result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // CRITICAL FIX: Always provide all peak data to visualization component
    // This was missing before - the data wasn't being properly passed to the component
    const returnResult = {
      ...result,
      rrData,
      detectedPeaks: [...detectedPeaksRef.current] // Make sure to create a copy
    };
    
    // Debug log to verify peaks are included in the result
    console.log('useHeartBeatProcessor - Returning result with peaks:', {
      bpm: returnResult.bpm,
      confidence: returnResult.confidence.toFixed(2),
      peakCount: returnResult.detectedPeaks?.length || 0,
      hasData: returnResult.detectedPeaks && returnResult.detectedPeaks.length > 0,
      firstPeakTime: returnResult.detectedPeaks && returnResult.detectedPeaks.length > 0 ? 
        new Date(returnResult.detectedPeaks[0].timestamp).toISOString() : 'none'
    });
    
    return returnResult;
  }, []);

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
