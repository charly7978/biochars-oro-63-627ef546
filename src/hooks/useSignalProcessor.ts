
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
  
  // Parámetros de procesamiento ajustados
  const MAX_BUFFER_SIZE = 300; // Aumentado para capturar más historia de señal
  const QUALITY_THRESHOLD = 40; // Reducido para ser más sensible
  const FINGER_DETECTION_FRAMES = 5; // Reducido para respuesta más rápida
  const MIN_SIGNAL_AMPLITUDE = 0.005; // Reducido para detectar señales más sutiles
  const fingerDetectionCounterRef = useRef<number>(0);
  
  // Ajustes de filtrado optimizados para señales cardíacas
  const LP_ALPHA = 0.08; // Ajustado para mayor sensibilidad a cambios
  const SMA_WINDOW = 8;  // Aumentado para mejor suavizado
  const lastFilteredValueRef = useRef<number | null>(null);
  
  // Control de amplificación dinámica
  const amplificationFactorRef = useRef<number>(50.0); // Factor inicial de amplificación
  const previousSignalLevelsRef = useRef<number[]>([]);
  
  useEffect(() => {
    return () => {
      console.log("useSignalProcessor hook cleanup");
      setIsProcessing(false);
      readyToProcessRef.current = false;
    };
  }, []);

  // Nueva función para ajustar la amplificación basada en la intensidad de la señal
  const adjustAmplification = useCallback((value: number) => {
    const MAX_BUFFER = 10;
    previousSignalLevelsRef.current.push(Math.abs(value));
    if (previousSignalLevelsRef.current.length > MAX_BUFFER) {
      previousSignalLevelsRef.current.shift();
    }
    
    if (previousSignalLevelsRef.current.length >= 5) {
      // Calcular amplitud promedio reciente
      const avgAmplitude = previousSignalLevelsRef.current.reduce((sum, val) => sum + val, 0) / 
                          previousSignalLevelsRef.current.length;
      
      // Ajustar factor de amplificación inversamente a la amplitud
      // Para señales débiles, aumentar la amplificación
      if (avgAmplitude < 0.01) {
        amplificationFactorRef.current = Math.min(120, amplificationFactorRef.current * 1.05);
      } 
      // Para señales muy fuertes, reducir la amplificación
      else if (avgAmplitude > 0.2) {
        amplificationFactorRef.current = Math.max(20, amplificationFactorRef.current * 0.95);
      }
      // Para señales en rango ideal, ajustar gradualmente
      else if (avgAmplitude > 0.05) {
        amplificationFactorRef.current = Math.max(30, amplificationFactorRef.current * 0.99);
      } else {
        amplificationFactorRef.current = Math.min(80, amplificationFactorRef.current * 1.01);
      }
      
      console.log(`Señal: ${avgAmplitude.toFixed(4)}, Amplificación: ${amplificationFactorRef.current.toFixed(1)}`);
    }
    
    return value * amplificationFactorRef.current;
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
    previousSignalLevelsRef.current = [];
    amplificationFactorRef.current = 50.0; // Reiniciar amplificación
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

  // Mejora de extracción de canal rojo con normalización
  const extractRedChannel = useCallback((imageData: ImageData): number => {
    const width = imageData.width;
    const height = imageData.height;
    
    // Usar región central de la imagen (más pequeña para mayor precisión)
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(80, Math.floor(width / 5)); // Región más pequeña para mayor precisión
    
    const startX = centerX - Math.floor(regionSize / 2);
    const startY = centerY - Math.floor(regionSize / 2);
    const endX = startX + regionSize;
    const endY = startY + regionSize;
    
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        redSum += imageData.data[idx]; // Canal rojo
        greenSum += imageData.data[idx + 1]; // Canal verde
        blueSum += imageData.data[idx + 2]; // Canal azul
        pixelCount++;
      }
    }
    
    if (pixelCount === 0) return 0;
    
    // Extraer la señal con normalización de color
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;
    const avgBlue = blueSum / pixelCount;
    
    // Calcular la señal normalizada para maximizar componente pulsátil
    // Esta técnica resalta las variaciones de sangre oxigenada
    const redNormalized = avgRed - (0.7 * avgGreen + 0.3 * avgBlue);
    
    return redNormalized;
  }, []);

  const processFrame = useCallback((imageData: ImageData, fingerDetectedOverride?: boolean) => {
    frameCountRef.current++;
    
    // Si no estamos procesando o no estamos listos, ignorar
    if (!isProcessing || !readyToProcessRef.current) {
      return;
    }
    
    // Sistema mejorado de detección de dedo utilizando el módulo especializado
    const detectionResult = detectFinger(imageData, {
      redThreshold: 75,             // Ajustado para mejor equilibrio
      brightnessThreshold: 40,      // Más sensible
      redDominanceThreshold: 12,    // Más estricto para evitar falsos positivos
      regionSize: 35,               // Región óptima para análisis
      adaptiveMode: true            // Usar detección adaptativa
    });
    
    let fingerDetected = detectionResult.detected;
    
    // Si se provee un override, usarlo
    if (fingerDetectedOverride !== undefined) {
      fingerDetected = fingerDetectedOverride;
    }
    
    // Lógica para evitar cambios rápidos entre estados de detección
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
      
      // Aplicar filtros para limpiar y amplificar la señal
      // 1. Primero SMA para suavizar ruido
      const smoothedValue = applySMAFilter(signalBufferRef.current);
      
      // 2. Después filtro paso bajo para continuidad temporal
      const basicFiltered = applyLowPassFilter(smoothedValue, lastFilteredValueRef.current);
      
      // 3. Finalmente, amplificación dinámica para visualización
      const amplifiedValue = adjustAmplification(basicFiltered);
      
      lastFilteredValueRef.current = basicFiltered; // Guardar valor sin amplificar
      
      // Verificar que haya suficiente amplitud en la señal o calidad
      const signalValid = signalQuality > QUALITY_THRESHOLD || 
                         Math.abs(amplifiedValue) > MIN_SIGNAL_AMPLITUDE;
      
      if (signalValid) {
        const now = Date.now();
        
        // Creamos el objeto de señal procesada
        const processedSignal: ProcessedSignal = {
          timestamp: now,
          rawValue: redValue,
          filteredValue: amplifiedValue, // Usar valor amplificado
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
      previousSignalLevelsRef.current = [];
      amplificationFactorRef.current = 50.0; // Reiniciar amplificación
    }
  }, [isProcessing, applyLowPassFilter, applySMAFilter, extractRedChannel, adjustAmplification]);

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
