
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Esta versión limpia mantiene la misma funcionalidad pero con código más limpio.
 */
export const useSignalProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedSignal, setLastProcessedSignal] = useState<ProcessedSignal | null>(null);
  const [signalProcessor] = useState(() => new PPGSignalProcessor());
  const [error, setError] = useState<ProcessingError | null>(null);
  
  // Mantener solo los últimos 3 valores para análisis rápido - aumentando a 4 para mayor estabilidad
  const lastValues = useRef<ProcessedSignal[]>([]);
  const MAX_VALUES = 4;

  useEffect(() => {
    signalProcessor.onSignalReady = (signal: ProcessedSignal) => {
      setLastProcessedSignal(signal);
      
      // Almacenar valor
      lastValues.current.push(signal);
      if (lastValues.current.length > MAX_VALUES) {
        lastValues.current.shift();
      }
    };

    signalProcessor.onError = (error: ProcessingError) => {
      setError(error);
      console.error("Error en procesamiento de señal:", error);
    };

    return () => {
      signalProcessor.onSignalReady = null;
      signalProcessor.onError = null;
    };
  }, [signalProcessor]);

  const start = useCallback(() => {
    setIsProcessing(true);
    signalProcessor.start();
  }, [signalProcessor]);

  const stop = useCallback(() => {
    setIsProcessing(false);
    signalProcessor.stop();
    lastValues.current = [];
  }, [signalProcessor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;
    signalProcessor.processFrame(imageData);
  }, [isProcessing, signalProcessor]);

  const getSignalQuality = useCallback((): number => {
    if (lastValues.current.length < 2) return 0; // Reducido de MAX_VALUES para permitir respuesta más rápida
    return Math.min(...lastValues.current.map(s => s.quality));
  }, []);

  const isSignalValid = useCallback((): boolean => {
    if (lastValues.current.length < 2) return false; // Reducido de MAX_VALUES para permitir respuesta más rápida
    
    // La señal es válida si:
    // 1. Al menos 2 de los últimos valores tienen calidad > 0
    // 2. Al menos un valor tiene calidad > 30 (reducido de 40 para mayor sensibilidad)
    const qualities = lastValues.current.map(s => s.quality);
    
    // Contar cuántos valores tienen calidad > 0
    const validQualityCount = qualities.filter(q => q > 0).length;
    
    return validQualityCount >= 2 && qualities.some(q => q > 30);
  }, []);

  return {
    isProcessing,
    lastProcessedSignal,
    error,
    start,
    stop,
    processFrame,
    getSignalQuality,
    isSignalValid
  };
};
