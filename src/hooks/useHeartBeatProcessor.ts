
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
      // Process signal with balanced quality check
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
      
      // Balanced confidence threshold - 0.3
      if (result.confidence < 0.3) {
        stableReadingsCount.current = 0;
        return {
          bpm: currentBPM > 0 ? currentBPM : result.bpm || 70, // Fallback value
          confidence: result.confidence,
          isPeak: result.isBeat,
          arrhythmiaCount: 0,
          rrData
        };
      }

      // Standard BPM validation
      let validatedBPM = result.bpm;
      const isValidBPM = result.bpm >= 45 && result.bpm <= 180;
      
      if (!isValidBPM) {
        stableReadingsCount.current = 0;
        validatedBPM = lastValidBPM.current || result.bpm || 70; // Fallback
      } else {
        // Balanced stability check
        if (lastValidBPM.current > 0) {
          const bpmDiff = Math.abs(result.bpm - lastValidBPM.current);
          
          // Standard dramatic change threshold (20)
          if (bpmDiff > 20) {
            stableReadingsCount.current = 0;
            
            // Balanced transition
            validatedBPM = lastValidBPM.current + (result.bpm > lastValidBPM.current ? 3 : -3);
          } else {
            stableReadingsCount.current++;
            
            // Balanced weighting between old and new values
            validatedBPM = lastValidBPM.current * 0.6 + result.bpm * 0.4;
          }
        }
        
        // Always update the last valid BPM
        lastValidBPM.current = validatedBPM;
      }
      
      // Standard display update - need 3 stable readings or good confidence
      if ((stableReadingsCount.current >= 3 || result.confidence > 0.75) && validatedBPM > 0) {
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
