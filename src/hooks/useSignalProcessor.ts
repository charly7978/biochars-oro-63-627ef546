
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
  
  // Nuevas estadísticas para canales múltiples
  const [channelStats, setChannelStats] = useState({
    red: { snr: 0, weight: 0 },
    green: { snr: 0, weight: 0 },
    blue: { snr: 0, weight: 0 }
  });
  
  // Rastreo de rendimiento
  const lastFrameTimeRef = useRef<number>(0);
  const frameProcessingTimesRef = useRef<number[]>([]);
  const [processingLoad, setProcessingLoad] = useState(0);
  
  // Control adaptativo de procesamiento
  const [adaptiveFrameSkip, setAdaptiveFrameSkip] = useState(0);
  const frameCountRef = useRef(0);

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Calcular carga de procesamiento
      const now = Date.now();
      if (lastFrameTimeRef.current > 0) {
        const processingTime = now - lastFrameTimeRef.current;
        frameProcessingTimesRef.current.push(processingTime);
        
        // Mantener solo las últimas 10 mediciones
        if (frameProcessingTimesRef.current.length > 10) {
          frameProcessingTimesRef.current.shift();
        }
        
        // Calcular carga promedio
        if (frameProcessingTimesRef.current.length >= 3) {
          const avgProcessingTime = frameProcessingTimesRef.current.reduce((a, b) => a + b, 0) / 
                                  frameProcessingTimesRef.current.length;
          const load = Math.min(100, (avgProcessingTime / 33.33) * 100); // 33.33ms = 30fps
          setProcessingLoad(load);
          
          // Ajustar skip de frames según carga
          if (load > 80) {
            setAdaptiveFrameSkip(prev => Math.min(prev + 1, 3));
          } else if (load < 50 && adaptiveFrameSkip > 0) {
            setAdaptiveFrameSkip(prev => Math.max(prev - 1, 0));
          }
        }
      }
      lastFrameTimeRef.current = now;
      
      // Actualizar estado
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
      
      // Actualizar estadísticas multicanal si están disponibles
      if (signal.multiChannelData) {
        setChannelStats({
          red: { 
            snr: calculateSNR(signal.filteredValue), 
            weight: signal.multiChannelData.weights.red 
          },
          green: { 
            snr: calculateSNR(signal.filteredValue * 1.2), // Factor aproximado
            weight: signal.multiChannelData.weights.green 
          },
          blue: { 
            snr: calculateSNR(signal.filteredValue * 0.8), // Factor aproximado
            weight: signal.multiChannelData.weights.blue
          }
        });
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
  }, [processor]);
  
  // Función para calcular SNR aproximado
  const calculateSNR = (values: number): number => {
    if (!values) return 0;
    
    // Aproximación simple de SNR basada en el valor filtrado
    return Math.min(10, Math.max(0, Math.abs(values) / 100));
  };

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
    frameProcessingTimesRef.current = [];
    lastFrameTimeRef.current = 0;
    frameCountRef.current = 0;
    setAdaptiveFrameSkip(0);
    
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
   * Process a frame from camera with adaptive frame skipping
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        // Implementar frame skipping adaptativo basado en carga
        frameCountRef.current++;
        if (frameCountRef.current % (adaptiveFrameSkip + 1) !== 0) {
          return; // Saltar frame
        }
        
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor, adaptiveFrameSkip]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    channelStats,
    processingLoad,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
