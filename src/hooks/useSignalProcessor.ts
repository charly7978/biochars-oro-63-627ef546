
import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedSignal } from '../types/signal';
import { detectFinger, calculateSignalQuality } from '../utils/FingerDetection';

export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const readyToProcessRef = useRef<boolean>(false);
  const signalBufferRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const lastFingerDetectedRef = useRef<boolean>(false);
  const signalQualityRef = useRef<number>(0);
  const calibrationRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  
  // Parámetros de procesamiento
  const MAX_BUFFER_SIZE = 200;
  const QUALITY_THRESHOLD = 50;
  const FINGER_DETECTION_FRAMES = 8; // Frames consecutivos necesarios para confirmar detección
  const MIN_SIGNAL_AMPLITUDE = 0.01;
  const fingerDetectionCounterRef = useRef<number>(0);
  
  // Ajustes de filtrado
  const LP_ALPHA = 0.05; // Constante para filtro paso bajo (0-1), más bajo = más suavizado
  const SMA_WINDOW = 5;  // Tamaño de ventana para promedio móvil simple
  const lastFilteredValueRef = useRef<number | null>(null);
  
  useEffect(() => {
    return () => {
      console.log("useSignalProcessor hook cleanup");
      setIsProcessing(false);
      readyToProcessRef.current = false;
    };
  }, []);

  const startProcessing = useCallback(() => {
    console.log("Signal processor: iniciando procesamiento");
    setIsProcessing(true);
    
    // Resetear todos los buffers y estados
    signalBufferRef.current = [];
    lastTimeRef.current = Date.now();
    lastFingerDetectedRef.current = false;
    lastFilteredValueRef.current = null;
    signalQualityRef.current = 0;
    frameCountRef.current = 0;
    fingerDetectionCounterRef.current = 0;
    setLastSignal(null);
    
    // Esperar un momento antes de permitir procesamiento
    setTimeout(() => {
      console.log("Signal processor: listo para procesar");
      readyToProcessRef.current = true;
      calibrationRef.current = true;
      
      // Tiempo de calibración
      setTimeout(() => {
        calibrationRef.current = false;
      }, 3000);
    }, 2000);
  }, []);

  const stopProcessing = useCallback(() => {
    console.log("Signal processor: deteniendo procesamiento");
    setIsProcessing(false);
    readyToProcessRef.current = false;
  }, []);

  // Aplicar un filtro paso bajo para suavizar la señal
  const applyLowPassFilter = useCallback((newValue: number, previousValue: number | null): number => {
    if (previousValue === null) return newValue;
    return previousValue + LP_ALPHA * (newValue - previousValue);
  }, []);
  
  // Aplicar un filtro de promedio móvil simple
  const applySMAFilter = useCallback((buffer: number[]): number => {
    if (buffer.length === 0) return 0;
    if (buffer.length === 1) return buffer[0];
    
    const windowSize = Math.min(SMA_WINDOW, buffer.length);
    const recentValues = buffer.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return sum / windowSize;
  }, []);

  const extractRedChannel = useCallback((imageData: ImageData): number => {
    const width = imageData.width;
    const height = imageData.height;
    
    // Usar región central de la imagen
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(100, Math.floor(width / 4));
    
    const startX = centerX - Math.floor(regionSize / 2);
    const startY = centerY - Math.floor(regionSize / 2);
    const endX = startX + regionSize;
    const endY = startY + regionSize;
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        redSum += imageData.data[idx]; // Índice 0 para canal rojo
        pixelCount++;
      }
    }
    
    if (pixelCount === 0) return 0;
    return redSum / pixelCount;
  }, []);

  const processFrame = useCallback((imageData: ImageData, fingerDetectedOverride?: boolean) => {
    frameCountRef.current++;
    
    // Si no estamos procesando o no estamos listos, ignorar
    if (!isProcessing || !readyToProcessRef.current) {
      return;
    }
    
    // Sistema mejorado de detección de dedo utilizando el módulo especializado
    const detectionResult = detectFinger(imageData, {
      redThreshold: 60,             // Más sensible
      brightnessThreshold: 35,      // Más sensible
      redDominanceThreshold: 8,     // Más estricto para evitar falsos positivos
      regionSize: 40                // Región más grande para análisis
    });
    
    let fingerDetected = detectionResult.detected;
    
    // Si se provee un override, usarlo
    if (fingerDetectedOverride !== undefined) {
      fingerDetected = fingerDetectedOverride;
    }
    
    // Lógica para evitar cambios rápidos entre estados de detección
    // Requiere varios frames consecutivos para cambiar de estado
    if (fingerDetected !== lastFingerDetectedRef.current) {
      if (fingerDetected) {
        fingerDetectionCounterRef.current++;
        if (fingerDetectionCounterRef.current >= FINGER_DETECTION_FRAMES) {
          lastFingerDetectedRef.current = true;
          fingerDetectionCounterRef.current = 0;
        } else {
          fingerDetected = lastFingerDetectedRef.current;
        }
      } else {
        fingerDetectionCounterRef.current++;
        if (fingerDetectionCounterRef.current >= FINGER_DETECTION_FRAMES) {
          lastFingerDetectedRef.current = false;
          fingerDetectionCounterRef.current = 0;
        } else {
          fingerDetected = lastFingerDetectedRef.current;
        }
      }
    } else {
      fingerDetectionCounterRef.current = 0;
    }
    
    // Calcular calidad de señal
    const signalQuality = calculateSignalQuality(detectionResult);
    signalQualityRef.current = signalQuality;
    
    // Extraer canal rojo (donde se captura mejor el pulso sanguíneo)
    const redValue = extractRedChannel(imageData);
    
    // Solo procesar si hay un dedo detectado con calidad suficiente
    if (fingerDetected) {
      // Añadir al buffer
      signalBufferRef.current.push(redValue);
      
      // Limitar tamaño del buffer
      if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
        signalBufferRef.current.shift();
      }
      
      // Aplicar filtros para limpiar la señal
      let filteredValue = applyLowPassFilter(
        applySMAFilter(signalBufferRef.current),
        lastFilteredValueRef.current
      );
      
      lastFilteredValueRef.current = filteredValue;
      
      // Verificar que haya suficiente amplitud en la señal
      const signalValid = signalQuality > QUALITY_THRESHOLD || 
                          Math.abs(filteredValue) > MIN_SIGNAL_AMPLITUDE;
      
      if (signalValid) {
        const now = Date.now();
        
        // Creamos el objeto de señal procesada
        const processedSignal: ProcessedSignal = {
          timestamp: now,
          rawValue: redValue,
          filteredValue,
          quality: signalQuality,
          fingerDetected,
          roi: {
            x: Math.floor(imageData.width / 4),
            y: Math.floor(imageData.height / 4),
            width: Math.floor(imageData.width / 2),
            height: Math.floor(imageData.height / 2)
          }
        };
        
        // Actualizar lastSignal
        setLastSignal(processedSignal);
        lastTimeRef.current = now;
      }
    } else {
      // Si no hay dedo detectado, informar de estado vacío
      setLastSignal({
        timestamp: Date.now(),
        rawValue: 0,
        filteredValue: 0,
        quality: 0,
        fingerDetected: false,
        roi: {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      });
      
      // Limpiar buffer y valores previos para evitar contaminación
      signalBufferRef.current = [];
      lastFilteredValueRef.current = null;
    }
  }, [isProcessing, applyLowPassFilter, applySMAFilter, extractRedChannel]);

  return {
    lastSignal,
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame,
    signalBuffer: signalBufferRef.current,
    signalQuality: signalQualityRef.current
  };
};
