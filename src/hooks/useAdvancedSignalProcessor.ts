
import { useState, useEffect, useCallback, useRef } from 'react';
import OpenCVService from '../services/OpenCVService';
import TensorFlowService from '../services/TensorFlowService';
import { OpenCVSignalProcessor, ProcessedFrame } from '../modules/advanced-signal-processing/OpenCVSignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export interface AdvancedSignalProcessorOptions {
  enableOpenCV?: boolean;
  enableTensorFlow?: boolean;
  fingerDetectionThreshold?: number;
  qualityThreshold?: number;
}

/**
 * Hook avanzado para el procesamiento de señales PPG
 * Integra OpenCV.js y TensorFlow.js para procesamiento de alta precisión
 */
export const useAdvancedSignalProcessor = (options: AdvancedSignalProcessorOptions = {}) => {
  const {
    enableOpenCV = true,
    enableTensorFlow = true,
    fingerDetectionThreshold = 0.6,
    qualityThreshold = 40
  } = options;
  
  // Procesadores
  const [openCVProcessor] = useState(() => new OpenCVSignalProcessor());
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  
  // Estado para estadísticas de procesamiento
  const [processingStats, setProcessingStats] = useState({
    fps: 0,
    avgProcessingTime: 0,
    totalProcessingTime: 0,
    consecutiveDetections: 0,
    lastDetectionTime: 0
  });
  
  // Referencias para métricas
  const statsRef = useRef({
    frameTimestamps: [] as number[],
    processingTimes: [] as number[],
    lastFrameTime: 0,
  });
  
  // Buffer para filtrado de señal
  const signalBufferRef = useRef<number[]>([]);
  const MAX_BUFFER_SIZE = 30;
  
  // Inicialización de procesadores
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      setError(null);
      
      try {
        // Inicializar OpenCV.js si está habilitado
        if (enableOpenCV) {
          await openCVProcessor.initialize();
        }
        
        // Inicializar TensorFlow.js si está habilitado
        if (enableTensorFlow) {
          await TensorFlowService.initialize();
        }
        
        console.log('Procesadores avanzados inicializados correctamente');
        setIsInitializing(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        console.error('Error inicializando procesadores:', err);
        setError({
          code: 'INIT_ERROR',
          message: `Error al inicializar procesadores: ${errorMessage}`,
          timestamp: Date.now()
        });
        setIsInitializing(false);
      }
    };
    
    initialize();
    
    // Cleanup
    return () => {
      // Liberar recursos si es necesario
      if (enableTensorFlow) {
        TensorFlowService.dispose();
      }
    };
  }, [enableOpenCV, enableTensorFlow, openCVProcessor]);
  
  /**
   * Procesa un frame usando OpenCV y TensorFlow
   */
  const processFrame = useCallback(async (imageData: ImageData) => {
    if (!isProcessing || isInitializing) return;
    
    const startTime = performance.now();
    
    try {
      // Actualizar estadísticas de FPS
      const now = Date.now();
      const timestamps = statsRef.current.frameTimestamps;
      timestamps.push(now);
      
      // Mantener solo los últimos 30 frames para calcular FPS
      if (timestamps.length > 30) {
        timestamps.shift();
      }
      
      // Procesar con OpenCV
      let openCVResult: ProcessedFrame | null = null;
      let tensorFlowFingerDetected = false;
      
      if (enableOpenCV) {
        openCVResult = openCVProcessor.processFrame(imageData);
      }
      
      // Procesar con TensorFlow para detección de dedo
      if (enableTensorFlow) {
        tensorFlowFingerDetected = await TensorFlowService.detectFinger(
          imageData,
          fingerDetectionThreshold
        );
      }
      
      // Determinar si hay dedo detectado combinando resultados
      let fingerDetected = false;
      let quality = 0;
      let rawValue = 0;
      let filteredValue = 0;
      
      if (openCVResult) {
        // Si usamos OpenCV, confiar principalmente en su detección
        fingerDetected = openCVResult.fingerDetected;
        quality = openCVResult.quality;
        rawValue = openCVResult.rawValue;
        filteredValue = openCVResult.processedValue;
        
        // Si TensorFlow también está habilitado, combinar resultados
        if (enableTensorFlow) {
          // Si OpenCV y TensorFlow están en desacuerdo, confiar más en OpenCV
          // pero usar TensorFlow para mejorar la confianza
          if (openCVResult.fingerDetected && !tensorFlowFingerDetected) {
            // OpenCV detecta dedo pero TensorFlow no
            // Reducir la calidad pero mantener la detección si la calidad es suficiente
            quality = Math.max(0, quality - 15);
            fingerDetected = quality >= qualityThreshold;
          } else if (!openCVResult.fingerDetected && tensorFlowFingerDetected) {
            // TensorFlow detecta dedo pero OpenCV no
            // Permitir detección con baja confianza
            fingerDetected = true;
            quality = 45; // Confianza moderada-baja
          } else if (openCVResult.fingerDetected && tensorFlowFingerDetected) {
            // Ambos detectan dedo, aumentar confianza
            quality = Math.min(100, quality + 10);
            fingerDetected = true;
          }
        }
      } else if (enableTensorFlow) {
        // Si solo usamos TensorFlow
        fingerDetected = tensorFlowFingerDetected;
        quality = fingerDetected ? 70 : 0; // Valor predeterminado
        
        // Extraer valor crudo RGB para compatibilidad
        const data = imageData.data;
        let redSum = 0;
        let count = 0;
        const centerStartX = Math.floor(imageData.width * 0.4);
        const centerEndX = Math.floor(imageData.width * 0.6);
        const centerStartY = Math.floor(imageData.height * 0.4);
        const centerEndY = Math.floor(imageData.height * 0.6);
        
        for (let y = centerStartY; y < centerEndY; y++) {
          for (let x = centerStartX; x < centerEndX; x++) {
            const i = (y * imageData.width + x) * 4;
            redSum += data[i];
            count++;
          }
        }
        
        rawValue = count > 0 ? redSum / count : 0;
        filteredValue = rawValue;
      } else {
        // Ni OpenCV ni TensorFlow habilitados, usar método básico
        const data = imageData.data;
        let redSum = 0;
        let greenSum = 0;
        let blueSum = 0;
        let count = 0;
        
        // Usar área central
        const centerStartX = Math.floor(imageData.width * 0.4);
        const centerEndX = Math.floor(imageData.width * 0.6);
        const centerStartY = Math.floor(imageData.height * 0.4);
        const centerEndY = Math.floor(imageData.height * 0.6);
        
        for (let y = centerStartY; y < centerEndY; y++) {
          for (let x = centerStartX; x < centerEndX; x++) {
            const i = (y * imageData.width + x) * 4;
            redSum += data[i];
            greenSum += data[i + 1];
            blueSum += data[i + 2];
            count++;
          }
        }
        
        if (count > 0) {
          rawValue = redSum / count;
          
          // Detección de dedo simple basada en relación de colores
          const redMean = redSum / count;
          const greenMean = greenSum / count;
          const blueMean = blueSum / count;
          
          // La piel tiene predominancia del canal rojo
          const isRedDominant = redMean > greenMean && redMean > blueMean;
          const redGreenRatio = greenMean > 0 ? redMean / greenMean : 0;
          
          fingerDetected = isRedDominant && redGreenRatio > 1.2 && redMean > 80;
          quality = fingerDetected ? 50 : 0;
          filteredValue = rawValue;
        }
      }
      
      // Actualizar buffer de señal para filtrado temporal
      if (fingerDetected) {
        signalBufferRef.current.push(filteredValue);
        if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
          signalBufferRef.current.shift();
        }
        
        // Aplicar filtrado adicional si hay suficientes muestras
        if (signalBufferRef.current.length > 5) {
          // Filtro de mediana para picos
          const sortedValues = [...signalBufferRef.current].slice(-5).sort((a, b) => a - b);
          const medianValue = sortedValues[Math.floor(sortedValues.length / 2)];
          
          // Filtro paso bajo simple (media móvil)
          const recentValues = signalBufferRef.current.slice(-5);
          const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
          
          // Combinar con peso hacia la mediana para mejor eliminación de ruido
          filteredValue = medianValue * 0.7 + avgValue * 0.3;
        }
      } else {
        // Limpiar buffer si no hay dedo
        signalBufferRef.current = [];
      }
      
      // Actualizar estadísticas de detección
      let consecutiveDetections = processingStats.consecutiveDetections;
      if (fingerDetected) {
        consecutiveDetections++;
      } else {
        consecutiveDetections = 0;
      }
      
      // Crear señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue,
        filteredValue,
        quality,
        fingerDetected,
        roi: openCVResult?.roi || {
          x: Math.floor(imageData.width * 0.4),
          y: Math.floor(imageData.height * 0.4),
          width: Math.floor(imageData.width * 0.2),
          height: Math.floor(imageData.height * 0.2)
        },
        perfusionIndex: calculatePerfusionIndex(signalBufferRef.current)
      };
      
      // Actualizar estado
      setLastSignal(processedSignal);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      statsRef.current.processingTimes.push(processingTime);
      
      if (statsRef.current.processingTimes.length > 30) {
        statsRef.current.processingTimes.shift();
      }
      
      // Actualizar FPS y tiempo de procesamiento cada 10 frames
      if (framesProcessed % 10 === 0) {
        updateProcessingStats(consecutiveDetections, fingerDetected ? now : processingStats.lastDetectionTime);
      }
      
      // Proporcionar feedback al modelo de TensorFlow para mejora continua
      // Solo hacer esto ocasionalmente para no sobrecargar
      if (enableTensorFlow && framesProcessed % 30 === 0) {
        // Enseñar al modelo con el resultado de detección combinado
        TensorFlowService.improveFingerDetectionWithFeedback(imageData, fingerDetected);
      }
      
    } catch (err) {
      console.error('Error procesando frame:', err);
      
      // Notificar error pero continuar procesando
      setError({
        code: 'PROCESSING_ERROR',
        message: err instanceof Error ? err.message : 'Error desconocido',
        timestamp: Date.now()
      });
    }
  }, [
    isProcessing, 
    isInitializing, 
    enableOpenCV, 
    enableTensorFlow, 
    openCVProcessor, 
    fingerDetectionThreshold,
    qualityThreshold,
    processingStats,
    framesProcessed
  ]);
  
  /**
   * Actualiza estadísticas de procesamiento
   */
  const updateProcessingStats = useCallback((consecutiveDetections: number, lastDetectionTime: number) => {
    const timestamps = statsRef.current.frameTimestamps;
    const processingTimes = statsRef.current.processingTimes;
    
    // Calcular FPS
    let fps = 0;
    if (timestamps.length > 1) {
      const timeRange = timestamps[timestamps.length - 1] - timestamps[0];
      fps = timeRange > 0 ? (timestamps.length / timeRange) * 1000 : 0;
    }
    
    // Calcular tiempo medio de procesamiento
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;
    
    setProcessingStats({
      fps: Math.round(fps * 10) / 10,
      avgProcessingTime,
      totalProcessingTime: processingTimes.reduce((sum, time) => sum + time, 0),
      consecutiveDetections,
      lastDetectionTime
    });
  }, []);
  
  /**
   * Inicia el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    if (isInitializing) {
      console.warn('No se puede iniciar procesamiento mientras se inicializa');
      return;
    }
    
    console.log('Iniciando procesamiento avanzado de señales');
    setIsProcessing(true);
    setFramesProcessed(0);
    statsRef.current = {
      frameTimestamps: [],
      processingTimes: [],
      lastFrameTime: 0,
    };
    signalBufferRef.current = [];
    setProcessingStats({
      fps: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      consecutiveDetections: 0,
      lastDetectionTime: 0
    });
  }, [isInitializing]);
  
  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log('Deteniendo procesamiento avanzado de señales');
    setIsProcessing(false);
  }, []);
  
  /**
   * Calcula el índice de perfusión
   */
  const calculatePerfusionIndex = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10);
  };
  
  return {
    isInitializing,
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    processingStats,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
