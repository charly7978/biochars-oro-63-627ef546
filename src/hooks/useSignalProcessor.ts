/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
// Import types directly from the correct source
import { ProcessedSignal, ProcessingError } from '../types/signal.d';

/**
 * Hook para el procesamiento de señales PPG reales usando un Web Worker.
 * No se permite ninguna simulación o datos sintéticos.
 */
export const useSignalProcessor = () => {
  const workerRef = useRef<Worker | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | string | null>(null); // Can be string for worker errors
  const [framesProcessed, setFramesProcessed] = useState(0); // Note: Frame count might be less accurate now
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  // Initialize and terminate worker
  useEffect(() => {
    // Create the worker
    // Note: Adjust the path if your build setup requires a different URL format for workers
    workerRef.current = new Worker(new URL('../workers/ppg.worker.ts', import.meta.url), {
        type: 'module' // Important if your worker uses ES Modules
    });

    console.log("useSignalProcessor: Web Worker creado.");

    // Listener for messages from worker
    workerRef.current.onmessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.error) {
        // Handle errors reported by the worker
        console.error("useSignalProcessor: Error desde el worker:", data.error);
        setError({ code: 'WORKER_ERROR', message: data.error, timestamp: Date.now() });
      } else if (data.status === 'ready') {
          console.log("useSignalProcessor: Worker listo.");
      } else {
        // Assume it's ProcessedSignal data
        const signal: ProcessedSignal = data;
        setLastSignal(signal);
        setError(null); // Clear previous errors on successful signal
        setFramesProcessed(prev => prev + 1); // Increment frame count (approximation)

        // Update signal statistics based on received signal
        if (signal.fingerDetected) {
          setSignalStats(prev => ({
            minValue: Math.min(prev.minValue === Infinity ? signal.filteredValue : prev.minValue, signal.filteredValue),
            maxValue: Math.max(prev.maxValue === -Infinity ? signal.filteredValue : prev.maxValue, signal.filteredValue),
            avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
            totalValues: prev.totalValues + 1
          }));
        }
      }
    };

    // Listener for worker errors (e.g., script loading failed)
    workerRef.current.onerror = (event: ErrorEvent) => {
      console.error("useSignalProcessor: Error crítico del worker:", event.message, event);
      setError(`Error crítico del worker: ${event.message}`);
      setIsProcessing(false); // Stop processing if worker fails critically
    };

    // Cleanup: terminate worker when hook unmounts
    return () => {
      if (workerRef.current) {
        console.log("useSignalProcessor: Terminando Web Worker.");
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []); // Run only on mount and unmount

  // Start processing
  const startProcessing = useCallback(() => {
    if (isProcessing || !workerRef.current) return;
    console.log("useSignalProcessor: Enviando comando 'start' al worker.");
    setIsProcessing(true);
    setFramesProcessed(0);
    setLastSignal(null); // Reset last signal on start
    setError(null);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    workerRef.current.postMessage({ command: 'start' });
  }, [isProcessing]); // Dependency on isProcessing to avoid sending multiple starts

  // Stop processing
  const stopProcessing = useCallback(() => {
    if (!isProcessing || !workerRef.current) return;
    console.log("useSignalProcessor: Enviando comando 'stop' al worker.");
    setIsProcessing(false);
    workerRef.current.postMessage({ command: 'stop' });
    // Optionally reset last signal state here if desired
    // setLastSignal(null);
  }, [isProcessing]); // Dependency on isProcessing

  // Process frame
  const processFrame = useCallback((imageData: ImageData) => {
    // Check if processing and worker exists
    if (isProcessing && workerRef.current) {
      try {
        // Send ImageData to the worker. ImageData should be transferable.
        workerRef.current.postMessage({ command: 'processFrame', payload: imageData });
         // If transfer is needed and supported:
         // workerRef.current.postMessage({ command: 'processFrame', payload: imageData }, [imageData.data.buffer]);
      } catch (err) {
        console.error("useSignalProcessor: Error enviando frame al worker:", err);
        setError("Error enviando frame al worker.");
      }
    }
  }, [isProcessing]); // Dependency on isProcessing state

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
