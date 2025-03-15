
import { useState, useEffect } from 'react';
import { useSignalProcessor } from './useSignalProcessor';
import { useHeartBeatProcessor } from './useHeartBeatProcessor';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';
import { VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { ProcessedSignal } from '../types/signal';

export function useSignalProcessing(isMonitoring: boolean) {
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>({
    spo2: 0,
    pressure: "--/--",
    arrhythmiaStatus: "--",
    glucose: 0,
    lipids: {
      totalCholesterol: 0,
      triglycerides: 0
    }
  });
  const [heartRate, setHeartRate] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState<string | number>("--");
  const [lastArrhythmiaData, setLastArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);

  const { lastSignal } = useSignalProcessor();
  const { processSignal: processHeartBeat } = useHeartBeatProcessor();
  const { 
    processSignal: processVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  // Effect to update displays based on signal processing
  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected && isMonitoring) {
      const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
      setHeartRate(heartBeatResult.bpm);
      
      const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
      if (vitals) {
        setVitalSigns(vitals);
        
        if (vitals.lastArrhythmiaData) {
          setLastArrhythmiaData(vitals.lastArrhythmiaData);
          const [status, count] = vitals.arrhythmiaStatus.split('|');
          setArrhythmiaCount(count || "0");
        }
      }
      
      setSignalQuality(lastSignal.quality);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns]);

  // Effect to handle last valid results when monitoring stops
  useEffect(() => {
    if (lastValidResults && !isMonitoring) {
      setVitalSigns(lastValidResults);
    }
  }, [lastValidResults, isMonitoring]);

  return {
    lastSignal,
    signalQuality,
    vitalSigns,
    heartRate,
    arrhythmiaCount,
    lastArrhythmiaData
  };
}
