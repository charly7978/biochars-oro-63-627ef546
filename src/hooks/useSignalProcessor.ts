/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { SignalOptimizationManager } from '../core/signal/SignalOptimizationManager';

/**
 * Hook para el procesamiento de señales PPG reales
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentBPM, setCurrentBPM] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  
  const processor = useRef<HeartBeatProcessor>(new HeartBeatProcessor());
  const optimizer = useRef<SignalOptimizationManager>(new SignalOptimizationManager());
  
  const processSignal = useCallback((value: number) => {
    try {
      if (!isProcessing) return { bpm: 0, confidence: 0, isPeak: false, arrhythmiaCount: 0 };
      
      // Procesar y optimizar la señal
      const optimizationResult = optimizer.current.processSignal({
        timestamp: Date.now(),
        value: value,
        filteredValue: value,
        quality: 100,
        fingerDetected: true
      });

      // Procesar con el procesador de latidos
      const result = processor.current.processSignal(
        optimizationResult.optimizedChannels.get('heartRate')?.values.slice(-1)[0] || value
      );
      
      // Actualizar estado
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
      setArrhythmiaCount(result.arrhythmiaCount);
      
      return result;
    } catch (error) {
      console.error('Error procesando señal:', error);
      return { bpm: 0, confidence: 0, isPeak: false, arrhythmiaCount };
    }
  }, [isProcessing, arrhythmiaCount]);
  
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    processor.current.reset();
    optimizer.current.reset();
  }, []);
  
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    processor.current.reset();
    optimizer.current.reset();
  }, []);
  
  const reset = useCallback(() => {
    processor.current.reset();
    optimizer.current.reset();
    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    setArrhythmiaCount(0);
  }, []);
  
  return {
    processSignal,
    startProcessing,
    stopProcessing,
    reset,
    currentBPM,
    confidence,
    isArrhythmia,
    arrhythmiaCount
  };
};
