
import { useRef, useCallback } from 'react';
import { updateSignalLog } from '../../utils/signalLogUtils';
import { SignalLogEntry } from './types';

export function useSignalLogger() {
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<SignalLogEntry[]>([]);
  
  const logSignal = useCallback((value: number, result: any) => {
    processedSignals.current++;
    
    // Log processed signals less frequently
    if (processedSignals.current % 100 === 0) {
      console.log("VitalSignsProcessor: Processing status", {
        processed: processedSignals.current,
        pressure: result.pressure,
        spo2: result.spo2,
        glucose: result.glucose,
        arrhythmiaStatus: result.arrhythmiaStatus
      });
    }
    
    // Update signal log
    const currentTime = Date.now();
    signalLog.current = updateSignalLog(
      signalLog.current, 
      currentTime, 
      value, 
      result, 
      processedSignals.current
    );
  }, []);
  
  const reset = useCallback(() => {
    processedSignals.current = 0;
    signalLog.current = [];
  }, []);
  
  return {
    logSignal,
    reset,
    getProcessedSignals: () => processedSignals.current,
    getSignalLog: () => signalLog.current
  };
}
