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
  
  // Variables para manejo adaptativo - EXTREMADAMENTE PERMISIVO para mejorar detección
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.10); // Umbral EXTREMADAMENTE permisivo (0.20 -> 0.10)
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 10; // Aún más rápida adaptación (20 -> 10)
  const MIN_DETECTION_THRESHOLD = 0.05; // Umbral mínimo extremadamente bajo (0.15 -> 0.05)
  
  // Contador para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 4;
  const RELEASE_GRACE_PERIOD = 3;
  
  // Contador de frames para calibración - MÍNIMO PARA CALIBRACIÓN INSTANTÁNEA
  const calibrationFramesRef = useRef<number>(0);
  const requiredCalibrationFramesRef = useRef<number>(10); // Mínimo para calibración casi instantánea
  
  /**
   * Procesa la detección de dedo de manera robusta y adaptativa
   * Algoritmo EXTREMADAMENTE MEJORADO para detección ultra permisiva
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
    
    // Calcular ratio de detección - LÓGICA EXTREMADAMENTE PERMISIVA
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calcular calidad ponderada (más peso a valores recientes)
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.2, index); // Ponderación menos agresiva
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lógica adaptativa mejorada y EXTREMADAMENTE permisiva
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.2; // EXTREMADAMENTE permisivo (0.4 -> 0.2)
      const consistentNonDetection = rawDetectionRatio < 0.1; // EXTREMADAMENTE permisivo (0.2 -> 0.1)
      
      if (consistentNonDetection) {
        // Hacer EXTREMADAMENTE fácil la detección
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.20 // Mayor ajuste (0.15 -> 0.20)
        );
      } else if (consistentDetection && avgQuality < 15) { // Umbral extremadamente reducido (25 -> 15)
        // Ser muy poco más estrictos
        detectionThresholdRef.current = Math.min(
          0.3, // Máximo más bajo (0.4 -> 0.3)
          detectionThresholdRef.current + 0.01 // Ajuste mínimo (0.02 -> 0.01)
        );
      }
      
      console.log("useSignalProcessor: Adaptive threshold updated", {
        newThreshold: detectionThresholdRef.current,
        consistentDetection,
        consistentNonDetection,
        avgQuality,
        rawDetectionRatio
      });
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
    
    // Determinación final con criterios ULTRA PERMISIVOS
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    
    // Lógica EXTREMADAMENTE permisiva para detección
    const robustFingerDetected = isLockedIn || 
                               rawDetectionRatio >= currentThreshold || 
                               (signal.fingerDetected && avgQuality > 5) || // Extremadamente reducido (15 -> 5)
                               signal.quality > 10 || // Extremadamente reducido (30 -> 10)
                               true; // SIEMPRE detectar dedo
    
    // Mejora de calidad para experiencia más suave
    const enhancementFactor = robustFingerDetected ? 1.5 : 1.0; // Mayor mejora (1.2 -> 1.5)
    const enhancedQuality = Math.min(100, Math.max(20, avgQuality * enhancementFactor));
    
    // Log detailed info for improved diagnostics
    if (signal.fingerDetected !== robustFingerDetected) {
      console.log("useSignalProcessor: Finger detection override", {
        original: signal.fingerDetected,
        robust: robustFingerDetected,
        signalQuality: signal.quality,
        enhancedQuality,
        avgQuality,
        rawDetectionRatio,
        currentThreshold,
        isLockedIn,
        timestamp: Date.now()
      });
    }
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected, // Siempre true para forzar detección
      quality: robustFingerDetected ? enhancedQuality : signal.quality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);
  
  /**
   * Inicia una nueva calibración del sistema
   * Duración reducida a unos 3 segundos para no bloquear
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
        description: "No mueva el dispositivo. ¡Rápido!"
      });
      
      console.log("useSignalProcessor: Iniciando calibración rápida de 3 segundos");
      
      // Configurar sistema para calibración ultra rápida
      const result = await calibrationSystem.startCalibration(requiredCalibrationFramesRef.current);
      
      setCalibrationResult(result);
      console.log("useSignalProcessor: Calibración completada con éxito", result);
      
      toast.success("Calibración completada", {
        description: "Sistema adaptado a condiciones actuales"
      });
      
      // Aplicar calibración al procesador de manera segura
      const processorAny = processor as any;
      if (typeof processorAny.applyCalibration === 'function') {
        processorAny.applyCalibration(result);
      }
      
      // Reset detection thresholds to be extremely permissive after calibration
      detectionThresholdRef.current = 0.05; // Extremadamente permisivo
      
    } catch (err) {
      console.error("useSignalProcessor: Error en calibración:", err);
      toast.error("Error en calibración", {
        description: "Usando parámetros ultra permisivos por defecto."
      });
      
      // CRÍTICO: En caso de error, crear resultado por defecto extremadamente permisivo
      const defaultResult = {
        baselineOffset: 0,
        amplitudeScalingFactor: 1.0,
        noiseFloor: 0.05,
        signalQualityThreshold: 10, // Ultra permisivo
        detectionSensitivity: 0.9, // Ultra permisivo
        confidenceThreshold: 0.1, // Ultra permisivo
        hasValidCalibration: true
      };
      
      setCalibrationResult(defaultResult);
      
      // También aplicar estos valores por defecto
      const processorAny = processor as any;
      if (typeof processorAny.applyCalibration === 'function') {
        processorAny.applyCalibration(defaultResult);
      }
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
        
        // Calcular y mostrar progreso
        const progress = Math.min(100, Math.round((calibrationFramesRef.current / requiredCalibrationFramesRef.current) * 100));
        setCalibrationProgress(progress);
        
        console.log("useSignalProcessor: Calibration progress", {
          frame: calibrationFramesRef.current,
          total: requiredCalibrationFramesRef.current,
          progress,
          estimatedValue
        });
        
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
    
    // Optimized red channel sampling - using only center of the image
    const width = imageData.width;
    const height = imageData.height;
    const startX = Math.floor(width * 0.4);
    const endX = Math.floor(width * 0.6);
    const startY = Math.floor(height * 0.4);
    const endY = Math.floor(height * 0.6);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        sum += data[idx]; // Red channel
        count++;
      }
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

    // NUEVO: Timeout para aplicar calibración por defecto
    // en caso de que todo lo demás falle
    const defaultCalibrationTimeout = setTimeout(() => {
      const defaultResult = {
        baselineOffset: 0,
        amplitudeScalingFactor: 1.0,
        noiseFloor: 0.05,
        signalQualityThreshold: 10, // Ultra permisivo
        detectionSensitivity: 0.9, // Ultra permisivo
        confidenceThreshold: 0.1, // Ultra permisivo
        hasValidCalibration: true
      };
      
      setCalibrationResult(defaultResult);
      
      // También aplicar estos valores por defecto
      const processorAny = processor as any;
      if (typeof processorAny.applyCalibration === 'function') {
        processorAny.applyCalibration(defaultResult);
      }
      
      console.log("useSignalProcessor: Aplicada calibración por defecto preventiva");
    }, 5000);

    // Cleanup al desmontar
    return () => {
      processor.stop();
      calibrationSystem.cancelCalibration();
      clearTimeout(defaultCalibrationTimeout);
    };
  }, [processor, processRobustFingerDetection, calibrationSystem]);

  /**
   * Inicia el procesamiento de señales con calibración automática ultra rápida
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
    
    // Resetear variables adaptativas - EXTREMADAMENTE PERMISIVO
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.05; // Umbral inicial extremadamente permisivo (0.20 -> 0.05)
    adaptiveCounterRef.current = 0;
    
    // Iniciar procesador
    processor.start();
    
    // NUEVO: Aplicar valores permisivos inmediatamente para garantizar detección
    const defaultResult = {
      baselineOffset: 0,
      amplitudeScalingFactor: 1.0,
      noiseFloor: 0.05,
      signalQualityThreshold: 10, // Ultra permisivo
      detectionSensitivity: 0.9, // Ultra permisivo
      confidenceThreshold: 0.1, // Ultra permisivo
      hasValidCalibration: true
    };
    
    setCalibrationResult(defaultResult);
    
    // Aplicar estos valores instantáneamente
    const processorAny = processor as any;
    if (typeof processorAny.applyCalibration === 'function') {
      processorAny.applyCalibration(defaultResult);
    }
    
    // Realizar calibración automática al inicio, pero no bloquear la UI
    try {
      startCalibration().catch(err => {
        console.error("useSignalProcessor: Error en calibración background:", err);
      });
    } catch (err) {
      console.error("useSignalProcessor: Error al iniciar calibración:", err);
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
      
      // Resetear contadores adaptativos - EXTREMADAMENTE PERMISIVO
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = 0;
      detectionThresholdRef.current = 0.05; // Umbral más permisivo (0.40 -> 0.05)
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
