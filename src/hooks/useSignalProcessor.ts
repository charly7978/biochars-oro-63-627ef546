
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
  
  // Parámetros de procesamiento ajustados para mayor sensibilidad a dedo humano
  const MAX_BUFFER_SIZE = 300;
  const QUALITY_THRESHOLD = 35; // Reducido para detectar señales más tenues
  const FINGER_DETECTION_FRAMES = 3; // Reducido para respuesta más rápida a presencia de dedo
  const MIN_SIGNAL_AMPLITUDE = 0.003; // Reducido para captar señales más sutiles
  const fingerDetectionCounterRef = useRef<number>(0);
  
  // Ajustes de filtrado optimizados para señales cardíacas humanas
  const LP_ALPHA = 0.1; // Ajustado para mayor sensibilidad a cambios rápidos
  const SMA_WINDOW = 6; // Reducido para mejor respuesta a cambios
  const lastFilteredValueRef = useRef<number | null>(null);
  
  // Control de amplificación dinámica mejorado
  const amplificationFactorRef = useRef<number>(80.0); // Factor inicial de amplificación aumentado
  const previousSignalLevelsRef = useRef<number[]>([]);
  
  // Sistema de memoria de señal para mejor continuidad
  const validSignalMemoryRef = useRef<{value: number, quality: number}[]>([]);
  const MAX_MEMORY_SIZE = 20;
  
  // Estabilidad de detección
  const consecutiveDetectionsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_DETECTIONS = 30; // Para evitar sobredetección
  
  useEffect(() => {
    return () => {
      console.log("useSignalProcessor hook cleanup");
      setIsProcessing(false);
      readyToProcessRef.current = false;
    };
  }, []);

  // Función mejorada para ajustar la amplificación basada en la intensidad real de sangre oxigenada
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
      
      // Estrategia adaptativa específica para dedo humano
      if (avgAmplitude < 0.008) {
        // Señal muy débil, posiblemente dedo mal colocado - aumentar amplificación significativamente
        amplificationFactorRef.current = Math.min(150, amplificationFactorRef.current * 1.08);
      } 
      else if (avgAmplitude < 0.02) {
        // Señal débil pero probablemente válida - aumentar gradualmente
        amplificationFactorRef.current = Math.min(120, amplificationFactorRef.current * 1.03);
      }
      // Para señales muy fuertes, reducir la amplificación
      else if (avgAmplitude > 0.25) {
        amplificationFactorRef.current = Math.max(20, amplificationFactorRef.current * 0.92);
      }
      // Para señales en rango alto pero aceptable
      else if (avgAmplitude > 0.1) {
        amplificationFactorRef.current = Math.max(30, amplificationFactorRef.current * 0.97);
      } 
      // Para señales en rango ideal, mantener estabilidad
      else if (avgAmplitude > 0.05) {
        // No ajustar - estamos en el rango óptimo
      } 
      else {
        // Señal ligeramente débil pero detectada - aumentar ligeramente
        amplificationFactorRef.current = Math.min(100, amplificationFactorRef.current * 1.01);
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
    validSignalMemoryRef.current = [];
    consecutiveDetectionsRef.current = 0;
    amplificationFactorRef.current = 80.0; // Amplificación inicial mayor para mejor respuesta
    setLastSignal(null);
    
    // Esperar un momento más corto antes de permitir procesamiento para respuesta más rápida
    setTimeout(() => {
      console.log("Signal processor: listo para procesar");
      readyToProcessRef.current = true;
      calibrationRef.current = true;
      
      // Tiempo de calibración
      setTimeout(() => {
        calibrationRef.current = false;
      }, 2500); // Tiempo de calibración reducido para respuesta más rápida
    }, 1500);
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

  // Mejora de extracción de canal rojo específica para sangre oxigenada
  const extractRedChannel = useCallback((imageData: ImageData): number => {
    const width = imageData.width;
    const height = imageData.height;
    
    // Usar región central con detección de mejor área de señal
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const regionSize = Math.min(100, Math.floor(width / 4)); // Región ajustada para mayor precisión
    
    const startX = centerX - Math.floor(regionSize / 2);
    const startY = centerY - Math.floor(regionSize / 2);
    const endX = startX + regionSize;
    const endY = startY + regionSize;
    
    // Dividir la región en subregiones para encontrar la mejor señal
    const GRID_SIZE = 3; // 3x3 grid
    const subRegionWidth = regionSize / GRID_SIZE;
    const subRegionHeight = regionSize / GRID_SIZE;
    const subRegions: {red: number, green: number, blue: number, quality: number}[] = [];
    
    // Analizar cada subregión
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const subStartX = startX + (i * subRegionWidth);
        const subStartY = startY + (j * subRegionHeight);
        
        let redSum = 0;
        let greenSum = 0;
        let blueSum = 0;
        let pixelCount = 0;
        
        // Analizar píxeles en la subregión
        for (let y = subStartY; y < subStartY + subRegionHeight; y++) {
          for (let x = subStartX; x < subStartX + subRegionWidth; x++) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
              redSum += imageData.data[idx]; // Canal rojo
              greenSum += imageData.data[idx + 1]; // Canal verde
              blueSum += imageData.data[idx + 2]; // Canal azul
              pixelCount++;
            }
          }
        }
        
        if (pixelCount > 0) {
          const avgRed = redSum / pixelCount;
          const avgGreen = greenSum / pixelCount;
          const avgBlue = blueSum / pixelCount;
          
          // Calcular calidad de la subregión basada en dominancia de rojo y brillo
          // La mejor región para PPG tiene alto rojo y diferencia adecuada con otros canales
          const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
          const brightness = (avgRed + avgGreen + avgBlue) / 3;
          
          // La calidad es mejor cuando el rojo domina pero no hay saturación
          const quality = redDominance * (avgRed > 50 && avgRed < 220 ? 1.0 : 0.5);
          
          subRegions.push({
            red: avgRed,
            green: avgGreen,
            blue: avgBlue,
            quality: quality
          });
        }
      }
    }
    
    // Seleccionar la mejor subregión para extraer la señal PPG
    let bestSubRegion = {red: 0, green: 0, blue: 0, quality: -1};
    for (const region of subRegions) {
      if (region.quality > bestSubRegion.quality) {
        bestSubRegion = region;
      }
    }
    
    // Calcular la señal PPG optimizada para sangre humana
    // Esta técnica resalta las variaciones de sangre oxigenada específicas del dedo humano
    const redNormalized = bestSubRegion.quality > 0 ? 
      bestSubRegion.red - (0.65 * bestSubRegion.green + 0.35 * bestSubRegion.blue) :
      0;
    
    return redNormalized;
  }, []);

  const processFrame = useCallback((imageData: ImageData, fingerDetectedOverride?: boolean) => {
    frameCountRef.current++;
    
    // Si no estamos procesando o no estamos listos, ignorar
    if (!isProcessing || !readyToProcessRef.current) {
      return;
    }
    
    // Sistema mejorado de detección de dedo específico para piel humana
    const detectionResult = detectFinger(imageData, {
      redThreshold: 70,               // Más sensible para detectar dedo
      brightnessThreshold: 50,        // Más sensible a luz ambiental
      redDominanceThreshold: 15,      // Exigente en dominancia de rojo (característica de piel)
      regionSize: 35,                 // Región óptima para análisis
      adaptiveMode: true,             // Usar detección adaptativa
      maxIntensityThreshold: 220      // Evitar superficies demasiado brillantes (paredes)
    });
    
    let fingerDetected = detectionResult.detected;
    
    // Si se provee un override, usarlo
    if (fingerDetectedOverride !== undefined) {
      fingerDetected = fingerDetectedOverride;
    }
    
    // Lógica mejorada para detección más rápida pero estable
    if (fingerDetected) {
      // Incrementar contador de detecciones consecutivas
      fingerDetectionCounterRef.current++;
      
      // Si ya tenemos suficientes detecciones consecutivas, confirmar detección
      if (!lastFingerDetectedRef.current && fingerDetectionCounterRef.current >= FINGER_DETECTION_FRAMES) {
        console.log("Dedo detectado después de", fingerDetectionCounterRef.current, "frames");
        lastFingerDetectedRef.current = true;
        consecutiveDetectionsRef.current = 0;
      }
    } else {
      // Si no hay detección, resetear contador
      fingerDetectionCounterRef.current = 0;
      
      // Dar un pequeño margen antes de considerar que ya no hay dedo (para evitar parpadeos)
      if (lastFingerDetectedRef.current) {
        consecutiveDetectionsRef.current++;
        
        // Solo después de varios frames sin detección, confirmar que no hay dedo
        if (consecutiveDetectionsRef.current >= 6) { // Un poco más de margen
          lastFingerDetectedRef.current = false;
          consecutiveDetectionsRef.current = 0;
        }
      }
    }
    
    // Calcular calidad de señal
    const signalQuality = calculateSignalQuality(detectionResult);
    signalQualityRef.current = signalQuality;
    
    // Extraer canal rojo (donde se captura mejor el pulso sanguíneo)
    const redValue = extractRedChannel(imageData);
    
    // Solo procesar si hay un dedo detectado con calidad suficiente
    if (lastFingerDetectedRef.current) {  // Usar estado estable, no detección instantánea
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
      
      // Guardar en memoria de señal válida
      validSignalMemoryRef.current.push({
        value: amplifiedValue,
        quality: signalQuality
      });
      
      // Limitar tamaño de memoria
      if (validSignalMemoryRef.current.length > MAX_MEMORY_SIZE) {
        validSignalMemoryRef.current.shift();
      }
      
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
          fingerDetected: lastFingerDetectedRef.current,
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
      // Si no hay dedo detectado, informar de estado vacío pero con mayor continuidad
      // para evitar cambios bruscos en la visualización
      
      const emptySignal: ProcessedSignal = {
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
      };
      
      setLastSignal(emptySignal);
      
      // Limpiar buffer y valores previos para evitar contaminación
      // pero con una pequeña desaceleración para evitar reinicialización brusca
      if (signalBufferRef.current.length > 20) {
        signalBufferRef.current = signalBufferRef.current.slice(-10);
      } else {
        signalBufferRef.current = [];
      }
      
      lastFilteredValueRef.current = null;
      previousSignalLevelsRef.current = [];
      amplificationFactorRef.current = 80.0; // Reiniciar amplificación
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
