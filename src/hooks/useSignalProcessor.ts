
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
  const lastFrameTimeRef = useRef<number>(0);
  const frameRateRef = useRef<number>(30);
  const processingErrorsRef = useRef<number>(0);
  const FRAME_BUFFER_SIZE = 5;
  const MAX_CONSECUTIVE_ERRORS = 10;
  const targetFrameInterval = 1000 / 30; // Target 30fps

  // Process a frame to extract PPG values
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;

    try {
      const now = Date.now();
      
      // Maintain consistent framerate - only process frames at target interval
      if (now - lastFrameTimeRef.current < targetFrameInterval) {
        return;
      }
      
      lastFrameTimeRef.current = now;

      // Add frame to buffer
      frameBuffer.current.push(imageData);
      if (frameBuffer.current.length > FRAME_BUFFER_SIZE) {
        frameBuffer.current.shift();
      }

      // Extract red channel average from center region (larger region for better signal)
      const centerX = Math.floor(imageData.width / 2);
      const centerY = Math.floor(imageData.height / 2);
      const regionSize = 30; // Increased from 20
      
      let redSum = 0;
      let greenSum = 0; // Added green channel which often has better PPG signal
      let pixelCount = 0;
      
      for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
        for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
          if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
            const i = (y * imageData.width + x) * 4;
            redSum += imageData.data[i]; // Red channel
            greenSum += imageData.data[i + 1]; // Green channel
            pixelCount++;
          }
        }
      }
      
      // Use green channel as it typically provides better PPG signal
      const ppgValue = greenSum / pixelCount;
      
      // Process the value through signal processor
      procesarValor(ppgValue);
      
      // Reset error counter on success
      processingErrorsRef.current = 0;
      
    } catch (err) {
      console.error("Error processing frame:", err);
      processingErrorsRef.current++;
      
      if (processingErrorsRef.current > MAX_CONSECUTIVE_ERRORS) {
        setError({
          code: 'PROCESSING_ERROR',
          message: `Consecutive processing errors (${processingErrorsRef.current})`,
          timestamp: Date.now()
        });
      }
    }
  }, [isProcessing]);

  // Process a raw PPG value through filters
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
      console.error("Error procesando valor PPG:", err);
      setError({
        code: 'PROCESSING_ERROR',
        message: 'Error procesando valor PPG',
        timestamp: Date.now()
      });
    }
  }, [processor]);

  // Start/stop processing control
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    setIsProcessing(true);
    frameBuffer.current = [];
    lastFrameTimeRef.current = 0;
    processingErrorsRef.current = 0;
  }, []);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    setIsProcessing(false);
    frameBuffer.current = [];
  }, []);

  // Reset function to clear all state
  const reset = useCallback(() => {
    console.log("useSignalProcessor: Reset");
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
    lastFrameTimeRef.current = 0;
    processingErrorsRef.current = 0;
  }, [processor]);

  // Log periodic stats for debugging
  useEffect(() => {
    if (isProcessing) {
      const statsInterval = setInterval(() => {
        console.log("useSignalProcessor stats:", {
          framesProcessed,
          signalQuality: lastSignal?.quality || 0,
          fingerDetected: lastSignal?.fingerDetected || false,
          errors: processingErrorsRef.current
        });
      }, 3000);
      
      return () => clearInterval(statsInterval);
    }
  }, [isProcessing, framesProcessed, lastSignal]);

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
