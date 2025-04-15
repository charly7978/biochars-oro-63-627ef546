
import { useState } from 'react';

interface SignalHistoryState {
  stressLevel: number;
  signalQuality: number;
  fingerDetected: boolean;
  weakSignal: boolean;
  arrhythmiaDetected: boolean;
  consecutiveWeakSignals: number;
  lastPeakTime: number;
  lastSignalValue: number;
  lastDerivativeValue: number;
  lastBaselineValue: number;
  lastConfidenceValue: number;
  lastPeakConfirmationBuffer: any[];
  lastConfirmedPeak: boolean;
  lastHeartBeatResult: any;
  lastVitalSignsResult: any;
  lastArrhythmiaWindow: any;
  lastArrhythmiaCount: number;
  lastArrhythmiaStatus: string;
  lastHrvData: Record<string, any>;
  lastPpgData: any[];
}

export const useSignalHistory = (initialState?: Partial<SignalHistoryState>) => {
  const [signalHistory, setSignalHistory] = useState<SignalHistoryState>({
    stressLevel: 0,
    signalQuality: 0,
    fingerDetected: false,
    weakSignal: false,
    arrhythmiaDetected: false,
    consecutiveWeakSignals: 0,
    lastPeakTime: 0,
    lastSignalValue: 0,
    lastDerivativeValue: 0,
    lastBaselineValue: 0,
    lastConfidenceValue: 0,
    lastPeakConfirmationBuffer: [],
    lastConfirmedPeak: false,
    lastHeartBeatResult: null,
    lastVitalSignsResult: null,
    lastArrhythmiaWindow: null,
    lastArrhythmiaCount: 0,
    lastArrhythmiaStatus: '--',
    lastHrvData: {},
    lastPpgData: [],
    ...initialState
  });

  const updateSignalHistory = (updates: Partial<SignalHistoryState>) => {
    setSignalHistory(prev => ({
      ...prev,
      ...updates
    }));
  };

  const resetSignalHistory = () => {
    setSignalHistory({
      stressLevel: 0,
      signalQuality: 0,
      fingerDetected: false,
      weakSignal: false,
      arrhythmiaDetected: false,
      consecutiveWeakSignals: 0,
      lastPeakTime: 0,
      lastSignalValue: 0,
      lastDerivativeValue: 0,
      lastBaselineValue: 0,
      lastConfidenceValue: 0,
      lastPeakConfirmationBuffer: [],
      lastConfirmedPeak: false,
      lastHeartBeatResult: null,
      lastVitalSignsResult: null,
      lastArrhythmiaWindow: null,
      lastArrhythmiaCount: 0,
      lastArrhythmiaStatus: '--',
      lastHrvData: {},
      lastPpgData: []
    });
  };

  return {
    signalHistory,
    updateSignalHistory,
    resetSignalHistory
  };
};
