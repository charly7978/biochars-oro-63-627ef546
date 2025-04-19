
import { useState, useEffect, useRef, useCallback } from 'react';
import { OptimizedFingerDetector } from '../modules/finger-detection/OptimizedFingerDetector';

interface UseOptimizedFingerDetectionOptions {
  detectionInterval?: number;
  detectionThreshold?: number;
  enableFeedback?: boolean;
}

/**
 * Hook optimizado para detección de dedos con bajo consumo de recursos
 */
export const useOptimizedFingerDetection = (options: UseOptimizedFingerDetectionOptions = {}) => {
  const [isFingerDetected, setIsFingerDetected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const fingerDetectorRef = useRef<OptimizedFingerDetector | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const processingTimeRef = useRef<number[]>([]);
  const requestIdRef = useRef<number | null>(null);
  
  // Configuración con valores predeterminados eficientes
  const detectionInterval = options.detectionInterval || 150; // ms
  const detectionThreshold = options.detectionThreshold || 3; // detecciones consecutivas
  
  // Inicializar detector solo una vez
  useEffect(() => {
    const initDetector = async () => {
      try {
        const detector = new OptimizedFingerDetector();
        await detector.initialize();
        fingerDetectorRef.current = detector;
        setIsInitialized(true);
      } catch (error) {
        console.error('Error al inicializar detector de dedos:', error);
      }
    };
    
    initDetector();
    
    return () => {
      // Liberar recursos al desmontar
      if (requestIdRef.current !== null) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, []);
  
  /**
   * Procesa un frame de la cámara para detectar dedo
   */
  const processFrame = useCallback(async (imageData: ImageData): Promise<boolean> => {
    if (!isInitialized || !fingerDetectorRef.current) {
      return false;
    }
    
    const now = Date.now();
    // Limitar procesamiento según intervalo configurado
    if (now - lastProcessTimeRef.current < detectionInterval) {
      // Reuso último estado para no procesar innecesariamente
      return fingerDetectorRef.current.getIsFingerDetected();
    }
    
    const startTime = performance.now();
    frameCountRef.current++;
    
    try {
      const result = await fingerDetectorRef.current.detectFinger(imageData);
      
      // Actualizar estado solo si cambió (reducir re-renders)
      if (result !== isFingerDetected) {
        setIsFingerDetected(result);
      }
      
      // Medición de rendimiento para feedback
      const processingTime = performance.now() - startTime;
      processingTimeRef.current.push(processingTime);
      
      // Mantener solo últimas 20 mediciones
      if (processingTimeRef.current.length > 20) {
        processingTimeRef.current.shift();
      }
      
      lastProcessTimeRef.current = now;
      return result;
    } catch (error) {
      console.error('Error en processFrame:', error);
      return false;
    }
  }, [isInitialized, isFingerDetected, detectionInterval]);
  
  /**
   * Obtiene estadísticas de rendimiento
   */
  const getPerformanceStats = useCallback(() => {
    const times = processingTimeRef.current;
    if (times.length === 0) return { avgTime: 0, maxTime: 0, minTime: 0 };
    
    const sum = times.reduce((a, b) => a + b, 0);
    return {
      avgTime: sum / times.length,
      maxTime: Math.max(...times),
      minTime: Math.min(...times),
      frameCount: frameCountRef.current
    };
  }, []);
  
  /**
   * Reinicia el detector
   */
  const reset = useCallback(() => {
    if (fingerDetectorRef.current) {
      fingerDetectorRef.current.reset();
    }
    setIsFingerDetected(false);
    processingTimeRef.current = [];
    frameCountRef.current = 0;
  }, []);
  
  return {
    isFingerDetected,
    isInitialized,
    processFrame,
    getPerformanceStats,
    reset
  };
};
