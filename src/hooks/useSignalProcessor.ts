
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { useState, useEffect, useCallback } from 'react';
import { ppgSignalService } from '../services/PPGSignalService';
import type { ProcessedSignal } from '../types/signal';

/**
 * Hook refactorizado que utiliza el servicio centralizado para el procesamiento de señal PPG
 * Proporciona una interfaz limpia para iniciar/detener el procesamiento y acceder a los resultados
 */
export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Iniciar procesamiento
  const startProcessing = useCallback(() => {
    ppgSignalService.startProcessing();
    setIsProcessing(true);
    console.log("useSignalProcessor: Procesamiento iniciado");
  }, []);
  
  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    ppgSignalService.stopProcessing();
    setIsProcessing(false);
    setLastSignal(null);
    console.log("useSignalProcessor: Procesamiento detenido");
  }, []);
  
  // Procesar un frame
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;
    
    try {
      const signal = ppgSignalService.processFrame(imageData);
      
      if (signal) {
        setLastSignal(signal);
      }
    } catch (error) {
      console.error("useSignalProcessor: Error procesando frame", error);
    }
  }, [isProcessing]);
  
  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      ppgSignalService.stopProcessing();
    };
  }, []);
  
  return {
    lastSignal,
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
