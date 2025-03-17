import { useRef, useCallback } from 'react';
import { updateSignalLog } from '../../utils/signalLogUtils';
import { SignalLogEntry } from '../../utils/signal-log/signalLogger';

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
    updateSignalLog(
      value, 
      result.quality || 0, 
      result.isFingerDetected || false,
      result.heartRate,
      result.rmssd
    );
    
    // Add to local log
    signalLog.current.push({
      timestamp: Date.now(),
      value,
      quality: result.quality || 0,
      isFingerDetected: result.isFingerDetected || false,
      heartRate: result.heartRate,
      rmssd: result.rmssd
    });
    
    // Keep log size manageable
    if (signalLog.current.length > 1000) {
      signalLog.current.shift();
    }
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
