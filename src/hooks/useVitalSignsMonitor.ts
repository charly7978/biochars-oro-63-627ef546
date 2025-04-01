
/**
 * Integrated hook for monitoring all vital signs
 */
import { useState, useEffect, useCallback } from 'react';
import { useBloodPressureMonitor } from './useBloodPressureMonitor';
import { VitalSignsResult } from '../types/vital-signs';

export function useVitalSignsMonitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
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
  
  // Use specialized hooks for each vital sign
  const bloodPressure = useBloodPressureMonitor({ useAI: true });
  
  // Start monitoring all vital signs
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    bloodPressure.startMonitoring();
  }, [bloodPressure]);
  
  // Stop monitoring all vital signs
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    bloodPressure.stopMonitoring();
  }, [bloodPressure]);
  
  // Process a PPG signal to update all vital signs
  const processPPG = useCallback(async (ppgValue: number) => {
    if (!isMonitoring) return null;
    
    try {
      // Process blood pressure
      const pressure = await bloodPressure.processPPG(ppgValue);
      
      // Update vital signs
      const updatedSigns: VitalSignsResult = {
        ...vitalSigns,
        pressure
      };
      
      setVitalSigns(updatedSigns);
      return updatedSigns;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      return null;
    }
  }, [isMonitoring, bloodPressure, vitalSigns]);
  
  // Reset all processors
  const reset = useCallback(() => {
    bloodPressure.reset();
    setVitalSigns({
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    });
  }, [bloodPressure]);
  
  return {
    isMonitoring,
    vitalSigns,
    startMonitoring,
    stopMonitoring,
    processPPG,
    reset,
    bloodPressureConfidence: bloodPressure.confidence
  };
}
