
import { useCallback, useRef, useEffect } from 'react';

export function useHeartbeatAudio() {
  const beepRequesterRef = useRef<((time: number) => void) | null>(null);
  const lastBeepRequestTimeRef = useRef<number>(0);

  const requestBeepForPeak = useCallback((timestamp: number) => {
    const now = Date.now();
    if (now - lastBeepRequestTimeRef.current < 250) return;
    
    if (beepRequesterRef.current) {
      beepRequesterRef.current(timestamp);
      lastBeepRequestTimeRef.current = now;
    }
  }, []);

  useEffect(() => {
    const heartBeatProcessor = (window as any).heartBeatProcessor;
    
    if (heartBeatProcessor) {
      beepRequesterRef.current = (timestamp: number) => {
        try {
          heartBeatProcessor.playBeep(1.0);
          console.log("PPGSignalMeter: Beep requested for peak at timestamp", timestamp);
        } catch (err) {
          console.error("Error requesting beep:", err);
        }
      };
    }
    
    return () => {
      beepRequesterRef.current = null;
    };
  }, []);

  return {
    requestBeepForPeak
  };
}
