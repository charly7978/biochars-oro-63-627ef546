
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PPGProcessor } from '@/core/signal/PPGProcessor';
import { SignalProcessor } from '@/modules/vital-signs/signal-processor';
import { ProcessedSignal } from '@/types/signal';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import FingerDetectionService from '@/services/FingerDetectionService';

interface UseSignalProcessorProps {
  // Optional props for configuration
  usePattern?: boolean;
  calibration?: boolean;
}

export function useSignalProcessor(props: UseSignalProcessorProps = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  
  // Create processors
  const ppgProcessor = useRef<PPGProcessor | null>(null);
  const signalProcessor = useRef<SignalProcessor | null>(null);
  const processingSessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Track metrics
  const processedFramesCount = useRef<number>(0);
  const lastFpsMeasurement = useRef<number>(0);
  const fpsCounter = useRef<number>(0);
  const processingFps = useRef<number>(0);
  
  // Initialize processors
  useEffect(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: processingSessionId.current
    });
    
    const ppg = new PPGProcessor(
      handleProcessedSignal,
      handleProcessingError
    );
    
    ppgProcessor.current = ppg;
    signalProcessor.current = new SignalProcessor();
    
    // Initialize processor
    ppg.initialize().catch(err => {
      console.error("Error initializing PPG processor", err);
      setError("Fallo al inicializar el procesador PPG");
    });
    
    return () => {
      if (ppgProcessor.current) {
        ppgProcessor.current.stop();
      }
      
      console.log("useSignalProcessor: Limpieza del procesador", {
        sessionId: processingSessionId.current,
        framesProcessed: processedFramesCount.current,
        fps: processingFps.current
      });
    };
  }, []);
  
  // Update FPS measurement periodically
  useEffect(() => {
    const fpsInterval = setInterval(() => {
      if (isProcessing) {
        const now = Date.now();
        const elapsed = now - lastFpsMeasurement.current;
        
        if (elapsed > 0) {
          processingFps.current = Math.round((fpsCounter.current / elapsed) * 1000);
          fpsCounter.current = 0;
          lastFpsMeasurement.current = now;
        }
      }
    }, 1000);
    
    return () => clearInterval(fpsInterval);
  }, [isProcessing]);
  
  // Handler for successful signal processing
  const handleProcessedSignal = useCallback((signal: ProcessedSignal) => {
    if (!isProcessing || !signalProcessor.current) return;
    
    try {
      // Process the signal with the vital signs processor
      const { filteredValue, quality, fingerDetected } = signalProcessor.current.applyFilters(signal.filteredValue);
      
      // Update the processed signal with enhanced data
      const enhancedSignal: ProcessedSignal = {
        ...signal,
        filteredValue,
        quality,
        fingerDetected
      };
      
      // Update state with the processed signal
      setLastSignal(enhancedSignal);
      processedFramesCount.current++;
      fpsCounter.current++;
      
    } catch (err) {
      console.error("Error processing signal", err);
      setError("Error procesando señal");
    }
  }, [isProcessing]);
  
  // Handler for processing errors
  const handleProcessingError = useCallback((error: any) => {
    console.error("PPG processing error:", error);
    setError(`Error: ${error.message || "Error de procesamiento desconocido"}`);
  }, []);
  
  // Start signal processing
  const startProcessing = useCallback(() => {
    if (ppgProcessor.current) {
      ppgProcessor.current.start();
      lastFpsMeasurement.current = Date.now();
      fpsCounter.current = 0;
      processedFramesCount.current = 0;
      setIsProcessing(true);
      setError(null);
      console.log("useSignalProcessor: Procesamiento iniciado");
    }
  }, []);
  
  // Stop signal processing
  const stopProcessing = useCallback(() => {
    if (ppgProcessor.current) {
      ppgProcessor.current.stop();
      setIsProcessing(false);
      console.log("useSignalProcessor: Procesamiento detenido", {
        framesProcessed: processedFramesCount.current,
        fps: processingFps.current
      });
    }
  }, []);
  
  // Process a single frame
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing && ppgProcessor.current) {
      ppgProcessor.current.processFrame(imageData);
    }
  }, [isProcessing]);
  
  // Reset processors
  const reset = useCallback(() => {
    if (signalProcessor.current) {
      signalProcessor.current.reset();
    }
    
    if (ppgProcessor.current) {
      ppgProcessor.current.stop();
    }
    
    // Reset services
    ArrhythmiaDetectionService.reset();
    FingerDetectionService.reset();
    
    setIsProcessing(false);
    setLastSignal(null);
    setError(null);
    processedFramesCount.current = 0;
    
    console.log("useSignalProcessor: Processor reset complete");
  }, []);
  
  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame,
    lastSignal,
    error,
    fps: processingFps.current,
    framesProcessed: processedFramesCount.current,
    reset
  };
}
