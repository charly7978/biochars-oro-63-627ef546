
/**
 * Hook for monitoring blood pressure using the BloodPressureProcessor
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { BloodPressureProcessor } from '../modules/vital-signs';
import { formatBloodPressure } from '../modules/vital-signs/blood-pressure/BloodPressureUtils';

interface BloodPressureMonitorOptions {
  useAI?: boolean;
  confidenceThreshold?: number;
  useEnhancement?: boolean;
}

export function useBloodPressureMonitor(options?: BloodPressureMonitorOptions) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastPressure, setLastPressure] = useState<string>("--/--");
  const [confidence, setConfidence] = useState<number>(0);
  const [currentOptions, setCurrentOptions] = useState<BloodPressureMonitorOptions>(
    options || { 
      useAI: false, 
      confidenceThreshold: 0.5, 
      useEnhancement: true 
    }
  );
  
  // Use ref to avoid unnecessary re-renders
  const processorRef = useRef<BloodPressureProcessor | null>(null);
  
  // Initialize processor
  useEffect(() => {
    processorRef.current = new BloodPressureProcessor({
      useAI: currentOptions.useAI,
      confidenceThreshold: currentOptions.confidenceThreshold,
      useEnhancement: currentOptions.useEnhancement
    });
    
    return () => {
      // Clean up
      if (processorRef.current) {
        processorRef.current.reset();
      }
    };
  }, [currentOptions]);
  
  // Process PPG value
  const processPPG = useCallback(async (ppgValue: number): Promise<string> => {
    if (!processorRef.current || !isMonitoring) {
      return "--/--";
    }
    
    try {
      const result = await processorRef.current.process(ppgValue);
      setConfidence(result.confidence);
      
      const formattedPressure = formatBloodPressure(result.systolic, result.diastolic);
      setLastPressure(formattedPressure);
      return formattedPressure;
    } catch (error) {
      console.error("Error processing blood pressure:", error);
      return "--/--";
    }
  }, [isMonitoring]);
  
  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);
  
  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);
  
  // Update options
  const updateOptions = useCallback((newOptions: Partial<BloodPressureMonitorOptions>) => {
    setCurrentOptions(prev => ({
      ...prev,
      ...newOptions
    }));
    
    if (processorRef.current) {
      processorRef.current.updateOptions({
        confidenceThreshold: newOptions.confidenceThreshold,
        useEnhancement: newOptions.useEnhancement
      });
      
      if (newOptions.useAI !== undefined) {
        processorRef.current.setAIEnabled(newOptions.useAI);
      }
    }
  }, []);
  
  // Reset processor
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setLastPressure("--/--");
    setConfidence(0);
  }, []);
  
  return {
    isMonitoring,
    lastPressure,
    confidence,
    processPPG,
    startMonitoring,
    stopMonitoring,
    updateOptions,
    reset
  };
}
