
import { useState, useEffect, useCallback, useRef } from 'react';
import OpenCVService from '../services/OpenCVService';
import TensorFlowService from '../services/TensorFlowService';
import { OptimizedFingerDetector } from '../modules/finger-detection/OptimizedFingerDetector';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { SignalOptimizerManager } from '../modules/signal-optimizer/SignalOptimizerManager';

interface UseAdvancedSignalProcessorOptions {
  enableOpenCV?: boolean;
  enableTensorFlow?: boolean;
  fingerDetectionThreshold?: number;
  qualityThreshold?: number;
  bufferSize?: number;
  processingInterval?: number;
}

/**
 * Hook avanzado para procesamiento de señales con múltiples canales optimizados
 */
export const useAdvancedSignalProcessor = (options: UseAdvancedSignalProcessorOptions = {}) => {
  // Opciones con valores por defecto
  const {
    enableOpenCV = true,
    enableTensorFlow = false, // Desactivado por defecto para menor consumo
    fingerDetectionThreshold = 0.6,
    qualityThreshold = 40,
    bufferSize = 200,
    processingInterval = 30, // ms entre frames para control de carga
  } = options;
  
  // Estados
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  
  // Referencias
  const fingerDetectorRef = useRef<OptimizedFingerDetector | null>(null);
  const rawBufferRef = useRef<number[]>([]);
  const filteredBufferRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);
  const lastProcessTimeRef = useRef<number>(0);
  const processingStatsRef = useRef({
    fps: 0,
    processingTimes: [] as number[],
    avgProcessingTime: 0,
    peakCount: 0,
    lastPeakTime: 0,
    heartRate: 0
  });
  
  // Optimizador de canales
  const optimizerRef = useRef(new SignalOptimizerManager({
    'raw': {
      gain: 1.0,
      filterType: 'none'
    },
    'filtered': {
      gain: 1.2,
      filterType: 'sma',
      filterWindow: 10
    },
    'heartbeat': {
      gain: 1.3,
      filterType: 'kalman',
      kalmanQ: 0.1,
      kalmanR: 0.5
    },
    'spo2': {
      gain: 1.5,
      filterType: 'ema',
      emaAlpha: 0.2
    }
  }));
  
  // Inicializar servicios necesarios
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Carga condicional de servicios para reducir consumo de recursos
        if (enableOpenCV) {
          await OpenCVService.loadOpenCV();
        }
        
        if (enableTensorFlow) {
          await TensorFlowService.initialize();
        }
        
        // Crear detector de dedos
        fingerDetectorRef.current = new OptimizedFingerDetector();
        await fingerDetectorRef.current.initialize();
        
        // Inicialización completa
        setIsInitializing(false);
        console.log("useAdvancedSignalProcessor: Servicios inicializados correctamente");
      } catch (error) {
        console.error("useAdvancedSignalProcessor: Error de inicialización", error);
        setError({
          code: "INIT_ERROR",
          message: "Error al inicializar procesador de señal",
          timestamp: Date.now()
        });
        setIsInitializing(false);
      }
    };
    
    initializeServices();
  }, [enableOpenCV, enableTensorFlow]);
  
  // Iniciar procesamiento de señal
  const startProcessing = useCallback(() => {
    if (isInitializing) {
      console.warn("useAdvancedSignalProcessor: No se puede iniciar, aún inicializando");
      return;
    }
    
    console.log("useAdvancedSignalProcessor: Iniciando procesamiento");
    setIsProcessing(true);
    frameCountRef.current = 0;
    rawBufferRef.current = [];
    filteredBufferRef.current = [];
    processingStatsRef.current = {
      fps: 0,
      processingTimes: [],
      avgProcessingTime: 0,
      peakCount: 0,
      lastPeakTime: 0,
      heartRate: 0
    };
    
    // Reiniciar optimizer
    optimizerRef.current.resetAll();
  }, [isInitializing]);
  
  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    console.log("useAdvancedSignalProcessor: Deteniendo procesamiento");
    setIsProcessing(false);
  }, []);
  
  // Procesar frame de cámara
  const processFrame = useCallback((imageData: ImageData): void => {
    if (!isProcessing) return;
    
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTimeRef.current;
    
    // Control de frecuencia de procesamiento
    if (timeSinceLastProcess < processingInterval) {
      return;
    }
    
    // Medir tiempo de procesamiento
    const processStart = performance.now();
    frameCountRef.current++;
    
    try {
      // Detección de dedo optimizada
      let isFingerDetected = false;
      if (fingerDetectorRef.current) {
        isFingerDetected = fingerDetectorRef.current.getIsFingerDetected();
        
        // Actualizar detección si pasó suficiente tiempo
        if (timeSinceLastProcess > 150) {
          fingerDetectorRef.current.detectFinger(imageData).then(detected => {
            isFingerDetected = detected;
          });
        }
      }
      
      // Si no se detecta dedo, procesamos con el mínimo para mantener flujo de datos
      if (!isFingerDetected) {
        // Extraer valor crudo mínimo para mantener continuidad
        const redValue = extractRedChannel(imageData);
        
        // Añadir a buffer raw para continuidad
        rawBufferRef.current.push(redValue);
        if (rawBufferRef.current.length > bufferSize) {
          rawBufferRef.current.shift();
        }
        
        // Procesar por canal optimizador y mantener continuidad
        const rawOptimized = optimizerRef.current.process('raw', redValue);
        optimizerRef.current.process('filtered', rawOptimized);
        
        // Crear señal básica de "no dedo"
        setLastSignal({
          timestamp: now,
          rawValue: redValue,
          filteredValue: 0,
          quality: 0,
          fingerDetected: false,
          roi: { x: 0, y: 0, width: 0, height: 0 }
        });
        
        lastProcessTimeRef.current = now;
        return;
      }
      
      // Extracción de canal rojo (optimizada)
      const redValue = extractRedChannel(imageData);
      
      // Procesar señal por canales optimizados
      const rawOptimized = optimizerRef.current.process('raw', redValue);
      const filtered = optimizerRef.current.process('filtered', rawOptimized);
      
      // Aplicar filtros específicos para canales vitales
      const heartbeatValue = optimizerRef.current.process('heartbeat', filtered);
      const spo2Value = optimizerRef.current.process('spo2', filtered);
      
      // Añadir a buffers para análisis
      rawBufferRef.current.push(redValue);
      if (rawBufferRef.current.length > bufferSize) {
        rawBufferRef.current.shift();
      }
      
      filteredBufferRef.current.push(filtered);
      if (filteredBufferRef.current.length > bufferSize) {
        filteredBufferRef.current.shift();
      }
      
      // Calcular calidad de señal
      const quality = calculateSignalQuality(filtered, filteredBufferRef.current);
      
      // Detección de picos para ritmo cardíaco
      const isPeak = detectPeak(heartbeatValue, optimizerRef.current.getChannel('heartbeat')?.getValues() || []);
      if (isPeak) {
        processingStatsRef.current.peakCount++;
        
        // Calcular intervalo RR
        if (processingStatsRef.current.lastPeakTime > 0) {
          const rrInterval = now - processingStatsRef.current.lastPeakTime;
          
          // Calcular frecuencia cardíaca si el intervalo es razonable (40-180 BPM)
          if (rrInterval >= 333 && rrInterval <= 1500) {
            // Convertir a BPM
            const instantBPM = Math.round(60000 / rrInterval);
            
            // Actualizar HR con ponderación para estabilidad
            processingStatsRef.current.heartRate = processingStatsRef.current.heartRate === 0 
              ? instantBPM 
              : Math.round(processingStatsRef.current.heartRate * 0.7 + instantBPM * 0.3);
              
            // Proporcionar feedback al canal de heartbeat
            optimizerRef.current.applyFeedback('heartbeat', {
              confidence: quality / 100,
              metricType: 'heartRate',
              quality: quality
            });
          }
        }
        
        processingStatsRef.current.lastPeakTime = now;
      }
      
      // Componer señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: determineROI(imageData),
        perfusionIndex: calculatePerfusionIndex(filteredBufferRef.current),
        heartRateConfidence: quality >= qualityThreshold ? quality / 100 : 0,
        acComponent: calculateACComponent(filteredBufferRef.current),
        dcComponent: calculateDCComponent(filteredBufferRef.current),
        signalToNoise: calculateSNR(filteredBufferRef.current),
        hydrationIndex: processingStatsRef.current.heartRate > 40 ? quality / 2 : 0
      };
      
      // Actualizar última señal procesada
      setLastSignal(processedSignal);
      
      // Actualizar estadísticas de rendimiento
      const processTime = performance.now() - processStart;
      
      // Mantener últimos tiempos para calcular promedio
      processingStatsRef.current.processingTimes.push(processTime);
      if (processingStatsRef.current.processingTimes.length > 20) {
        processingStatsRef.current.processingTimes.shift();
      }
      
      // Calcular promedio
      processingStatsRef.current.avgProcessingTime = processingStatsRef.current.processingTimes.reduce((a, b) => a + b, 0) 
        / processingStatsRef.current.processingTimes.length;
        
      // Calcular FPS aproximado
      processingStatsRef.current.fps = Math.round(1000 / Math.max(timeSinceLastProcess, 1));
      
      // Actualizar tiempo del último procesamiento
      lastProcessTimeRef.current = now;
    } catch (error) {
      console.error("useAdvancedSignalProcessor: Error procesando frame", error);
      setError({
        code: "PROCESS_ERROR",
        message: "Error al procesar frame de cámara",
        timestamp: now
      });
    }
  }, [isProcessing, bufferSize, processingInterval, qualityThreshold]);
  
  // Extraer canal rojo optimizado
  const extractRedChannel = (imageData: ImageData): number => {
    const data = imageData.data;
    
    // Muestreo optimizado: solo procesamos una parte central reducida de la imagen
    const sampleRegionSize = 0.2; // 20% central
    const startX = Math.floor(imageData.width * (0.5 - sampleRegionSize/2));
    const endX = Math.floor(imageData.width * (0.5 + sampleRegionSize/2));
    const startY = Math.floor(imageData.height * (0.5 - sampleRegionSize/2));
    const endY = Math.floor(imageData.height * (0.5 + sampleRegionSize/2));
    
    // Muestreamos cada varios píxeles para reducir carga
    const skipFactor = 2;
    let redSum = 0;
    let count = 0;
    
    for (let y = startY; y < endY; y += skipFactor) {
      for (let x = startX; x < endX; x += skipFactor) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Canal rojo
        count++;
      }
    }
    
    return count > 0 ? redSum / count : 0;
  };
  
  // Calcular región de interés
  const determineROI = (imageData: ImageData): ProcessedSignal['roi'] => {
    // Devolvemos la región central del 20%
    const centerSize = 0.2;
    return {
      x: Math.floor(imageData.width * (0.5 - centerSize/2)),
      y: Math.floor(imageData.height * (0.5 - centerSize/2)),
      width: Math.floor(imageData.width * centerSize),
      height: Math.floor(imageData.height * centerSize)
    };
  };
  
  // Calcular índice de perfusión
  const calculatePerfusionIndex = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-20);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const dc = (max + min) / 2;
    
    if (Math.abs(dc) < 0.001) return 0;
    
    const ac = max - min;
    const pi = (ac / Math.abs(dc)) * 100;
    
    return Math.min(pi, 10); // Limitar a 10%
  };
  
  // Calcular calidad de señal (0-100)
  const calculateSignalQuality = (currentValue: number, values: number[]): number => {
    if (values.length < 10) return 0;
    
    // Calcular estadísticas básicas
    const recentValues = values.slice(-20);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Desviación estándar para medir fluctuación
    let sumSquaredDiff = 0;
    for (const val of recentValues) {
      sumSquaredDiff += Math.pow(val - mean, 2);
    }
    const stdDev = Math.sqrt(sumSquaredDiff / recentValues.length);
    
    // Calcular periodicidad (correlación)
    let periodicityScore = 0;
    if (recentValues.length >= 15) {
      // Correlación básica
      const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
      const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
      let corrSum = 0;
      
      for (let i = 0; i < Math.min(firstHalf.length, secondHalf.length); i++) {
        corrSum += Math.abs(firstHalf[i] - secondHalf[i]);
      }
      
      // Normalizar
      periodicityScore = 1 - (corrSum / (Math.min(firstHalf.length, secondHalf.length) * 2 * stdDev));
      periodicityScore = Math.max(0, Math.min(1, periodicityScore));
    }
    
    // Calcular SNR simplificado
    const snr = mean !== 0 ? stdDev / Math.abs(mean) : 0;
    const snrScore = Math.min(1, 1 / (1 + snr * 5));
    
    // Calcular estabilidad (qué tan consistente es la señal)
    const range = Math.max(...recentValues) - Math.min(...recentValues);
    const stabilityScore = range > 0 ? Math.min(1, stdDev / range) : 0;
    
    // Combinar métricas
    const rawQuality = (
      periodicityScore * 0.4 +
      snrScore * 0.4 + 
      stabilityScore * 0.2
    ) * 100;
    
    // Convertir a escala 0-100
    return Math.max(0, Math.min(100, Math.round(rawQuality)));
  };
  
  // Calcular componente AC de la señal
  const calculateACComponent = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-20);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    
    return max - min;
  };
  
  // Calcular componente DC de la señal
  const calculateDCComponent = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-20);
    const sum = recentValues.reduce((a, b) => a + b, 0);
    
    return sum / recentValues.length;
  };
  
  // Calcular relación señal-ruido
  const calculateSNR = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    const recentValues = values.slice(-20);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    let sumSquaredDiff = 0;
    for (const val of recentValues) {
      sumSquaredDiff += Math.pow(val - mean, 2);
    }
    const variance = sumSquaredDiff / recentValues.length;
    
    // Estimar potencia de señal vs. ruido
    const acComponent = calculateACComponent(values);
    const signalPower = Math.pow(acComponent / 2, 2) / 2; // Potencia de una sinusoidal
    
    if (variance === 0) return 0;
    
    return 10 * Math.log10(signalPower / variance);
  };
  
  // Detectar pico en la señal
  const detectPeak = (value: number, values: number[]): boolean => {
    if (values.length < 5) return false;
    
    // Necesitamos valores históricos suficientes
    const recent = [
      values[values.length - 5] || 0,
      values[values.length - 4] || 0,
      values[values.length - 3] || 0,
      values[values.length - 2] || 0,
      values[values.length - 1] || 0,
      value
    ];
    
    // Es un pico si es mayor que los 2 puntos anteriores y posteriores
    return (
      value > recent[2] && 
      value > recent[3] && 
      value > recent[1] && 
      value > recent[0] &&
      value > 0.1 // Umbral mínimo para considerar un pico
    );
  };
  
  // Obtener estadísticas de procesamiento
  const getProcessingStats = useCallback(() => {
    return {
      fps: processingStatsRef.current.fps,
      avgProcessingTime: processingStatsRef.current.avgProcessingTime,
      frameCount: frameCountRef.current,
      heartRate: processingStatsRef.current.heartRate,
      peakCount: processingStatsRef.current.peakCount
    };
  }, []);
  
  // Propiedades públicas
  return {
    isInitializing,
    isProcessing,
    lastSignal,
    error,
    processingStats: getProcessingStats(),
    startProcessing,
    stopProcessing,
    processFrame,
    getOptimizer: () => optimizerRef.current
  };
};
