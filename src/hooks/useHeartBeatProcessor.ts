
import { useCallback, useRef, useState } from 'react';

/**
 * Simple hook for heart beat processing without arrhythmia detection
 */
export const useHeartBeatProcessor = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const processorRef = useRef<any>(null);
  
  /**
   * Initialize the processor if needed
   */
  const ensureInitialized = useCallback(() => {
    if (isInitialized) return;
    
    try {
      const processor = (window as any).heartBeatProcessor;
      if (processor) {
        processorRef.current = processor;
        setIsInitialized(true);
      }
    } catch (err) {
      console.error("Error initializing heart beat processor:", err);
    }
  }, [isInitialized]);
  
  /**
   * Process a signal and calculate heart rate
   */
  const processSignal = useCallback((value: number) => {
    ensureInitialized();
    
    if (!processorRef.current) {
      return { bpm: 0, confidence: 0, rrData: { intervals: [], lastPeakTime: null } };
    }
    
    try {
      // Process the signal value
      processorRef.current.processSignalValue(value);
      
      // Get the calculated BPM
      const bpm = processorRef.current.calculateCurrentBPM ? 
        processorRef.current.calculateCurrentBPM() : 0;
      
      // Get confidence
      const confidence = processorRef.current.getConfidence ? 
        processorRef.current.getConfidence() : 0;
      
      // Basic RR data - simplified
      const rrData = {
        intervals: processorRef.current.getRRIntervals ? 
          processorRef.current.getRRIntervals() : [],
        lastPeakTime: processorRef.current.getLastPeakTime ? 
          processorRef.current.getLastPeakTime() : null
      };
      
      return { bpm, confidence, rrData };
    } catch (err) {
      console.error("Error processing signal:", err);
      return { bpm: 0, confidence: 0, rrData: { intervals: [], lastPeakTime: null } };
    }
  }, [ensureInitialized]);
  
  /**
   * Play a beep sound
   */
  const playBeep = useCallback((volume: number = 0.2) => {
    ensureInitialized();
    
    if (!processorRef.current || !processorRef.current.playBeep) {
      return false;
    }
    
    try {
      processorRef.current.playBeep(volume);
      return true;
    } catch (err) {
      console.error("Error playing beep:", err);
      return false;
    }
  }, [ensureInitialized]);
  
  /**
   * Start monitoring heart beat
   */
  const startMonitoring = useCallback(() => {
    ensureInitialized();
    
    if (!processorRef.current) return;
    
    try {
      if (processorRef.current.startMonitoring) {
        processorRef.current.startMonitoring();
      }
    } catch (err) {
      console.error("Error starting heart beat monitoring:", err);
    }
  }, [ensureInitialized]);
  
  /**
   * Stop monitoring heart beat
   */
  const stopMonitoring = useCallback(() => {
    if (!processorRef.current) return;
    
    try {
      if (processorRef.current.stopMonitoring) {
        processorRef.current.stopMonitoring();
      }
    } catch (err) {
      console.error("Error stopping heart beat monitoring:", err);
    }
  }, []);
  
  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return;
    
    try {
      if (processorRef.current.reset) {
        processorRef.current.reset();
      }
    } catch (err) {
      console.error("Error resetting heart beat processor:", err);
    }
  }, []);

  return {
    isInitialized,
    playBeep,
    processSignal,
    startMonitoring,
    stopMonitoring,
    reset,
    processor: processorRef.current
  };
};
