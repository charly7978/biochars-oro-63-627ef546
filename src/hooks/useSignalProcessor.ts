
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useRef } from 'react';
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

  const frameBuffer = useRef<ImageData[]>([]);
  const FRAME_BUFFER_SIZE = 5;

  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;

    // Add frame to buffer
    frameBuffer.current.push(imageData);
    if (frameBuffer.current.length > FRAME_BUFFER_SIZE) {
      frameBuffer.current.shift();
    }

    // Process frame to extract PPG value
    try {
      // Extract red channel average from center region
      const centerX = Math.floor(imageData.width / 2);
      const centerY = Math.floor(imageData.height / 2);
      const regionSize = 20;
      
      let redSum = 0;
      let pixelCount = 0;
      
      for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
        for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
          if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
            const i = (y * imageData.width + x) * 4;
            redSum += imageData.data[i]; // Red channel
            pixelCount++;
          }
        }
      }
      
      const ppgValue = redSum / pixelCount;
      procesarValor(ppgValue);
      
    } catch (err) {
      console.error("Error processing frame:", err);
      setError({
        code: 'PROCESSING_ERROR',
        message: 'Error processing frame',
        timestamp: Date.now()
      });
    }
  }, [isProcessing]);

  // Nueva función para procesar un valor PPG real
  const procesarValor = useCallback((valorPPG: number) => {
    try {
      const resultado = processor.applyFilters(valorPPG);
      setLastSignal(resultado as ProcessedSignal);
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

  // Control de inicio/parada
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    frameBuffer.current = [];
  }, []);

  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    frameBuffer.current = [];
  }, []);

  // Reset function to clear all state
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
    frameBuffer.current = [];
  }, [processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    procesarValor,
    processFrame,
    reset
  };
};
