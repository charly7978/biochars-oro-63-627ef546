/**
 * Refactor para usar useFingerDetection centralizado
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { useSignalCore, SignalCoreResult } from './useSignalCore';
import { useFingerDetection } from './useFingerDetection';

interface SignalProcessorState {
  processor: SignalCoreResult;
  lastResult: any;
}

export const useSignalProcessor = () => {
  const signalCore = useSignalCore();
  const [lastResult, setLastResult] = useState<any>(null);

  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", { timestamp: new Date().toISOString() });
    return new PPGSignalProcessor();
  });

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

  const { detectionResult, processNewSignal } = useFingerDetection();

  useEffect(() => {
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Actualiza detección de dedo centralizada
      processNewSignal(signal.rawValue);
      setLastSignal(signal);
      setError(null);
      setFramesProcessed(prev => prev + 1);

      setSignalStats(prev => ({
        minValue: Math.min(prev.minValue, signal.filteredValue),
        maxValue: Math.max(prev.maxValue, signal.filteredValue),
        avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
        totalValues: prev.totalValues + 1
      }));
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    return () => {
      processor.stop();
    };
  }, [processor, processNewSignal]);

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
    processor.start();
  }, [processor]);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
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
    processFrame,
    fingerDetection: detectionResult
  };
};
