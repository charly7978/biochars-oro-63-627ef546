import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Esta versión mejorada implementa detección robusta y adaptativa.
 */
export const useSignalProcessor = () => {
  // Creamos una única instancia del procesador
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
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
  const HISTORY_SIZE = 8; // Aumentado de 5 a 8 para más estabilidad en la detección
  
  // Nuevas variables para manejo adaptativo
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.65); // Aumentado de 0.6 a 0.65 para reducir falsos positivos
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 50; // Frames entre ajustes adaptativos
  const MIN_DETECTION_THRESHOLD = 0.55; // Aumentado de 0.4 a 0.55 para reducir falsos positivos
  
  // Contador y umbral para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 6; // Número de frames para "asegurar" detección (aumentado para estabilidad)
  const RELEASE_GRACE_PERIOD = 2; // Reducido de 3 a 2 para soltar señal más rápido ante falsos positivos
  
  // Nuevo: análisis de patrón fisiológico
  const physiologicalPatternRef = useRef<number[]>([]);
  const PATTERN_BUFFER_SIZE = 15; // Tamaño para análisis de patrón
  const lastValidPatternTimeRef = useRef<number>(0);
  
  /**
   * Nuevo: Analiza si el patrón de señal parece fisiológico (cardíaco)
   * Busca variaciones periódicas y coherentes típicas del pulso
   */
  const analyzePhysiologicalPattern = useCallback((filteredValue: number): boolean => {
    const now = Date.now();
    
    // Actualizar buffer de patrón
    physiologicalPatternRef.current.push(filteredValue);
    if (physiologicalPatternRef.current.length > PATTERN_BUFFER_SIZE) {
      physiologicalPatternRef.current.shift();
    }
    
    // Requiere suficientes muestras para análisis
    if (physiologicalPatternRef.current.length < PATTERN_BUFFER_SIZE) {
      return false;
    }
    
    // Análisis de patrón cardíaco:
    // 1. Verificar si hay picos y valles (característico de señal PPG)
    const values = physiologicalPatternRef.current;
    const diffs = values.slice(1).map((val, i) => val - values[i]);
    
    let signChanges = 0;
    for (let i = 1; i < diffs.length; i++) {
      if ((diffs[i] >= 0 && diffs[i-1] < 0) || (diffs[i] < 0 && diffs[i-1] >= 0)) {
        signChanges++;
      }
    }
    
    // 2. Mínimo de cambios de dirección en la señal (picos/valles)
    const hasEnoughChanges = signChanges >= 3;
    
    // 3. Analizar varianza: debe ser moderada (ni muy baja ni extrema)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coeffVar = stdDev / Math.abs(mean || 1);
    
    // La señal PPG típica tiene variación moderada
    const hasReasonableVariance = coeffVar > 0.015 && coeffVar < 0.5;
    
    // 4. Verificar consistencia con características fisiológicas (60-180 BPM)
    // Una buena señal PPG tiene estos cambios en frecuencia compatible con ritmo cardíaco
    const isPhysiological = hasEnoughChanges && hasReasonableVariance;
    
    // Registrar timestamp de último patrón válido
    if (isPhysiological) {
      lastValidPatternTimeRef.current = now;
    }
    
    // En caso de duda, mantener la detección por un corto tiempo si hubo un patrón válido reciente
    const patternTimeout = 2000; // 2 segundos
    const hasRecentValidPattern = (now - lastValidPatternTimeRef.current) < patternTimeout;
    
    return isPhysiological || hasRecentValidPattern;
  }, []);
  
  /**
   * Procesa la detección de dedo de manera robusta y adaptativa
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Actualizar historial de calidad y detección
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calcular detección y calidad promedio
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                             Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Cálculo de calidad con ponderación (más peso a valores recientes)
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.5, index); // Ponderación exponencial
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lógica adaptativa para ajustar el umbral de detección
    adaptiveCounterRef.current++;
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      // Si estamos consistentemente detectando o no detectando, ajustar umbral
      const consistentDetection = rawDetectionRatio > 0.8;
      const consistentNonDetection = rawDetectionRatio < 0.2;
      
      if (consistentNonDetection) {
        // Hacer más fácil la detección si hay problemas persistentes
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.05
        );
        console.log("Ajustando umbral de detección hacia abajo:", detectionThresholdRef.current);
      } else if (consistentDetection && avgQuality < 40) {
        // Si detectamos consistentemente pero la calidad es mala, ser más estrictos
        detectionThresholdRef.current = Math.min(
          0.75,
          detectionThresholdRef.current + 0.03
        );
        console.log("Ajustando umbral de detección hacia arriba:", detectionThresholdRef.current);
      }
    }
    
    // Nuevo: Verificar si el patrón parece fisiológico (reduce falsos positivos)
    const hasPhysiologicalPattern = analyzePhysiologicalPattern(signal.filteredValue);
    
    // Lógica de "lock-in" para evitar pérdidas rápidas de señal
    if (signal.fingerDetected && hasPhysiologicalPattern) {
      consecutiveNonDetectionRef.current = 0;
      
      // Incrementar contador de bloqueo hasta el máximo
      signalLockCounterRef.current = Math.min(
        MAX_SIGNAL_LOCK,
        signalLockCounterRef.current + 1
      );
    } else {
      // Reducir el contador de bloqueo pero mantener un período de gracia
      if (signalLockCounterRef.current >= MAX_SIGNAL_LOCK) {
        // Solo empezar a reducir después de llegar al máximo bloqueo
        consecutiveNonDetectionRef.current++;
        
        if (consecutiveNonDetectionRef.current > RELEASE_GRACE_PERIOD) {
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
        }
      } else {
        signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
      }
    }
    
    // Determinación final de detección
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 1;
    const currentThreshold = detectionThresholdRef.current;
    
    // Nueva condición más estricta: combinar detección básica con validación de patrón fisiológico
    const robustFingerDetected = (isLockedIn || rawDetectionRatio >= currentThreshold) && 
                               (hasPhysiologicalPattern || isLockedIn);
    
    // Ligera mejora de calidad (máximo 10%) para experiencia de usuario más suave
    const enhancementFactor = robustFingerDetected ? 1.1 : 1.0;
    const enhancedQuality = Math.min(100, avgQuality * enhancementFactor);
    
    // Devolver señal modificada
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality,
      // Mantenemos la información de perfusión y espectro intacta
      perfusionIndex: signal.perfusionIndex,
      spectrumData: signal.spectrumData
    };
  }, [analyzePhysiologicalPattern]);

  // Configurar callbacks y limpieza
  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
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
      console.error("useSignalProcessor: Error detallado:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      setError(error);
    };

    // Inicializar procesador
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización detallado:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
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
    console.log("useSignalProcessor: Iniciando procesamiento", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString()
    });
    
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
    consecutiveNonDetectionRef.current = 0;
    signalLockCounterRef.current = 0;
    detectionThresholdRef.current = 0.65; // Umbral inicial más estricto
    adaptiveCounterRef.current = 0;
    physiologicalPatternRef.current = []; // Inicializar buffer de patrón
    lastValidPatternTimeRef.current = 0;
    
    processor.start();
  }, [processor, isProcessing]);

  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processor.stop();
  }, [processor, isProcessing, framesProcessed]);

  /**
   * Calibra el procesador para mejores resultados
   */
  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración", {
        timestamp: new Date().toISOString()
      });
      
      // Resetear contadores adaptativos durante calibración
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      consecutiveNonDetectionRef.current = 0;
      signalLockCounterRef.current = 0;
      detectionThresholdRef.current = 0.5; // Umbral inicial más permisivo durante calibración
      adaptiveCounterRef.current = 0;
      
      await processor.calibrate();
      
      console.log("useSignalProcessor: Calibración exitosa", {
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración detallado:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
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
        setFramesProcessed(prev => prev + 1);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  // Devolver la misma interfaz pública que antes
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
