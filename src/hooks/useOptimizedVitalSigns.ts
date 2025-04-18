
/**
 * Hook for optimized vital signs processing using specialized channels
 * ONLY uses real data, no simulations or placeholder values
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
  const { lastSignal, metrics, getChannel, startProcessing: startSignalProcessing } = useSignalProcessing();
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
    // More permissive processing - allow processing even with lower quality
    // This is critical to get initial readings
    if (metrics.quality < 10) {
      console.log("Signal quality too low for vital sign processing:", metrics.quality);
      return;
    }
    
    console.log("Processing vital signs with finger detected:", metrics.fingerDetected, "quality:", metrics.quality);
    
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
    
    console.log("Channel data:", {
      heartbeat: heartbeatChannel?.metadata,
      spo2: spo2Channel?.metadata,
      bp: bpChannel?.metadata
    });
    
    // Only use real measured values, zero if not available
    const heartRate = heartbeatChannel?.getMetadata('heartRate') || 0;
    const spo2 = spo2Channel?.getMetadata('spo2') || 0;
    
    // Blood pressure - use zeros if not calculated
    const systolic = bpChannel?.getMetadata('systolic') || 0;
    const diastolic = bpChannel?.getMetadata('diastolic') || 0;
    const pressure = (systolic > 0 && diastolic > 0) ? 
      `${Math.round(systolic)}/${Math.round(diastolic)}` : "--/--";
    
    // Arrhythmia - use real values only
    const arrhythmiaStatus = arrhythmiaChannel?.getMetadata('status') || "--";
    const arrhythmiaCount = arrhythmiaChannel?.getMetadata('count') || 0;
    const lastArrhythmiaData = arrhythmiaChannel?.getMetadata('lastEvent') || null;
    
    // Glucose - use real values only
    const glucose = glucoseChannel?.getMetadata('glucose') || 0;
    const glucoseConfidence = glucoseChannel?.getMetadata('confidence') || 0;
    
    // Lipids - use real values only
    const totalCholesterol = lipidsChannel?.getMetadata('totalCholesterol') || 0;
    const triglycerides = lipidsChannel?.getMetadata('triglycerides') || 0;
    const lipidsConfidence = lipidsChannel?.getMetadata('confidence') || 0;
    
    // Hemoglobin - use real values only
    const hemoglobin = hemoglobinChannel?.getMetadata('value') || 0;
    
    // Hydration - use real values only
    const hydration = hydrationChannel?.getMetadata('value') || 0;
    
    // Calculate overall confidence from real values
    const overallConfidence = Math.max(0, (glucoseConfidence + lipidsConfidence) / 2);
    
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
      isReliable: metrics.quality > 30 && heartRate > 30, // More permissive reliability check
      lastUpdateTime: now,
      elapsed
    });
    
  }, [metrics.fingerDetected, metrics.quality, getChannel]);
  
  // Process vital signs when signal updates
  useEffect(() => {
    // Process even with lower quality threshold - more permissive
    if (lastSignal) {
      processVitalSigns();
    }
  }, [lastSignal, processVitalSigns]);
  
  // Start monitoring vital signs
  const startMonitoring = useCallback(() => {
    console.log("useOptimizedVitalSigns: Starting vital signs monitoring");
    startTimeRef.current = Date.now();
    
    // Ensure signal processing is started
    startSignalProcessing();
    
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
  }, [processVitalSigns, startSignalProcessing]);
  
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
    heartRate: getChannel('heartbeat')?.getMetadata('heartRate') || 0,
    startMonitoring,
    stopMonitoring,
    isMonitoring: processingIntervalRef.current !== null,
    fingerDetected: metrics.fingerDetected,
    signalQuality: metrics.quality,
    processingMetrics: metrics
  };
}
