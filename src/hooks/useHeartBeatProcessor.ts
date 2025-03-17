
import { useState, useEffect, useRef } from 'react';

// This is a simplified version just to fix build errors
export const useHeartBeatProcessor = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const processorRef = useRef<any>(null);

  useEffect(() => {
    // Check if the processor is available in the window
    if (window && (window as any).heartBeatProcessor) {
      processorRef.current = (window as any).heartBeatProcessor;
      setIsInitialized(true);
    }
  }, []);

  const playBeep = (volume = 1.0) => {
    if (processorRef.current) {
      try {
        processorRef.current.playBeep(volume);
        return true;
      } catch (err) {
        console.error("Error playing beep:", err);
        return false;
      }
    }
    return false;
  };

  return {
    isInitialized,
    playBeep,
    processor: processorRef.current
  };
};
