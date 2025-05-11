/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback } from 'react';
import { fingerDetectionManager, type FingerDetectionResult, type FingerDetectionConfig } from '../services/FingerDetectionService';
import { type ProcessingError } from '../types/signal';

/**
 * Hook para el procesamiento de señales PPG desde ImageData, utilizando el FingerDetectionService centralizado.
 * No se permite ninguna simulación o datos sintéticos.
 */
export const useSignalProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<FingerDetectionResult | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  
  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento via fingerDetectionManager");
    setIsProcessing(true);
    setFramesProcessed(0);
    setLastSignal(null);
    setError(null);
    fingerDetectionManager.reset();
  }, []);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    setIsProcessing(false);
  }, []);

  /**
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        const result = fingerDetectionManager.processFrameAndSignal(imageData);
        setLastSignal(result);
        setFramesProcessed(prev => prev + 1);
        setError(null);
      } catch (err: any) {
        console.error("useSignalProcessor: Error procesando frame con fingerDetectionManager:", err);
        setError({
          code: 'PROCESS_FRAME_ERROR',
          message: err.message || 'Error in fingerDetectionManager',
          timestamp: Date.now(),
        });
        setLastSignal(null);
      }
    }
  }, [isProcessing]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    startProcessing,
    stopProcessing,
    processFrame,
  };
};
