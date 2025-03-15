
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
}

export const useHeartBeatProcessor = () => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));

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
      console.log('useHeartBeatProcessor: Cleaning up processor', {
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
        }
      };
    }

    console.log('useHeartBeatProcessor - processSignal detailed:', {
      inputValue: value,
      normalizedValue: value.toFixed(2),
      currentProcessor: !!processorRef.current,
      processorMethods: processorRef.current ? Object.getOwnPropertyNames(Object.getPrototypeOf(processorRef.current)) : [],
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();

    console.log('useHeartBeatProcessor - detailed result:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      rrIntervals: JSON.stringify(rrData.intervals),
      recentIntervals: rrData.intervals.slice(-5),
      lastPeak: rrData.lastPeakTime,
      timeSinceLastPeak: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // More permissive confidence threshold (reduced from 0.7 to 0.4)
    if (result.confidence < 0.4) {
      console.log('useHeartBeatProcessor: Low confidence, but still processing peak', { 
        confidence: result.confidence.toFixed(2)
      });
      // Still continue processing with low confidence
    }

    if (result.bpm > 0) {
      console.log('useHeartBeatProcessor - Updating BPM and confidence', {
        prevBPM: currentBPM,
        newBPM: result.bpm,
        prevConfidence: confidence,
        newConfidence: result.confidence,
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      rrData
    };
  }, [currentBPM, confidence]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
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
    
    setCurrentBPM(0);
    setConfidence(0);
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset
  };
};
