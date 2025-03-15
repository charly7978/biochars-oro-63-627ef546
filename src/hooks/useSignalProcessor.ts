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
  
  // Mantener solo los últimos 3 valores para análisis rápido
  const lastValues = useRef<ProcessedSignal[]>([]);
  const MAX_VALUES = 3;

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
    if (lastValues.current.length < MAX_VALUES) return 0;
    return Math.min(...lastValues.current.map(s => s.quality));
  }, []);

  const isSignalValid = useCallback((): boolean => {
    if (lastValues.current.length < MAX_VALUES) return false;
    
    // La señal es válida si:
    // 1. Todos los últimos valores tienen calidad > 0
    // 2. Al menos un valor tiene calidad > 40
    const qualities = lastValues.current.map(s => s.quality);
    return qualities.every(q => q > 0) && qualities.some(q => q > 40);
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
