
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { processRobustFingerDetection } from '../utils/fingerDetectionUtils';
import { SignalStats, updateSignalStats, createEmptySignalStats } from '../utils/signalStatsUtils';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Implementa detección robusta, adaptativa y natural.
 */
export const useSignalProcessor = () => {
  // Instancia del procesador
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Estado del procesador
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState<SignalStats>(createEmptySignalStats());
  
  // Referencias para historial y estabilización
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  
  // Variables para manejo adaptativo
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.45); // Umbral inicial menos restrictivo
  const adaptiveCounterRef = useRef<number>(0);
  
  // Contador para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);

  // Configurar callbacks y limpieza
  useEffect(() => {
    // Callback cuando hay señal lista
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const {
        updatedSignal,
        updatedQualityHistory,
        updatedFingerDetectedHistory,
        updatedConsecutiveNonDetection,
        updatedDetectionThreshold,
        updatedAdaptiveCounter,
        updatedSignalLockCounter
      } = processRobustFingerDetection(
        signal,
        qualityHistoryRef.current,
        fingerDetectedHistoryRef.current,
        consecutiveNonDetectionRef.current,
        detectionThresholdRef.current,
        adaptiveCounterRef.current,
        signalLockCounterRef.current
      );
      
      // Update refs with new values
      qualityHistoryRef.current = updatedQualityHistory;
      fingerDetectedHistoryRef.current = updatedFingerDetectedHistory;
      consecutiveNonDetectionRef.current = updatedConsecutiveNonDetection;
      detectionThresholdRef.current = updatedDetectionThreshold;
      adaptiveCounterRef.current = updatedAdaptiveCounter;
      signalLockCounterRef.current = updatedSignalLockCounter;
      
      setLastSignal(updatedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas
      setSignalStats(prev => updateSignalStats(prev, updatedSignal.filteredValue));
    };

    // Callback de error
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Inicializar procesador
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup al desmontar
    return () => {
      processor.stop();
    };
  }, [processor]);

  /**
   * Inicia el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats(createEmptySignalStats());
    
    // Resetear variables adaptativas
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.45; // Umbral inicial más permisivo
    adaptiveCounterRef.current = 0;
    
    processor.start();
  }, [processor]);

  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Calibra el procesador para mejores resultados
   */
  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración");
      
      // Resetear contadores adaptativos
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = 0;
      detectionThresholdRef.current = 0.40; // Umbral más permisivo para calibración
      adaptiveCounterRef.current = 0;
      
      await processor.calibrate();
      
      console.log("useSignalProcessor: Calibración exitosa");
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración:", error);
      return false;
    }
  }, [processor]);

  /**
   * Procesa un frame de imagen
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
    calibrate,
    processFrame
  };
};
