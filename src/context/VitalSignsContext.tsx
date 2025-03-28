
/**
 * Vital Signs Context
 * Provides state and actions for vital signs monitoring
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { EventType, eventBus, useEventSubscription } from "@/modules/events/EventBus";
import { PPGSignal, VitalSignsResult } from "@/modules/types/signal";
import { measurementManager } from "@/modules/results/MeasurementManager";

interface VitalSignsContextType {
  // State
  isMonitoring: boolean;
  isCameraOn: boolean;
  signalQuality: number;
  vitalSigns: VitalSignsResult;
  heartRate: number;
  elapsedTime: number;
  showResults: boolean;
  lastSignal: {
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  } | null;
  isArrhythmia: boolean;
  
  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetAll: () => void;
  handleStreamReady: (stream: MediaStream) => void;
}

const initialVitalSigns: VitalSignsResult = {
  timestamp: Date.now(),
  heartRate: 0,
  spo2: 0,
  pressure: "--/--",
  arrhythmiaStatus: "--",
  reliability: 0
};

const VitalSignsContext = createContext<VitalSignsContextType | undefined>(undefined);

export const useVitalSigns = () => {
  const context = useContext(VitalSignsContext);
  if (!context) {
    throw new Error("useVitalSigns must be used within a VitalSignsProvider");
  }
  return context;
};

export const VitalSignsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State tracking
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [vitalSigns, setVitalSigns] = useState<VitalSignsResult>(initialVitalSigns);
  const [heartRate, setHeartRate] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastSignal, setLastSignal] = useState<{
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  } | null>(null);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  
  // Subscribe to heart beat events
  useEventSubscription(EventType.HEARTBEAT_DETECTED, () => {
    // Audio feedback handled by other modules
  });
  
  // Subscribe to monitoring state events
  useEventSubscription(EventType.MONITORING_STARTED, () => {
    setIsMonitoring(true);
    setIsCameraOn(true);
    setShowResults(false);
    setElapsedTime(0);
    
    // Enter fullscreen if available
    const enterFullScreen = async () => {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.log('Error entering fullscreen:', err);
      }
    };
    
    enterFullScreen();
  });
  
  useEventSubscription(EventType.MONITORING_STOPPED, (data: { duration: number }) => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    setElapsedTime(data.duration);
    setShowResults(true);
  });
  
  useEventSubscription(EventType.MONITORING_RESET, () => {
    setIsMonitoring(false);
    setIsCameraOn(false);
    setElapsedTime(0);
    setSignalQuality(0);
    setHeartRate(0);
    setShowResults(false);
    setVitalSigns(initialVitalSigns);
    setLastSignal(null);
    setIsArrhythmia(false);
  });
  
  // Subscribe to vital signs events
  useEventSubscription(EventType.VITAL_SIGNS_UPDATED, (data: VitalSignsResult) => {
    setVitalSigns(data);
  });
  
  useEventSubscription(EventType.VITAL_SIGNS_FINAL, (data: VitalSignsResult) => {
    setVitalSigns(data);
    setShowResults(true);
  });
  
  // Subscribe to heart rate events
  useEventSubscription(EventType.HEARTBEAT_RATE_CHANGED, (data: { heartRate: number }) => {
    setHeartRate(data.heartRate);
  });
  
  // Subscribe to signal events
  useEventSubscription(EventType.SIGNAL_EXTRACTED, (data: PPGSignal) => {
    setLastSignal({
      fingerDetected: data.fingerDetected,
      filteredValue: data.filteredValue,
      quality: data.quality
    });
    
    setSignalQuality(data.quality);
  });
  
  // Subscribe to arrhythmia events
  useEventSubscription(EventType.ARRHYTHMIA_DETECTED, () => {
    setIsArrhythmia(true);
    
    toast.warning('Posible arritmia detectada', {
      description: 'Se ha detectado un ritmo cardíaco irregular',
    });
  });
  
  // Subscribe to error events
  useEventSubscription(EventType.ERROR_OCCURRED, (error: { message: string }) => {
    toast.error('Error', {
      description: error.message,
    });
  });
  
  // Sync with measurement manager on mount
  useEffect(() => {
    const state = measurementManager.getState();
    setIsMonitoring(state.isMonitoring);
    setIsCameraOn(state.isCameraOn);
    setSignalQuality(state.signalQuality);
    setHeartRate(state.heartRate);
    setElapsedTime(state.elapsedTime);
    setShowResults(state.showResults);
    setLastSignal(state.lastSignal);
    
    const vs = measurementManager.getVitalSigns();
    if (vs) {
      setVitalSigns(vs);
    }
  }, []);
  
  // Action handlers
  const startMonitoring = () => {
    measurementManager.startMonitoring();
  };
  
  const stopMonitoring = () => {
    measurementManager.stopMonitoring();
  };
  
  const resetAll = () => {
    measurementManager.reset();
  };
  
  const handleStreamReady = (stream: MediaStream) => {
    measurementManager.handleStreamReady(stream);
  };
  
  const value = {
    isMonitoring,
    isCameraOn,
    signalQuality,
    vitalSigns,
    heartRate,
    elapsedTime,
    showResults,
    lastSignal,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    resetAll,
    handleStreamReady
  };
  
  return (
    <VitalSignsContext.Provider value={value}>
      {children}
    </VitalSignsContext.Provider>
  );
};
