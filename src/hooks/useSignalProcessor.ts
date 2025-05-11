
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import useFingerDetection from '../services/FingerDetectionService';

/**
 * Hook para el procesamiento de señales PPG reales
 * No se permite ninguna simulación o datos sintéticos
 * Ahora utiliza el servicio centralizado de detección de dedo
 */
export const useSignalProcessor = () => {
  // Acceso al servicio centralizado de detección de dedo
  const fingerDetection = useFingerDetection();
  const cleanupCalledRef = useRef(false);
  const processingActiveRef = useRef(false);

  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Basic state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Debug signal quality and processing
      console.log("Signal processed:", { 
        filteredValue: signal.filteredValue.toFixed(3),
        rawValue: signal.rawValue.toFixed(2),
        quality: signal.quality,
        processingActive: processingActiveRef.current
      });
      
      // Solo procesar si estamos activos
      if (!processingActiveRef.current) return;
      
      // Usar el detector centralizado para una detección más precisa
      const fingerStatus = fingerDetection.processSignal(signal.filteredValue, signal.quality);
      
      // Actualizar la señal con el estado de detección centralizado
      const enhancedSignal = {
        ...signal,
        fingerDetected: fingerStatus
      };
      
      setLastSignal(enhancedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update signal statistics
      setSignalStats(prev => {
        return {
          minValue: Math.min(prev.minValue, signal.filteredValue),
          maxValue: Math.max(prev.maxValue, signal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
      });
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup
    return () => {
      // Avoid multiple calls to cleanup functions that cause infinite loops
      if (cleanupCalledRef.current) return;
      cleanupCalledRef.current = true;
      processingActiveRef.current = false;
      
      processor.stop();
      
      // Use setTimeout to prevent state update during unmount cleanup cycles
      setTimeout(() => {
        if (fingerDetection && fingerDetection.resetDetection) {
          fingerDetection.resetDetection();
        }
      }, 20);
    };
  }, [processor, fingerDetection]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    processingActiveRef.current = true;
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    // Reset finger detection status before starting
    if (fingerDetection && fingerDetection.resetDetection) {
      fingerDetection.resetDetection();
    }
    cleanupCalledRef.current = false;
    
    processor.start();
  }, [processor, fingerDetection]);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processingActiveRef.current = false;
    processor.stop();
    
    // Use setTimeout to prevent react update cycle issues
    setTimeout(() => {
      if (fingerDetection && fingerDetection.resetDetection) {
        fingerDetection.resetDetection();
      }
    }, 20);
  }, [processor, fingerDetection]);

  /**
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing && processingActiveRef.current) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame
  };
};

export default useSignalProcessor;
