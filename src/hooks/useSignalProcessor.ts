
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { toast } from "sonner";

/**
 * Hook para gestionar el procesamiento de señales PPG.
 */
export const useSignalProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedSignal, setLastProcessedSignal] = useState<ProcessedSignal | null>(null);
  const [signalProcessor] = useState(() => new PPGSignalProcessor());
  const [error, setError] = useState<ProcessingError | null>(null);
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  
  // Mantener valores para análisis
  const lastValues = useRef<ProcessedSignal[]>([]);
  const noFingerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_VALUES = 5;
  const NO_FINGER_TIMEOUT_MS = 10000; // 10 segundos sin dedo muestra un toast

  useEffect(() => {
    signalProcessor.onSignalReady = (signal: ProcessedSignal) => {
      console.log("Señal procesada:", { 
        timestamp: signal.timestamp,
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue,
        quality: signal.quality, 
        fingerDetected: signal.fingerDetected 
      });

      setLastProcessedSignal(signal);
      setIsFingerDetected(signal.fingerDetected);
      
      // Gestionar timeout de no detección de dedo
      if (signal.fingerDetected) {
        if (noFingerTimeoutRef.current) {
          clearTimeout(noFingerTimeoutRef.current);
          noFingerTimeoutRef.current = null;
        }

        // Almacenar valor solo si hay dedo detectado
        lastValues.current.push(signal);
        if (lastValues.current.length > MAX_VALUES) {
          lastValues.current.shift();
        }
      } else {
        // Si no hay dedo, configurar timeout para notificar al usuario
        if (!noFingerTimeoutRef.current && isProcessing) {
          noFingerTimeoutRef.current = setTimeout(() => {
            toast.warning("No se detecta el dedo en la cámara", {
              description: "Coloque su dedo índice sobre la cámara cubriendo completamente la lente y la luz.",
              duration: 5000,
            });
          }, NO_FINGER_TIMEOUT_MS);
        }
      }
    };

    signalProcessor.onError = (error: ProcessingError) => {
      setError(error);
      console.error("Error en procesamiento de señal:", error);
      toast.error("Error en el procesamiento de la señal", {
        description: error.message,
      });
    };

    return () => {
      signalProcessor.onSignalReady = null;
      signalProcessor.onError = null;
      if (noFingerTimeoutRef.current) {
        clearTimeout(noFingerTimeoutRef.current);
      }
    };
  }, [signalProcessor, isProcessing]);

  const start = useCallback(() => {
    console.log("Iniciando procesamiento de señal");
    setIsProcessing(true);
    signalProcessor.start();
    // Reiniciar variables de estado
    lastValues.current = [];
    setIsFingerDetected(false);
    if (noFingerTimeoutRef.current) {
      clearTimeout(noFingerTimeoutRef.current);
      noFingerTimeoutRef.current = null;
    }
  }, [signalProcessor]);

  const stop = useCallback(() => {
    console.log("Deteniendo procesamiento de señal");
    setIsProcessing(false);
    signalProcessor.stop();
    lastValues.current = [];
    setIsFingerDetected(false);
    if (noFingerTimeoutRef.current) {
      clearTimeout(noFingerTimeoutRef.current);
      noFingerTimeoutRef.current = null;
    }
  }, [signalProcessor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;
    signalProcessor.processFrame(imageData);
  }, [isProcessing, signalProcessor]);

  const getSignalQuality = useCallback((): number => {
    // Solo retornar calidad positiva si hay dedo detectado
    if (!isFingerDetected || lastValues.current.length < 2) return 0;
    
    // Usar solo los últimos valores con dedo detectado
    const qualityValues = lastValues.current
      .filter(s => s.fingerDetected)
      .map(s => s.quality);
    
    if (qualityValues.length === 0) return 0;
    
    // Retornar el promedio de las últimas calidades
    return Math.round(qualityValues.reduce((sum, q) => sum + q, 0) / qualityValues.length);
  }, [isFingerDetected]);

  const isSignalValid = useCallback((): boolean => {
    // Solo considerar la señal válida si hay dedo detectado
    if (!isFingerDetected || lastValues.current.length < 3) return false;
    
    // Filtrar solo valores con dedo detectado
    const validValues = lastValues.current.filter(s => s.fingerDetected);
    
    if (validValues.length < 3) return false;
    
    // La señal es válida si:
    // 1. Todos los últimos valores tienen calidad > 0
    // 2. Al menos un valor tiene calidad > 40
    const qualities = validValues.map(s => s.quality);
    return qualities.every(q => q > 0) && qualities.some(q => q > 40);
  }, [isFingerDetected]);

  return {
    isProcessing,
    lastProcessedSignal,
    error,
    isFingerDetected,
    start,
    stop,
    processFrame,
    getSignalQuality,
    isSignalValid
  };
};
