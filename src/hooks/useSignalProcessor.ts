
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedSignalProcessor } from '../modules/signal-processing/unified/UnifiedSignalProcessor';
import { ProcessedPPGSignal } from '../modules/signal-processing/unified/types';
import { ProcessingError } from '../types/signal';

/**
 * Hook para el procesamiento de señales PPG reales con el procesador unificado
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new UnifiedSignalProcessor();
  });
  
  // Basic state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedPPGSignal | null>(null);
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
    const onSignalReady = (signal: ProcessedPPGSignal) => {
      // Pass through without modifications - quality and detection handled by PPGSignalMeter
      setLastSignal(signal);
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
    const onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Cleanup
    return () => {
      processor.reset();
    };
  }, [processor]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
  }, []);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.reset();
  }, [processor]);

  /**
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        // Extract red channel average from image data
        const data = imageData.data;
        let redSum = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          redSum += data[i];
        }
        
        const redAvg = redSum / pixelCount / 255; // Normalize to 0-1
        
        // Process the signal
        const signal = processor.processSignal(redAvg);
        
        // Update state
        setLastSignal(signal);
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
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
        if (err instanceof Error) {
          setError(err as ProcessingError);
        }
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
