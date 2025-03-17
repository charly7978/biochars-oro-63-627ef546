import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrhythmiaProcessor } from '../modules/arrhythmia-processor';

export const useHeartBeatProcessor = () => {
  const [initialized, setInitialized] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [bpm, setBpm] = useState(0);
  const [rrData, setRrData] = useState<{ intervals: number[], lastPeakTime: number | null }>({ 
    intervals: [], 
    lastPeakTime: null 
  });
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const sessionId = useRef(Math.random().toString(36).substring(2, 9));
  const arrhythmiaProcessorRef = useRef<ArrhythmiaProcessor | null>(null);
  const processorRef = useRef<any>(null);
  const monitoringStateRef = useRef(false);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    try {
      const HeartBeatProcessor = (window as any).HeartBeatProcessor;
      if (!HeartBeatProcessor) {
        console.error('HeartBeatProcessor not found in window object');
        return;
      }

      const processor = new HeartBeatProcessor();
      processorRef.current = processor;
      arrhythmiaProcessorRef.current = new ArrhythmiaProcessor();
      
      // Expose the processor to the global scope
      (window as any).heartBeatProcessor = processor;
      
      // Add API methods to the processor for accessing the arrhythmia detector
      processor.getArrhythmiaProcessor = () => arrhythmiaProcessorRef.current;
      processor.getArrhythmiaCounter = () => arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0;
      processor.getRRData = () => ({ intervals: processor.getRRIntervals(), lastPeakTime: processor.getLastPeakTime() });
      
      setInitialized(true);

      return () => {
        console.log('useHeartBeatProcessor: Cleanup', {
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
        processor.stop();
        (window as any).heartBeatProcessor = null;
      };
    } catch (err) {
      console.error('Error initializing HeartBeatProcessor:', err);
    }
  }, []);

  useEffect(() => {
    if (!processorRef.current) return;

    try {
      if (isMonitoring) {
        processorRef.current.setMonitoring(true);
        monitoringStateRef.current = true;
        console.log('HeartBeatProcessor: Started monitoring');
      } else {
        processorRef.current.setMonitoring(false);
        monitoringStateRef.current = false;
        console.log('HeartBeatProcessor: Stopped monitoring');
        setBpm(0); // Reset BPM when stopping
        setRrData({ intervals: [], lastPeakTime: null });
      }
    } catch (err) {
      console.error('Error toggling monitoring state:', err);
    }
  }, [isMonitoring]);

  const updateBpmPeriodically = useCallback(() => {
    if (!processorRef.current || !monitoringStateRef.current) return;

    try {
      // Update BPM
      const currentBpm = processorRef.current.calculateCurrentBPM();
      setBpm(Math.round(currentBpm));

      // Update RR intervals data
      const intervals = processorRef.current.getRRIntervals();
      const lastPeakTime = processorRef.current.getLastPeakTime();
      setRrData({ intervals, lastPeakTime });

      // Process arrhythmia data
      if (arrhythmiaProcessorRef.current && intervals.length > 0) {
        const result = arrhythmiaProcessorRef.current.processRRData({ intervals, lastPeakTime });
        setIsArrhythmia(result.isArrhythmia);
      }
    } catch (err) {
      console.error('Error updating BPM or RR data:', err);
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(updateBpmPeriodically, 100);
    return () => clearInterval(intervalId);
  }, [updateBpmPeriodically]);

  const processSignal = useCallback((value: number) => {
    if (!processorRef.current) return { bpm: 0, rrData: { intervals: [], lastPeakTime: null } };
    
    try {
      // Process the signal directly
      const result = processorRef.current.processSignal(value);
      
      // Update state based on the result
      const currentBpm = processorRef.current.calculateCurrentBPM();
      setBpm(Math.round(currentBpm));
      
      // Get updated RR intervals
      const intervals = processorRef.current.getRRIntervals();
      const lastPeakTime = processorRef.current.getLastPeakTime();
      const updatedRRData = { intervals, lastPeakTime };
      setRrData(updatedRRData);
      
      // Process for arrhythmia
      if (arrhythmiaProcessorRef.current && intervals.length > 0) {
        const arrhythmiaResult = arrhythmiaProcessorRef.current.processRRData({ intervals, lastPeakTime });
        setIsArrhythmia(arrhythmiaResult.isArrhythmia);
      }
      
      return { 
        bpm: Math.round(currentBpm), 
        rrData: updatedRRData,
        confidence: processorRef.current.getConfidence ? processorRef.current.getConfidence() : 1.0
      };
    } catch (err) {
      console.error('Error processing signal:', err);
      return { bpm: 0, rrData: { intervals: [], lastPeakTime: null }, confidence: 0 };
    }
  }, []);

  const startMonitoring = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.setMonitoring(true);
      monitoringStateRef.current = true;
      setIsMonitoring(true);
    }
  }, []);
  
  const stopMonitoring = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.setMonitoring(false);
      monitoringStateRef.current = false;
      setIsMonitoring(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (!processorRef.current) return;
    
    try {
      processorRef.current.reset();
      if (arrhythmiaProcessorRef.current) {
        arrhythmiaProcessorRef.current.reset();
      }
      setBpm(0);
      setRrData({ intervals: [], lastPeakTime: null });
      setIsArrhythmia(false);
      console.log('HeartBeatProcessor: Reset completed');
    } catch (err) {
      console.error('Error resetting HeartBeatProcessor:', err);
    }
  }, []);

  return {
    initialized,
    isMonitoring,
    bpm,
    rrData,
    isArrhythmia,
    arrhythmiaProcessor: arrhythmiaProcessorRef.current,
    setIsMonitoring,
    startMonitoring,
    stopMonitoring,
    processSignal,
    reset,
    playBeep: (volume: number) => {
      try {
        if (processorRef.current) {
          processorRef.current.playBeep(volume);
        }
      } catch (err) {
        console.error('Error playing beep:', err);
      }
    }
  };
};
