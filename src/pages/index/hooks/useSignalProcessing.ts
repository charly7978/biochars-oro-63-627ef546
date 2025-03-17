
import { useState, useEffect } from 'react';
import { useSignalProcessor } from '@/hooks/useSignalProcessor';
import { useHeartBeatProcessor } from '@/hooks/useHeartBeatProcessor';
import { useVitalSignsProcessor } from '@/hooks/useVitalSignsProcessor';
import { VitalSignsResult } from '@/modules/vital-signs/VitalSignsProcessor';
import { toast } from '@/components/ui/use-toast';

export const useSignalProcessing = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
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
  const [showResults, setShowResults] = useState(false);
  
  const { 
    startProcessing, 
    stopProcessing, 
    lastSignal, 
    processFrame 
  } = useSignalProcessor();
  
  const { 
    processSignal: processHeartBeat, 
    isArrhythmia,
    startMonitoring: startHeartBeatMonitoring,
    stopMonitoring: stopHeartBeatMonitoring,
    reset: resetHeartBeatProcessor
  } = useHeartBeatProcessor();
  
  const { 
    processSignal: processVitalSigns, 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    console.log("DEBUG: Attempting to enter fullscreen");
    try {
      await document.documentElement.requestFullscreen();
      console.log("DEBUG: Fullscreen entered successfully");
    } catch (err) {
      console.error("DEBUG: Error entering fullscreen:", err);
    }
  };

  const startMonitoring = async () => {
    console.log("DEBUG: startMonitoring called", { currentlyMonitoring: isMonitoring });
    
    if (isMonitoring) {
      console.log("DEBUG: Already monitoring, finalizing measurement");
      finalizeMeasurement();
      return;
    }
    
    console.log("DEBUG: Starting new monitoring session");
    
    try {
      await enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      setHeartRate(0);
      
      startProcessing();
      startHeartBeatMonitoring();
      
      console.log("DEBUG: Monitoring started successfully");
    } catch (error) {
      console.error("DEBUG: Error starting monitoring:", error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la monitorización",
        variant: "destructive"
      });
    }
  };

  const finalizeMeasurement = () => {
    console.log("DEBUG: Finalizing measurement");
    
    try {
      setIsMonitoring(false);
      setIsCameraOn(false);
      stopProcessing();
      stopHeartBeatMonitoring();
      
      resetVitalSigns();
      console.log("DEBUG: VitalSigns reset completed");
      
      if (lastValidResults) {
        console.log("DEBUG: Setting results from lastValidResults", {
          spo2: lastValidResults.spo2,
          pressure: lastValidResults.pressure,
          arrhythmiaStatus: lastValidResults.arrhythmiaStatus
        });
        setVitalSigns(lastValidResults);
        setShowResults(true);
      } else {
        console.log("DEBUG: No valid results available");
      }
      
      setSignalQuality(0);
      setHeartRate(0);
      
      console.log("DEBUG: Measurement finalized successfully");
    } catch (error) {
      console.error("DEBUG: Error finalizing measurement:", error);
    }
  };

  const handleReset = () => {
    console.log("DEBUG: Full reset initiated");
    
    try {
      setIsMonitoring(false);
      setIsCameraOn(false);
      setShowResults(false);
      stopProcessing();
      stopHeartBeatMonitoring();
      resetHeartBeatProcessor();
      
      fullResetVitalSigns();
      setHeartRate(0);
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
      setSignalQuality(0);
      
      console.log("DEBUG: Full reset completed");
    } catch (error) {
      console.error("DEBUG: Error during full reset:", error);
    }
  };

  useEffect(() => {
    console.log("DEBUG: useEffect for lastValidResults tracking", {
      lastValidResults: !!lastValidResults,
      isMonitoring,
      showResults
    });
    
    if (lastValidResults && !isMonitoring) {
      console.log("DEBUG: Setting vitalSigns from lastValidResults", {
        spo2: lastValidResults.spo2,
        pressure: lastValidResults.pressure,
        arrhythmiaStatus: lastValidResults.arrhythmiaStatus
      });
      setVitalSigns(lastValidResults);
      setShowResults(true);
    }
  }, [lastValidResults, isMonitoring]);

  useEffect(() => {
    console.log("DEBUG: useEffect for signal processing", {
      hasLastSignal: !!lastSignal,
      isMonitoring,
      signalQuality: lastSignal?.quality
    });
    
    if (lastSignal && isMonitoring) {
      const minQualityThreshold = 40;
      
      if (lastSignal.fingerDetected && lastSignal.quality >= minQualityThreshold) {
        console.log("DEBUG: Processing signal with good quality", {
          quality: lastSignal.quality,
          fingerDetected: lastSignal.fingerDetected,
          value: lastSignal.filteredValue.toFixed(2)
        });
        
        try {
          const heartBeatResult = processHeartBeat(lastSignal.filteredValue);
          
          if (heartBeatResult.confidence > 0.4) {
            console.log("DEBUG: Heart beat processed with good confidence", {
              bpm: heartBeatResult.bpm,
              confidence: heartBeatResult.confidence,
              rrIntervalsCount: heartBeatResult.rrData?.intervals.length
            });
            
            setHeartRate(heartBeatResult.bpm);
            
            const vitals = processVitalSigns(lastSignal.filteredValue, heartBeatResult.rrData);
            if (vitals) {
              console.log("DEBUG: Vitals processed successfully", {
                spo2: vitals.spo2,
                pressure: vitals.pressure,
                arrhythmiaStatus: vitals.arrhythmiaStatus
              });
              setVitalSigns(vitals);
            }
          } else {
            console.log("DEBUG: Heart beat processed with low confidence", {
              confidence: heartBeatResult.confidence
            });
          }
          
          setSignalQuality(lastSignal.quality);
        } catch (error) {
          console.error("DEBUG: Error during signal processing:", error);
        }
      } else {
        console.log("DEBUG: Low quality signal", {
          quality: lastSignal.quality,
          fingerDetected: lastSignal.fingerDetected,
          threshold: minQualityThreshold
        });
        
        setSignalQuality(lastSignal.quality);
        
        if (!lastSignal.fingerDetected && heartRate > 0) {
          console.log("DEBUG: Finger removed, resetting heart rate");
          setHeartRate(0);
        }
      }
    } else if (!isMonitoring) {
      setSignalQuality(0);
    }
  }, [lastSignal, isMonitoring, processHeartBeat, processVitalSigns, heartRate]);

  return {
    isMonitoring,
    isCameraOn,
    signalQuality, 
    vitalSigns,
    heartRate,
    lastSignal,
    showResults,
    isArrhythmia,
    processFrame,
    startMonitoring,
    finalizeMeasurement,
    handleReset,
    handleToggleMonitoring: () => {
      if (isMonitoring) {
        finalizeMeasurement();
      } else {
        startMonitoring();
      }
    }
  };
};
