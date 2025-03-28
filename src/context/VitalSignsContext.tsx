
import React, { createContext, useContext, useState, useCallback } from 'react';
import { VitalSignsResult } from '@/modules/types/signal';
import { measurementManager } from '@/modules/results/MeasurementManager';

export interface VitalSignsContextProps {
  vitalSigns: VitalSignsResult;
  isMonitoring: boolean;
  isCameraOn: boolean;
  signalQuality: number;
  heartRate: number;
  elapsedTime: number;
  showResults: boolean;
  lastSignal: {
    fingerDetected: boolean;
    filteredValue: number;
    quality: number;
  } | null;
  isArrhythmia: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetAll: () => void;
  handleStreamReady: (stream: MediaStream) => void;
}

const VitalSignsContext = createContext<VitalSignsContextProps | undefined>(undefined);

export const VitalSignsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState({
    vitalSigns: measurementManager.getVitalSigns(),
    isMonitoring: false,
    isCameraOn: false,
    signalQuality: 0,
    heartRate: 0,
    elapsedTime: 0,
    showResults: false,
    lastSignal: null,
    isArrhythmia: false
  });

  const startMonitoring = useCallback(() => {
    measurementManager.startMonitoring();
    const newState = measurementManager.getState();
    setState(prev => ({
      ...prev,
      ...newState,
      vitalSigns: measurementManager.getVitalSigns()
    }));
  }, []);

  const stopMonitoring = useCallback(() => {
    measurementManager.stopMonitoring();
    const newState = measurementManager.getState();
    setState(prev => ({
      ...prev,
      ...newState,
      vitalSigns: measurementManager.getVitalSigns()
    }));
  }, []);

  const resetAll = useCallback(() => {
    measurementManager.reset();
    const newState = measurementManager.getState();
    setState(prev => ({
      ...prev,
      ...newState,
      vitalSigns: measurementManager.getVitalSigns()
    }));
  }, []);

  const handleStreamReady = useCallback((stream: MediaStream) => {
    measurementManager.handleStreamReady(stream);
  }, []);

  return (
    <VitalSignsContext.Provider value={{
      ...state,
      startMonitoring,
      stopMonitoring,
      resetAll,
      handleStreamReady,
      isArrhythmia: state.vitalSigns.arrhythmiaStatus !== '--' && state.vitalSigns.arrhythmiaStatus !== 'SIN ARRITMIAS'
    }}>
      {children}
    </VitalSignsContext.Provider>
  );
};

export const useVitalSigns = () => {
  const context = useContext(VitalSignsContext);
  if (!context) {
    throw new Error('useVitalSigns must be used within a VitalSignsProvider');
  }
  return context;
};
