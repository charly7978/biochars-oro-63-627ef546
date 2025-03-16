
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { AutoCalibrationSystem, CalibrationResult } from '../modules/AutoCalibrationSystem';
import { toast } from 'sonner';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Implementa detección robusta, adaptativa y natural con calibración real.
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
  
  // Sistema de calibración autónomo
  const [calibrationSystem] = useState(() => new AutoCalibrationSystem());
  
  // Estado del procesador
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
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  
  // Referencias para historial y estabilización
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5;
  
  // Variables para manejo adaptativo
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.40); // Umbral menos restrictivo
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 30; // Más rápida adaptación
  const MIN_DETECTION_THRESHOLD = 0.25; // Umbral mínimo menos restrictivo
  
  // Contador para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 4;
  const RELEASE_GRACE_PERIOD = 3;
  
  // Contador de frames para calibración
  const calibrationFramesRef = useRef<number>(0);
  const requiredCalibrationFramesRef = useRef<number>(40); // Reducido para calibración más rápida (8 segundos)
  
  /**
   * Procesa la detección de dedo de manera robusta y adaptativa
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Actualizar historiales
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calcular ratio de detección - LÓGICA MÁS PERMISIVA
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calcular calidad ponderada (más peso a valores recientes)
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.2, index); // Ponderación exponencial menos agresiva
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lógica adaptativa mejorada
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.6; // Más permisivo
      const consistentNonDetection = rawDetectionRatio < 0.3; // Más permisivo
      
      if (consistentNonDetection) {
        // Hacer mucho más fácil la detección
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.12 // Mayor ajuste
        );
      } else if (consistentDetection && avgQuality < 30) { // Umbral reducido
        // Ser un poco más estrictos con detección pero baja calidad
        detectionThresholdRef.current = Math.min(
          0.5, // Máximo más bajo
          detectionThresholdRef.current + 0.03 // Ajuste más pequeño
        );
      }
    }
    
    // Lógica de "lock-in" para estabilidad
    if (signal.fingerDetected) {
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = Math.min(MAX_SIGNAL_LOCK, signalLockCounterRef.current + 1);
    } else {
      if (signalLockCounterRef.current >= MAX_SIGNAL_LOCK) {
        consecutiveNonDetectionRef.current++;
        
        if (consecutiveNonDetectionRef.current > RELEASE_GRACE_PERIOD) {
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
        }
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
      }
    }
    
    // Determinación final con criterios más naturales y permisivos
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    
    // Lógica más permisiva para detección
    const robustFingerDetected = isLockedIn || 
                                rawDetectionRatio >= currentThreshold || 
                                (signal.fingerDetected && avgQuality > 20);
    
    // Mejora de calidad para experiencia más suave
    const enhancementFactor = robustFingerDetected ? 1.12 : 1.0; // Mayor mejora
    const enhancedQuality = Math.min(100, Math.max(25, avgQuality * enhancementFactor));
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);
  
  /**
   * Inicia una nueva calibración del sistema
   * Duración reducida a aproximadamente 8 segundos
   */
  const startCalibration = useCallback(async () => {
    if (calibrationSystem.isCalibrationActive()) {
      console.log("useSignalProcessor: Ya hay una calibración en curso");
      return;
    }
    
    setIsCalibrating(true);
    calibrationFramesRef.current = 0;
    setCalibrationProgress(0);
    
    try {
      toast.info("Calibrando...", {
        description: "No mueva el dispositivo durante este proceso."
      });
      
      console.log("useSignalProcessor: Iniciando calibración de 8 segundos");
      
      // Aquí se ejecuta la calibración con frames reducidos para aproximadamente 8 segundos
      const result = await calibrationSystem.startCalibration(requiredCalibrationFramesRef.current);
      
      setCalibrationResult(result);
      console.log("useSignalProcessor: Calibración completada con éxito", result);
      
      toast.success("Calibración completada", {
        description: "Sistema adaptado a las condiciones actuales."
      });
      
      // Aplicar calibración al procesador de manera segura
      const processorAny = processor as any;
      if (typeof processorAny.applyCalibration === 'function') {
        processorAny.applyCalibration(result);
      }
      
    } catch (err) {
      console.error("useSignalProcessor: Error en calibración:", err);
      toast.error("Error en calibración", {
        description: "Usando parámetros más permisivos por defecto."
      });
    } finally {
      setIsCalibrating(false);
    }
  }, [calibrationSystem, processor]);
  
  /**
   * Procesa un frame para calibración
   */
  const processCalibrationFrame = useCallback((imageData: ImageData) => {
    if (!isCalibrating || !calibrationSystem.isCalibrationActive()) return;
    
    try {
      // Obtener estimación del valor PPG de manera segura
      const processorAny = processor as any;
      let estimatedValue: number | undefined;
      
      if (typeof processorAny.estimateValueFromImageData === 'function') {
        estimatedValue = processorAny.estimateValueFromImageData(imageData);
      } else {
        // Alternativa si el método no existe
        const redChannelAvg = getAverageRedChannel(imageData);
        estimatedValue = redChannelAvg;
      }
      
      if (typeof estimatedValue === 'number' && !isNaN(estimatedValue)) {
        const isComplete = calibrationSystem.processCalibrationFrame(estimatedValue);
        
        calibrationFramesRef.current++;
        const progress = Math.min(100, Math.round((calibrationFramesRef.current / requiredCalibrationFramesRef.current) * 100));
        setCalibrationProgress(progress);
        
        if (isComplete) {
          setIsCalibrating(false);
          const result = calibrationSystem.getCalibrationResult();
          if (result) {
            setCalibrationResult(result);
            
            // Aplicar calibración al procesador de manera segura
            if (typeof processorAny.applyCalibration === 'function') {
              processorAny.applyCalibration(result);
            }
          }
        }
      }
    } catch (err) {
      console.error("useSignalProcessor: Error procesando frame para calibración:", err);
    }
  }, [isCalibrating, calibrationSystem, processor]);

  // Función auxiliar para extraer valor promedio del canal rojo
  const getAverageRedChannel = (imageData: ImageData): number => {
    const data = imageData.data;
    let sum = 0;
    let count = 0;
    
    // Sample red channel (every 4th value starting at index 0)
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i];
      count++;
    }
    
    return count > 0 ? sum / count : 0;
  };

  // Configurar callbacks y limpieza
  useEffect(() => {
    // Callback cuando hay señal lista
    processor.onSignalReady = (signal: ProcessedSignal) => {
      try {
        const modifiedSignal = processRobustFingerDetection(signal);
        
        setLastSignal(modifiedSignal);
        setError(null);
        setFramesProcessed(prev => prev + 1);
        
        // Actualizar estadísticas
        setSignalStats(prev => {
          return {
            minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
            maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
            avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
            totalValues: prev.totalValues + 1
          };
        });
      } catch (err) {
        console.error("useSignalProcessor: Error procesando señal:", err);
      }
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
      calibrationSystem.cancelCalibration();
    };
  }, [processor, processRobustFingerDetection, calibrationSystem]);

  /**
   * Inicia el procesamiento de señales con calibración automática
   */
  const startProcessing = useCallback(async () => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    // Resetear variables adaptativas
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.45; // Umbral inicial más permisivo
    adaptiveCounterRef.current = 0;
    
    // Iniciar procesador
    processor.start();
    
    // Realizar calibración automática al inicio
    try {
      await startCalibration();
    } catch (err) {
      console.error("useSignalProcessor: Error en calibración inicial:", err);
    }
  }, [processor, startCalibration]);

  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.stop();
    
    if (isCalibrating) {
      calibrationSystem.cancelCalibration();
      setIsCalibrating(false);
    }
  }, [processor, isCalibrating, calibrationSystem]);

  /**
   * Calibra el procesador para mejores resultados
   */
  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración manual");
      
      // Resetear contadores adaptativos
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = 0;
      detectionThresholdRef.current = 0.40; // Umbral más permisivo para calibración
      adaptiveCounterRef.current = 0;
      
      // Iniciar proceso de calibración
      await startCalibration();
      
      console.log("useSignalProcessor: Calibración manual exitosa");
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración manual:", error);
      return false;
    }
  }, [startCalibration]);

  /**
   * Procesa un frame de imagen
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isCalibrating) {
      processCalibrationFrame(imageData);
    } else if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, isCalibrating, processor, processCalibrationFrame]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame,
    isCalibrating,
    calibrationProgress,
    calibrationResult,
    startCalibration
  };
};
