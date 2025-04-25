
import { useState, useCallback, useRef } from 'react';
import { PPGSignalProcessor, PPGProcessedSignal } from '@/core/signal-processing/PPGSignalProcessor';
import HeartRateService from '@/services/HeartRateService';

export const useHeartBeatSignal = () => {
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedSignal, setLastProcessedSignal] = useState<PPGProcessedSignal | null>(null);

  // Inicializar el procesador
  const initialize = useCallback(() => {
    if (!processorRef.current) {
      processorRef.current = new PPGSignalProcessor();
      console.log("useHeartBeatSignal: Processor initialized");
    }
  }, []);

  // Procesar una nueva señal
  const processSignal = useCallback((value: number) => {
    if (!processorRef.current || !isProcessing) {
      return null;
    }

    try {
      // Procesar señal
      const processedSignal = processorRef.current.processSignal(value);
      setLastProcessedSignal(processedSignal);
      
      // Si es un pico, enviar al servicio de ritmo cardíaco
      if (processedSignal.isPeak && processedSignal.peakConfidence > 0.5) {
        HeartRateService.processSignal(processedSignal.filteredValue);
      }

      return processedSignal;
    } catch (error) {
      console.error("Error processing signal:", error);
      return null;
    }
  }, [isProcessing]);

  // Iniciar procesamiento
  const startProcessing = useCallback(() => {
    initialize();
    setIsProcessing(true);
  }, [initialize]);

  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);

  // Reset completo
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    setLastProcessedSignal(null);
    setIsProcessing(false);
  }, []);

  return {
    processSignal,
    startProcessing,
    stopProcessing,
    reset,
    isProcessing,
    lastProcessedSignal
  };
};
