
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  const [processor] = useState(() => new PPGSignalProcessor());
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const readyToProcessRef = useRef<boolean>(false);
  const processingStartTimeRef = useRef<number>(0);

  // Inicialización del procesador
  const initializeProcessor = useCallback(async () => {
    if (isInitialized) return true;
    
    try {
      console.log("useSignalProcessor: Inicializando procesador");
      await processor.initialize();
      console.log("useSignalProcessor: Procesador inicializado correctamente");
      setIsInitialized(true);
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de inicialización:", error);
      return false;
    }
  }, [processor, isInitialized]);

  useEffect(() => {
    processor.onSignalReady = (signal: ProcessedSignal) => {
      console.log("useSignalProcessor: Señal recibida:", {
        quality: signal.quality,
        fingerDetected: signal.fingerDetected
      });
      setLastSignal(signal);
      setError(null);
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error:", error);
      setError(error);
    };

    return () => {
      processor.stop();
    };
  }, [processor]);

  const startProcessing = useCallback(async () => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    if (!isInitialized) {
      const success = await initializeProcessor();
      if (!success) return;
    }
    
    setIsProcessing(true);
    processingStartTimeRef.current = Date.now();
    
    // Dar tiempo para que todo se inicialice
    setTimeout(() => {
      readyToProcessRef.current = true;
      processor.start();
      console.log("useSignalProcessor: Procesamiento iniciado");
    }, 500);
  }, [processor, isInitialized, initializeProcessor]);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    readyToProcessRef.current = false;
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (!readyToProcessRef.current || !isProcessing) {
      console.log("useSignalProcessor: Frame ignorado (no está listo para procesar)");
      return;
    }

    const now = Date.now();
    if (now - processingStartTimeRef.current >= 500) {
      processor.processFrame(imageData);
    }
  }, [isProcessing, processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    isInitialized,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
