
import { useState, useRef, useCallback } from 'react';

interface UseMeasurementTimerProps {
  onMeasurementComplete: () => void;
  maxTime?: number;
}

export const useMeasurementTimer = ({
  onMeasurementComplete,
  maxTime = 30
}: UseMeasurementTimerProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setElapsedTime(0);
    
    timerRef.current = window.setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        console.log(`DEBUG: Measurement time: ${newTime}s`);
        
        if (newTime >= maxTime) {
          console.log(`DEBUG: Reached maximum measurement time (${maxTime}s)`);
          onMeasurementComplete();
          return maxTime;
        }
        return newTime;
      });
    }, 1000);
    
    console.log("DEBUG: Measurement timer started");
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [maxTime, onMeasurementComplete]);
  
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log("DEBUG: Measurement timer stopped");
    }
    setElapsedTime(0);
  }, []);
  
  return {
    elapsedTime,
    startTimer,
    stopTimer
  };
};
