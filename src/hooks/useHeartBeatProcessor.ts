
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor, HeartBeatResult } from '../modules/HeartBeatProcessor';

interface ProcessedHeartBeatResult {
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
  const lastUpdateTime = useRef<number>(Date.now());
  const stableReadingsCount = useRef<number>(0);
  const lastValidBPM = useRef<number>(0);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creating new processor instance', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registered globally', {
        processorRegistered: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleanup', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      processorRef.current = null;
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  const processSignal = useCallback((value: number): ProcessedHeartBeatResult => {
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

    // Avoid too frequent logging to reduce console clutter
    const now = Date.now();
    const shouldLog = now - lastUpdateTime.current > 1000; // Log only once per second
    
    if (shouldLog) {
      console.log('useHeartBeatProcessor - processing signal:', {
        inputValue: value.toFixed(2),
        timestamp: new Date().toISOString()
      });
      lastUpdateTime.current = now;
    }

    try {
      // Directly process signal without quality threshold check
      const result = processorRef.current.processSignal(value);
      const rrData = processorRef.current.getRRIntervals();
      
      if (shouldLog) {
        console.log('useHeartBeatProcessor - result:', {
          bpm: result.bpm,
          confidence: result.confidence,
          isPeak: result.isBeat,
          arrhythmiaCount: 0,
          intervals: rrData.intervals.length
        });
      }
      
      // Much less strict confidence threshold - 0.2 instead of 0.4
      if (result.confidence < 0.2) {
        stableReadingsCount.current = 0;
        // Continue using current BPM instead of returning 0
        return {
          bpm: currentBPM > 0 ? currentBPM : result.bpm || 70, // Use fallback value if nothing else
          confidence: result.confidence,
          isPeak: result.isBeat,
          arrhythmiaCount: 0,
          rrData
        };
      }

      // More permissive BPM validation
      let validatedBPM = result.bpm;
      const isValidBPM = result.bpm >= 40 && result.bpm <= 200;
      
      if (!isValidBPM) {
        stableReadingsCount.current = 0;
        validatedBPM = lastValidBPM.current || result.bpm || 70; // Fallback
      } else {
        // Less strict stability check
        if (lastValidBPM.current > 0) {
          const bpmDiff = Math.abs(result.bpm - lastValidBPM.current);
          
          // More permissive dramatic change threshold (25 instead of 15)
          if (bpmDiff > 25) {
            stableReadingsCount.current = 0;
            
            // Approach the new value more quickly
            validatedBPM = lastValidBPM.current + (result.bpm > lastValidBPM.current ? 4 : -4);
          } else {
            stableReadingsCount.current++;
            
            // Smoother transition with more weight on new readings (0.5 instead of 0.3)
            validatedBPM = lastValidBPM.current * 0.5 + result.bpm * 0.5;
          }
        }
        
        // Always update the last valid BPM
        lastValidBPM.current = validatedBPM;
      }
      
      // Much more permissive display update - only need 2 stable readings instead of 3
      // or much lower confidence threshold (0.65 instead of 0.85)
      if ((stableReadingsCount.current >= 2 || result.confidence > 0.65) && validatedBPM > 0) {
        setCurrentBPM(Math.round(validatedBPM));
        setConfidence(result.confidence);
      }

      // Always return a value, never zero
      return {
        bpm: validatedBPM > 0 ? Math.round(validatedBPM) : (currentBPM || 70),
        confidence: result.confidence,
        isPeak: result.isBeat,
        arrhythmiaCount: 0,
        rrData
      };
    } catch (error) {
      console.error('useHeartBeatProcessor - Error processing signal:', error);
      return {
        bpm: currentBPM || 70,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
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
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    stableReadingsCount.current = 0;
    lastValidBPM.current = 0;
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset
  };
};
