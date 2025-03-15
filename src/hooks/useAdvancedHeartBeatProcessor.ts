
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

/**
 * Hook personalizado que encapsula la funcionalidad avanzada del procesador de ritmo cardíaco
 * Proporciona acceso a métricas de HRV y visualización de picos
 */
export const useAdvancedHeartBeatProcessor = () => {
  const [processor] = useState(() => new HeartBeatProcessor());
  const [heartRate, setHeartRate] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [peakIndices, setPeakIndices] = useState<number[]>([]);
  const [hrvData, setHrvData] = useState<{ sdnn: number; rmssd: number; pnn50: number }>({
    sdnn: 0,
    rmssd: 0,
    pnn50: 0
  });
  const [processorState, setProcessorState] = useState({
    adaptiveThreshold: 0,
    phaseDetectionEnabled: true,
    adaptiveThresholdEnabled: true,
    signalBufferLength: 0
  });
  
  const signalBufferRef = useRef<number[]>([]);
  const lastProcessedTimeRef = useRef<number>(0);
  
  // Configurar opciones avanzadas
  useEffect(() => {
    processor.setPhaseDetectionEnabled(true);
    processor.setAdaptiveThresholdEnabled(true);
    
    return () => {
      processor.reset();
    };
  }, [processor]);
  
  /**
   * Procesa una nueva muestra de señal PPG
   */
  const processSignal = useCallback((signal: number) => {
    const now = Date.now();
    
    // Limitar a máximo 60 FPS para evitar sobrecarga
    if (now - lastProcessedTimeRef.current < 16) {
      return null;
    }
    
    lastProcessedTimeRef.current = now;
    
    // Actualizar buffer para visualización
    signalBufferRef.current.push(signal);
    if (signalBufferRef.current.length > 100) {
      signalBufferRef.current.shift();
    }
    
    // Procesar señal
    const result = processor.processSignal(signal);
    
    // Actualizar estado
    setHeartRate(result.bpm);
    setConfidence(result.confidence);
    setPeakIndices(result.peakIndices);
    setHrvData(result.hrvData);
    setProcessorState(processor.getProcessorState());
    
    return result;
  }, [processor]);
  
  /**
   * Resetea el procesador y limpia los datos
   */
  const reset = useCallback(() => {
    processor.reset();
    setHeartRate(0);
    setConfidence(0);
    setPeakIndices([]);
    setHrvData({ sdnn: 0, rmssd: 0, pnn50: 0 });
    signalBufferRef.current = [];
    lastProcessedTimeRef.current = 0;
  }, [processor]);
  
  /**
   * Cambia la configuración del procesador
   */
  const updateSettings = useCallback((settings: {
    phaseDetectionEnabled?: boolean;
    adaptiveThresholdEnabled?: boolean;
  }) => {
    if (settings.phaseDetectionEnabled !== undefined) {
      processor.setPhaseDetectionEnabled(settings.phaseDetectionEnabled);
    }
    
    if (settings.adaptiveThresholdEnabled !== undefined) {
      processor.setAdaptiveThresholdEnabled(settings.adaptiveThresholdEnabled);
    }
    
    setProcessorState(processor.getProcessorState());
  }, [processor]);
  
  return {
    heartRate,
    confidence,
    peakIndices,
    hrvData,
    signalBuffer: signalBufferRef.current,
    processorState,
    processSignal,
    reset,
    updateSettings
  };
};
