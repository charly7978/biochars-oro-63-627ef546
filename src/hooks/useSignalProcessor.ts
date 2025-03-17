
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Implementa detección robusta, adaptativa y natural con prevención agresiva de falsos positivos.
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
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  // Referencias para historial y estabilización
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 8; // Aumentado para más muestras
  
  // Variables para manejo adaptativo con umbrales mucho más estrictos
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.65); // Umbral inicial muy alto
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 30;
  const MIN_DETECTION_THRESHOLD = 0.55; // Umbral mínimo significativamente aumentado
  
  // Contador para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 6; // Aumentado para requerir más confirmación
  const RELEASE_GRACE_PERIOD = 5; // Aumentado para mayor estabilidad
  
  // Contadores para validación fisiológica
  const consecutiveStableFramesRef = useRef<number>(0);
  const REQUIRED_STABLE_FRAMES = 15; // Requerir muchos frames estables
  const lastSignalValuesRef = useRef<number[]>([]);
  const SIGNAL_HISTORY_SIZE = 20;
  
  // Variables para detección de falsos positivos
  const signalVarianceHistoryRef = useRef<number[]>([]);
  const MIN_ACCEPTABLE_VARIANCE = 0.02; // Señal real debe tener cierta variación
  const MAX_ACCEPTABLE_VARIANCE = 100; // Evitar señales con ruido excesivo

  /**
   * Procesa la detección de dedo con validación extremadamente agresiva
   * para eliminar falsos positivos
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
    
    // Mantener historial de valores de señal para validación fisiológica
    lastSignalValuesRef.current.push(signal.filteredValue);
    if (lastSignalValuesRef.current.length > SIGNAL_HISTORY_SIZE) {
      lastSignalValuesRef.current.shift();
    }
    
    // Calcular varianza de la señal para validación
    if (lastSignalValuesRef.current.length > 10) {
      const variance = calculateVariance(lastSignalValuesRef.current);
      signalVarianceHistoryRef.current.push(variance);
      if (signalVarianceHistoryRef.current.length > 5) {
        signalVarianceHistoryRef.current.shift();
      }
    }
    
    // Verificar si la varianza indica una señal fisiológicamente plausible
    const isVariancePlausible = validateSignalVariance();
    
    // Calcular ratio de detección con mayor exigencia
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calcular calidad ponderada (más peso a valores recientes)
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.2, index); // Ponderación exponencial
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lógica adaptativa para ajustar el umbral
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      const consistentDetection = rawDetectionRatio > 0.9; // Requerir mucha más consistencia
      const consistentNonDetection = rawDetectionRatio < 0.1;
      
      if (consistentNonDetection) {
        // Hacer más fácil la detección pero mantener umbral alto
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.05
        );
      } else if (consistentDetection && avgQuality < 60) { // Umbral de calidad mucho mayor
        // Ser más estrictos con detección pero baja calidad
        detectionThresholdRef.current = Math.min(
          0.85, // Umbral máximo mucho más alto
          detectionThresholdRef.current + 0.05
        );
      }
    }
    
    // Lógica de "lock-in" para estabilidad con requisitos más estrictos
    if (signal.fingerDetected) {
      consecutiveNonDetectionRef.current = 0;
      
      // Incrementar contador de lock solo si la señal cumple validaciones fisiológicas
      if (isVariancePlausible && avgQuality > 50) { // Mayor umbral de calidad
        signalLockCounterRef.current = Math.min(MAX_SIGNAL_LOCK, signalLockCounterRef.current + 1);
        consecutiveStableFramesRef.current++;
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 0.5);
        consecutiveStableFramesRef.current = 0;
      }
    } else {
      if (signalLockCounterRef.current >= MAX_SIGNAL_LOCK) {
        consecutiveNonDetectionRef.current++;
        
        if (consecutiveNonDetectionRef.current > RELEASE_GRACE_PERIOD) {
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
        }
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
      }
      consecutiveStableFramesRef.current = 0;
    }
    
    // Determinación final con criterios extremadamente estrictos
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1 && 
                       consecutiveStableFramesRef.current >= REQUIRED_STABLE_FRAMES &&
                       isVariancePlausible;
                       
    const hasConsistentHighQuality = avgQuality > 70 && rawDetectionRatio > 0.8;
    const currentThreshold = detectionThresholdRef.current;
    
    // Requiere múltiples criterios para confirmar detección de dedo
    const robustFingerDetected = isLockedIn || 
                                (rawDetectionRatio >= currentThreshold && 
                                 hasConsistentHighQuality &&
                                 isVariancePlausible);
    
    // Ajuste de calidad final considerando detección robusta
    const enhancementFactor = robustFingerDetected ? 1.0 : 0.85; // Factor más conservador
    const enhancedQuality = Math.min(100, signal.quality * enhancementFactor);
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality,
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, []);
  
  /**
   * Valida si la varianza de la señal es fisiológicamente plausible
   */
  const validateSignalVariance = useCallback((): boolean => {
    if (signalVarianceHistoryRef.current.length < 3) return false;
    
    // Calcular promedio de varianza
    const avgVariance = signalVarianceHistoryRef.current.reduce((sum, val) => sum + val, 0) / 
                      signalVarianceHistoryRef.current.length;
    
    // Verificar que la varianza sea plausible para una señal fisiológica
    // Demasiado estable = simulación o sensor fijo
    // Demasiado inestable = ruido
    return avgVariance >= MIN_ACCEPTABLE_VARIANCE && avgVariance <= MAX_ACCEPTABLE_VARIANCE;
  }, []);
  
  /**
   * Calcula la varianza de un array de valores
   */
  const calculateVariance = useCallback((values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }, []);

  // Configurar callbacks y limpieza
  useEffect(() => {
    // Callback cuando hay señal lista
    processor.onSignalReady = (signal: ProcessedSignal) => {
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
  }, [processor, processRobustFingerDetection]);

  /**
   * Inicia el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
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
    detectionThresholdRef.current = 0.65; // Umbral inicial más estricto
    adaptiveCounterRef.current = 0;
    consecutiveStableFramesRef.current = 0;
    lastSignalValuesRef.current = [];
    signalVarianceHistoryRef.current = [];
    
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
      detectionThresholdRef.current = 0.60; // Umbral estricto para calibración
      adaptiveCounterRef.current = 0;
      consecutiveStableFramesRef.current = 0;
      lastSignalValuesRef.current = [];
      signalVarianceHistoryRef.current = [];
      
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
