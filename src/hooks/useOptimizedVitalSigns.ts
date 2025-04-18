
/**
 * Hook for optimized vital signs processing using specialized channels
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSignalProcessing } from './useSignalProcessing';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { ResultFactory } from '../modules/vital-signs/factories/result-factory';

interface OptimizedVitalSignsResult extends VitalSignsResult {
  isReliable: boolean;
  lastUpdateTime: number;
  elapsed: number;
}

export function useOptimizedVitalSigns() {
  const { lastSignal, metrics, getChannel } = useSignalProcessing();
  const [vitalSigns, setVitalSigns] = useState<OptimizedVitalSignsResult>({
    ...ResultFactory.createEmptyResults(),
    isReliable: false,
    lastUpdateTime: 0,
    elapsed: 0
  });
  
  const processingIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const PROCESS_INTERVAL_MS = 200; // Process vital signs every 200ms
  
  // Function to process all vital signs using separate channels
  const processVitalSigns = useCallback(() => {
    if (!metrics.fingerDetected || metrics.quality < 30) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTimeRef.current;
    
    // Don't process too frequently
    if (timeSinceLastProcess < PROCESS_INTERVAL_MS) {
      return;
    }
    
    lastProcessTimeRef.current = now;
    
    // Get data from each specialized channel
    const heartbeatChannel = getChannel('heartbeat');
    const spo2Channel = getChannel('spo2');
    const bpChannel = getChannel('bloodPressure');
    const arrhythmiaChannel = getChannel('arrhythmia');
    const glucoseChannel = getChannel('glucose');
    const lipidsChannel = getChannel('lipids');
    const hemoglobinChannel = getChannel('hemoglobin');
    const hydrationChannel = getChannel('hydration');
    
    // Extract heart rate
    const heartRate = heartbeatChannel?.metadata?.heartRate || 0;
    
    // Extract SpO2
    const spo2 = spo2Channel?.metadata?.spo2 || 0;
    
    // Extract blood pressure
    const systolic = bpChannel?.metadata?.systolic || 0;
    const diastolic = bpChannel?.metadata?.diastolic || 0;
    const pressure = (systolic > 0 && diastolic > 0) ? 
      `${Math.round(systolic)}/${Math.round(diastolic)}` : "--/--";
    
    // Extract arrhythmia status
    const arrhythmiaStatus = arrhythmiaChannel?.metadata?.status || "--";
    const arrhythmiaCount = arrhythmiaChannel?.metadata?.count || 0;
    const lastArrhythmiaData = arrhythmiaChannel?.metadata?.lastEvent || null;
    
    // Extract glucose
    const glucose = glucoseChannel?.metadata?.glucose || 0;
    const glucoseConfidence = glucoseChannel?.metadata?.confidence || 0;
    
    // Extract lipids
    const totalCholesterol = lipidsChannel?.metadata?.totalCholesterol || 0;
    const triglycerides = lipidsChannel?.metadata?.triglycerides || 0;
    const lipidsConfidence = lipidsChannel?.metadata?.confidence || 0;
    
    // Extract hemoglobin
    const hemoglobin = hemoglobinChannel?.metadata?.value || 0;
    
    // Extract hydration
    const hydration = hydrationChannel?.metadata?.value || 0;
    
    // Calculate overall confidence
    const overallConfidence = (glucoseConfidence + lipidsConfidence) / 2;
    
    // Calculate elapsed time
    const elapsed = startTimeRef.current ? Math.floor((now - startTimeRef.current) / 1000) : 0;
    
    // Update vital signs state
    setVitalSigns({
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaCount > 0 ? `ARRITMIA|${arrhythmiaCount}` : arrhythmiaStatus,
      glucose,
      lipids: {
        totalCholesterol,
        triglycerides
      },
      hemoglobin,
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      lastArrhythmiaData,
      isReliable: metrics.quality > 50 && heartRate > 40,
      lastUpdateTime: now,
      elapsed
    });
    
  }, [metrics.fingerDetected, metrics.quality, getChannel]);
  
  // Process vital signs when signal updates
  useEffect(() => {
    if (lastSignal && metrics.fingerDetected) {
      processVitalSigns();
    }
  }, [lastSignal, metrics.fingerDetected, processVitalSigns]);
  
  // Start monitoring vital signs
  const startMonitoring = useCallback(() => {
    console.log("useOptimizedVitalSigns: Starting vital signs monitoring");
    startTimeRef.current = Date.now();
    
    // Process at regular intervals in addition to signal updates
    if (!processingIntervalRef.current) {
      processingIntervalRef.current = window.setInterval(processVitalSigns, PROCESS_INTERVAL_MS);
    }
    
    // Reset vital signs state
    setVitalSigns({
      ...ResultFactory.createEmptyResults(),
      isReliable: false,
      lastUpdateTime: Date.now(),
      elapsed: 0
    });
  }, [processVitalSigns]);
  
  // Stop monitoring vital signs
  const stopMonitoring = useCallback(() => {
    console.log("useOptimizedVitalSigns: Stopping vital signs monitoring");
    
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    startTimeRef.current = null;
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
    };
  }, []);
  
  return {
    vitalSigns,
    heartRate: getChannel('heartbeat')?.metadata?.heartRate || 0,
    startMonitoring,
    stopMonitoring,
    isMonitoring: processingIntervalRef.current !== null,
    fingerDetected: metrics.fingerDetected,
    signalQuality: metrics.quality,
    processingMetrics: metrics
  };
}
