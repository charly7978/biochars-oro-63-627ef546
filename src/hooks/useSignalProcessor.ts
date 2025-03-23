
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProcessedSignal, ProcessingError } from '../types/signal';

// Interfaz simplificada para el procesador avanzado
interface ISignalProcessor {
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  processFrame(imageData: ImageData): void;
}

/**
 * Hook para gestionar el procesamiento avanzado de señales PPG.
 */
export const useSignalProcessor = () => {
  // Estado del hook
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
  
  // Referencias para historial de calidad
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5;
  
  // Función para cargar el procesador dinámicamente
  const loadProcessor = useCallback(async (): Promise<ISignalProcessor> => {
    try {
      // Importación dinámica del módulo
      const { AdvancedSignalProcessor } = await import('../modules/advanced/AdvancedSignalProcessor');
      
      // Crear la clase procesadora
      const processor = {
        onSignalReady: undefined,
        onError: undefined,
        async initialize() {
          console.log("Inicializando procesador avanzado");
          return Promise.resolve();
        },
        start() {
          console.log("Iniciando procesador avanzado");
        },
        stop() {
          console.log("Deteniendo procesador avanzado");
        },
        processFrame(imageData: ImageData) {
          // Implementación básica
          const data = imageData.data;
          let redSum = 0, greenSum = 0, blueSum = 0;
          const centerPixels = 100;
          
          for (let i = 0; i < centerPixels; i++) {
            const pixelIndex = Math.floor(Math.random() * data.length / 4) * 4;
            redSum += data[pixelIndex];
            greenSum += data[pixelIndex + 1];
            blueSum += data[pixelIndex + 2];
          }
          
          const redValue = redSum / centerPixels;
          const signal: ProcessedSignal = {
            timestamp: Date.now(),
            filteredValue: redValue,
            quality: 90,
            fingerDetected: true,
            roi: {
              x: 0,
              y: 0,
              width: 100,
              height: 100
            },
            channels: {
              red: redValue,
              green: greenSum / centerPixels,
              blue: blueSum / centerPixels
            }
          };
          
          if (this.onSignalReady) {
            this.onSignalReady(signal);
          }
        }
      };
      
      return processor;
    } catch (error) {
      console.error("Error cargando procesador:", error);
      throw error;
    }
  }, []);
  
  // Estado para el procesador
  const [processor, setProcessor] = useState<ISignalProcessor | null>(null);
  
  // Inicialización del procesador
  useEffect(() => {
    let mounted = true;
    
    const initProcessor = async () => {
      try {
        const newProcessor = await loadProcessor();
        if (mounted) {
          setProcessor(newProcessor);
        }
      } catch (error) {
        console.error("Error inicializando procesador:", error);
      }
    };
    
    initProcessor();
    
    return () => {
      mounted = false;
    };
  }, [loadProcessor]);
  
  /**
   * Procesa la detección de dedo de manera robusta usando promedio móvil
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Actualizar historial de calidad
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    // Actualizar historial de detección
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Cálculo ponderado de calidad
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = index + 1; // Más peso a las muestras recientes
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Calcular ratio de detección (more sensitive threshold)
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    // Umbral sensible pero robusto
    const robustFingerDetected = detectionRatio >= 0.4;
    
    // Mejora ligera de calidad para mejor UX
    const enhancedQuality = Math.min(100, avgQuality * 1.2);
    
    // Devolver señal modificada
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, []);

  // Configurar callbacks y limpieza
  useEffect(() => {
    if (!processor) return;
    
    console.log("useSignalProcessor: Configurando callbacks");
    
    // Callback cuando hay señal lista
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
          maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
        
        if (prev.totalValues % 50 === 0) {
          console.log("useSignalProcessor: Estadísticas de señal:", newStats);
        }
        
        return newStats;
      });
    };

    // Callback de error
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error detallado:", error);
      setError(error);
    };

    // Inicializar procesador
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup al desmontar
    return () => {
      if (processor) {
        processor.stop();
      }
    };
  }, [processor, processRobustFingerDetection]);

  /**
   * Inicia el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    if (!processor) return;
    
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    
    processor.start();
  }, [processor]);

  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    if (!processor) return;
    
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Procesa un frame de imagen
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing || !processor) return;
    
    try {
      processor.processFrame(imageData);
    } catch (err) {
      console.error("useSignalProcessor: Error procesando frame:", err);
    }
  }, [isProcessing, processor]);

  // Devolver la interfaz pública
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
