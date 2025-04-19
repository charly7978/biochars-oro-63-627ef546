/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para el procesamiento de señales PPG reales
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new SignalProcessor();
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

  // Nueva función para procesar un valor PPG real
  const procesarValor = useCallback((valorPPG: number) => {
    try {
      const resultado = processor.applyFilters(valorPPG);
      setLastSignal(resultado as ProcessedSignal); // Cast si es necesario
      setError(null);
      setFramesProcessed(prev => prev + 1);
      setSignalStats(prev => {
        return {
          minValue: Math.min(prev.minValue, resultado.filteredValue),
          maxValue: Math.max(prev.maxValue, resultado.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + resultado.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
      });
    } catch (err) {
      setError({
        code: 'PROCESSING_ERROR',
        message: 'Error procesando valor PPG',
        timestamp: Date.now()
      });
    }
  }, [processor]);

  // Función para resetear el procesador y el estado
  const reset = useCallback(() => {
    processor.reset();
    setLastSignal(null);
    setError(null);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    setIsProcessing(false);
  }, [processor]);

  // Control de inicio/parada solo cambia el flag
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    procesarValor,
    reset
  };
};
