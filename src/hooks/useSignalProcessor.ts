/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

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
    
    return new PPGSignalProcessor();
  });
  
  // Acceso al procesador de pulso cardiaco
  const heartBeatProcessorRef = useRef<HeartBeatProcessor | null>(null);
  
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

  // Inicializar HeartBeatProcessor para el cálculo de frecuencia cardiaca
  useEffect(() => {
    if (!heartBeatProcessorRef.current) {
      console.log("useSignalProcessor: Inicializando procesador de frecuencia cardiaca");
      heartBeatProcessorRef.current = new HeartBeatProcessor();
      
      // Registrar a nivel global para debug si es necesario
      if (typeof window !== 'undefined' && !window.heartBeatProcessor) {
        window.heartBeatProcessor = heartBeatProcessorRef.current;
      }
    }
  }, []);

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback
    processor.onSignalReady = (signal: ProcessedSignal) => {
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
      
      // Procesar con el HeartBeatProcessor si hay dedo detectado y señal de calidad
      if (signal.fingerDetected && signal.quality > 30 && heartBeatProcessorRef.current) {
        try {
          // Enviar la señal filtrada al procesador de frecuencia cardiaca
          const result = heartBeatProcessorRef.current.processSignal(signal.filteredValue);
          
          // Registrar resultados en consola para diagnóstico (cada 20 frames)
          if (framesProcessed % 20 === 0) {
            console.log("HeartBeatProcessor resultado:", {
              bpm: result.bpm,
              confidence: result.confidence,
              isPeak: result.isPeak,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error procesando señal en HeartBeatProcessor:", error);
        }
      }
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
      processor.stop();
    };
  }, [processor, framesProcessed]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    // Reiniciar el estado para nueva medición
    if (heartBeatProcessorRef.current) {
      heartBeatProcessorRef.current.reset();
    }
    
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

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  /**
   * Obtener la frecuencia cardiaca actual
   */
  const getCurrentHeartRate = useCallback(() => {
    if (heartBeatProcessorRef.current) {
      try {
        // Obtener la última frecuencia cardiaca calculada
        const rrData = heartBeatProcessorRef.current.getRRIntervals();
        if (rrData && rrData.intervals && rrData.intervals.length > 0) {
          // Convertir intervalos RR a BPM y promediar
          const bpmValues = rrData.intervals.map(interval => 60000 / interval);
          const avgBPM = bpmValues.reduce((sum, val) => sum + val, 0) / bpmValues.length;
          return Math.round(avgBPM);
        }
      } catch (error) {
        console.error("Error al obtener frecuencia cardiaca:", error);
      }
    }
    return 0;
  }, []);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    getCurrentHeartRate
  };
};
