
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
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
  
  // Nuevo: Control de estabilidad de la señal
  const signalBufferRef = useRef<number[]>([]);
  const MAX_BUFFER_SIZE = 15;
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.08; // Umbral más alto para señal débil
  const MAX_CONSECUTIVE_WEAK = 5;

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback con verificación adicional
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Verificar estabilidad de la señal
      signalBufferRef.current.push(signal.filteredValue);
      if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
        signalBufferRef.current.shift();
      }
      
      // Detectar señales débiles
      if (Math.abs(signal.filteredValue) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
      } else {
        consecutiveWeakSignalsRef.current = 0;
      }
      
      // Si hay demasiadas señales débiles consecutivas, ajustar la detección de dedo
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK) {
        // Forzar a false la detección de dedo en señales muy débiles
        signal.fingerDetected = false;
      }
      
      // Añadir verificación de variabilidad para evitar falsos positivos
      if (signalBufferRef.current.length >= 5) {
        const recentValues = signalBufferRef.current.slice(-5);
        const max = Math.max(...recentValues);
        const min = Math.min(...recentValues);
        const range = max - min;
        
        // Si la señal es demasiado estable (sin variación), probablemente no hay dedo
        if (range < 0.02 && signal.fingerDetected) {
          console.log("useSignalProcessor: Señal demasiado estable, ajustando fingerDetected");
          signal.fingerDetected = false;
        }
        
        // Si la señal es demasiado errática, reducir la calidad
        if (range > 0.5) {
          console.log("useSignalProcessor: Señal errática, reduciendo calidad");
          signal.quality = Math.max(0, signal.quality - 20);
        }
      }
      
      // Pass through with modifications for better quality control
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
    
    // Reset stability control
    signalBufferRef.current = [];
    consecutiveWeakSignalsRef.current = 0;
    
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
   * Process a frame from camera with additional validations
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
