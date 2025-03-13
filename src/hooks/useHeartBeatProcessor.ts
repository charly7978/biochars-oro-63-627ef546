
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
  const MAX_BUFFER_SIZE = 3; // Reduced from 10 to minimize delay
  const maxLatencyRef = useRef<number>(0);
  const lastProcessedTimestampRef = useRef<number>(0);
  const realTimeRef = useRef<number>(Date.now());

  // Add timer to update realTimeRef with precision
  useEffect(() => {
    const timer = setInterval(() => {
      realTimeRef.current = Date.now();
    }, 10); // Update every 10ms for more precise timing
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creando nueva instancia de HeartBeatProcessor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registrado en window', {
        processorRegistrado: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
        console.log('useHeartBeatProcessor: Processor eliminado de window', {
          processorExiste: !!(window as any).heartBeatProcessor,
          timestamp: new Date().toISOString()
        });
      }
    };
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor no inicializado', {
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

    // Use precise realtime instead of Date.now() for better synchronization
    const now = realTimeRef.current;
    
    // Minimize input buffer to reduce delay
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
    
    // Synchronize peak timing with current time to reduce visual delay
    if (result.isPeak) {
      // Add current time for accurate peak display
      processingStatsRef.current.peakTimestamps.push(now);
      
      if (processingStatsRef.current.peakTimestamps.length > 10) {
        processingStatsRef.current.peakTimestamps.shift();
      }
      
      console.log('useHeartBeatProcessor - PEAK DETECTED:', {
        timestamp: now,
        systemTime: new Date().toISOString(),
        peakValue: value,
        processingLatency: processingLatency.toFixed(2) + 'ms',
        bufferSize: inputBufferRef.current.length
      });
    }

    if (result.confidence < 0.7) {
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData,
        detectedPeaks: result.detectedPeaks
      };
    }

    if (result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Make sure detectedPeaks have accurate timestamps for rendering
    if (result.detectedPeaks && result.detectedPeaks.length > 0) {
      // Use current time rather than any delayed time for latest peak
      const latestPeakIndex = result.detectedPeaks.length - 1;
      if (result.isPeak && latestPeakIndex >= 0) {
        result.detectedPeaks[latestPeakIndex].timestamp = now;
      }
      
      // Ensure all peaks have timestamps
      result.detectedPeaks = result.detectedPeaks.map(peak => ({
        ...peak,
        timestamp: peak.timestamp || now
      }));
    }

    return {
      ...result,
      rrData,
      detectedPeaks: result.detectedPeaks
    };
  }, [currentBPM, confidence]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reseteando processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      console.log('useHeartBeatProcessor: Processor reseteado correctamente', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('useHeartBeatProcessor: No se pudo resetear - processor no existe', {
        timestamp: new Date().toISOString()
      });
    }
    
    processingStatsRef.current = {
      latency: 0,
      peakTimestamps: []
    };
    
    inputBufferRef.current = [];
    maxLatencyRef.current = 0;
    lastProcessedTimestampRef.current = 0;
    
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
      realTime: realTimeRef.current
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
