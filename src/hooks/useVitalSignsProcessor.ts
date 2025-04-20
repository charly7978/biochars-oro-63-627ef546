import { useRef, useState, useCallback } from 'react';
import { VitalSignsProcessor } from '@/modules/vital-signs/VitalSignsProcessor';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { UseVitalSignsProcessorReturn } from './vital-signs/types';

// Hook centralizado para el procesamiento de signos vitales
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState<number>(0);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState({
    processedSignals: 0,
    signalLog: [] as { timestamp: number, value: number, result: any }[],
  });

  // Inicializar el procesador si no existe
  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
  }

  // Procesar señal y actualizar resultados
  const processSignal = useCallback((contextSignal: any, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    if (!processorRef.current) return {
      spo2: 0,
      pressure: '--/--',
      arrhythmiaStatus: '--',
      glucose: 0,
      lipids: { totalCholesterol: 0, triglycerides: 0 },
      hemoglobin: 0,
      hydration: 0
    };
    // El valor principal optimizado puede ser contextSignal.filteredValue
    const result = processorRef.current.processSignal(
      contextSignal.filteredValue,
      contextSignal,
      rrData
    );
    setLastValidResults(result);
    setDebugInfo(prev => ({
      processedSignals: prev.processedSignals + 1,
      signalLog: [
        ...prev.signalLog,
        { timestamp: Date.now(), value: contextSignal.filteredValue, result }
      ].slice(-100)
    }));
    // Actualizar arrhythmia windows si hay datos
    if (result.lastArrhythmiaData && Array.isArray(result.lastArrhythmiaData.windows)) {
      setArrhythmiaWindows(result.lastArrhythmiaData.windows);
    }
    // Contador de arritmias si está disponible
    if (result.arrhythmiaStatus && result.arrhythmiaStatus.includes('ARRITMIA')) {
      setArrhythmiaCounter(c => c + 1);
    }
    return result;
  }, []);

  // Reset parcial (devuelve último resultado válido)
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    const last = lastValidResults;
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    setArrhythmiaWindows([]);
    setDebugInfo({ processedSignals: 0, signalLog: [] });
    return last;
  }, [lastValidResults]);

  // Reset total
  const fullReset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current = new VitalSignsProcessor();
    }
    setLastValidResults(null);
    setArrhythmiaCounter(0);
    setArrhythmiaWindows([]);
    setDebugInfo({ processedSignals: 0, signalLog: [] });
  }, []);

  // Calibración de presión arterial
  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number) => {
    if (processorRef.current) {
      processorRef.current.applyBloodPressureCalibration(systolic, diastolic);
    }
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    applyBloodPressureCalibration,
    arrhythmiaCounter,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo
  };
}; 