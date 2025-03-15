
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
  const consecutiveValidSignalsRef = useRef<number>(0);
  const signalQualityHistoryRef = useRef<number[]>([]);
  const throttleCountRef = useRef<number>(0);
  
  // Configurar opciones avanzadas
  useEffect(() => {
    processor.setPhaseDetectionEnabled(true);
    processor.setAdaptiveThresholdEnabled(true);
    
    return () => {
      processor.reset();
    };
  }, [processor]);
  
  /**
   * Procesa una nueva muestra de señal PPG con mejoras de rendimiento y estabilidad
   */
  const processSignal = useCallback((signal: number) => {
    const now = Date.now();
    
    // Control de frecuencia de procesamiento para optimizar rendimiento
    throttleCountRef.current++;
    const shouldProcess = throttleCountRef.current % 2 === 0; // Procesar cada 2 muestras
    
    // Limitar a máximo 60 FPS para evitar sobrecarga
    if (!shouldProcess || now - lastProcessedTimeRef.current < 16) {
      // Actualizar buffer para visualización incluso si no procesamos
      signalBufferRef.current.push(signal);
      if (signalBufferRef.current.length > 100) {
        signalBufferRef.current.shift();
      }
      return null;
    }
    
    lastProcessedTimeRef.current = now;
    
    // Validación básica de la señal
    if (isNaN(signal) || !isFinite(signal)) {
      console.warn("useAdvancedHeartBeatProcessor: Señal inválida recibida", signal);
      consecutiveValidSignalsRef.current = 0;
      return null;
    }
    
    // Incrementar contador de señales válidas consecutivas
    consecutiveValidSignalsRef.current++;
    
    // Actualizar buffer para visualización
    signalBufferRef.current.push(signal);
    if (signalBufferRef.current.length > 100) {
      signalBufferRef.current.shift();
    }
    
    // Procesar señal
    const result = processor.processSignal(signal);
    
    // Mantener historial de calidad de señal
    signalQualityHistoryRef.current.push(result.confidence * 100);
    if (signalQualityHistoryRef.current.length > 20) {
      signalQualityHistoryRef.current.shift();
    }
    
    // Calcular calidad media ponderando más los valores recientes
    let weightedConfidenceSum = 0;
    let weightSum = 0;
    for (let i = 0; i < signalQualityHistoryRef.current.length; i++) {
      const weight = i + 1; // Más peso a valores más recientes
      weightedConfidenceSum += signalQualityHistoryRef.current[i] * weight;
      weightSum += weight;
    }
    const averageConfidence = weightedConfidenceSum / weightSum;
    
    // Solo actualizar estado si tenemos suficientes señales válidas consecutivas
    // y la calidad es suficiente
    if (consecutiveValidSignalsRef.current > 5 && averageConfidence > 50) {
      // Actualizar estado
      setHeartRate(result.bpm);
      setConfidence(result.confidence);
      setPeakIndices(result.peakIndices);
      setHrvData(result.hrvData);
      setProcessorState(processor.getProcessorState());
    }
    
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
    consecutiveValidSignalsRef.current = 0;
    signalQualityHistoryRef.current = [];
    throttleCountRef.current = 0;
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
