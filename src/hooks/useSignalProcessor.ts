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
  const HISTORY_SIZE = 12; // Aumentado para mayor estabilidad
  
  // Nuevas variables para manejo adaptativo con mayor estabilidad
  const consecutiveNonDetectionRef = useRef<number>(0);
  const detectionThresholdRef = useRef<number>(0.60); // Umbral inicial más estricto
  const adaptiveCounterRef = useRef<number>(0);
  const ADAPTIVE_ADJUSTMENT_INTERVAL = 40; // Reducido para adaptación más rápida
  const MIN_DETECTION_THRESHOLD = 0.40; // Más permisivo para recuperar señal perdida
  
  // Umbral mejorado para evitar pérdidas rápidas de señal
  const signalLockCounterRef = useRef<number>(0);
  const MAX_SIGNAL_LOCK = 10; // Aumentado para mayor resistencia a fluctuaciones
  const RELEASE_GRACE_PERIOD = 8; // Aumentado para mantener detección
  
  // Nuevas variables para estabilizar la señal
  const stabilityCounterRef = useRef<number>(0);
  const STABILITY_THRESHOLD = 5; // Mínimo de frames estables para confirmar detección
  const lastDetectionTimeRef = useRef<number>(0);
  const DETECTION_COOLDOWN_MS = 2000; // Tiempo de espera para cambiar estado de detección
  
  // Análisis de patrón fisiológico mejorado
  const physiologicalPatternRef = useRef<number[]>([]);
  const PATTERN_BUFFER_SIZE = 20; // Aumentado para análisis más robusto
  const lastValidPatternTimeRef = useRef<number>(0);
  
  // Nueva referencia para mantener estabilidad en la detección
  const stableDetectionRef = useRef<boolean>(false);
  
  /**
   * Analiza si el patrón de señal parece fisiológico (cardíaco)
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
    if (physiologicalPatternRef.current.length < PATTERN_BUFFER_SIZE * 0.7) {
      return false;
    }
    
    // Análisis de patrón cardíaco más robusto:
    const values = physiologicalPatternRef.current;
    const diffs = values.slice(1).map((val, i) => val - values[i]);
    
    let signChanges = 0;
    for (let i = 1; i < diffs.length; i++) {
      if ((diffs[i] >= 0 && diffs[i-1] < 0) || (diffs[i] < 0 && diffs[i-1] >= 0)) {
        signChanges++;
      }
    }
    
    // Mínimo de cambios de dirección en la señal (picos/valles)
    const hasEnoughChanges = signChanges >= 4; // Incrementado para mejor validación
    
    // Analizar varianza para identificar patrones cardíacos
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coeffVar = stdDev / Math.abs(mean || 1);
    
    // La señal PPG típica tiene variación moderada
    const hasReasonableVariance = coeffVar > 0.01 && coeffVar < 0.5;
    
    // Verificar consistencia con características fisiológicas
    const isPhysiological = hasEnoughChanges && hasReasonableVariance;
    
    // Registrar timestamp de último patrón válido
    if (isPhysiological) {
      lastValidPatternTimeRef.current = now;
    }
    
    // Patrón válido reciente cuenta como válido
    const patternTimeout = 3000; // Extendido para mayor estabilidad
    const hasRecentValidPattern = (now - lastValidPatternTimeRef.current) < patternTimeout;
    
    return isPhysiological || hasRecentValidPattern;
  }, []);
  
  /**
   * Procesa la detección de dedo de manera robusta y adaptativa
   * con mayor estabilidad
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    const now = Date.now();
    
    // Actualizar historial de calidad y detección
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calcular detección y calidad promedio con ponderación
    const rawDetectionRatio = fingerDetectedHistoryRef.current.filter(d => d).length / 
                              Math.max(1, fingerDetectedHistoryRef.current.length);
    
    // Calcular calidad media ponderada (más peso a valores recientes)
    let weightedQualitySum = 0;
    let weightSum = 0;
    
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.3, index); // Ponderación exponencial
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lógica adaptativa para ajustar el umbral de detección
    adaptiveCounterRef.current++;
    
    if (adaptiveCounterRef.current >= ADAPTIVE_ADJUSTMENT_INTERVAL) {
      adaptiveCounterRef.current = 0;
      
      // Ajustar umbral basado en detección consistente
      const consistentDetection = rawDetectionRatio > 0.85; // Más estricto
      const consistentNonDetection = rawDetectionRatio < 0.15; // Más estricto
      
      if (consistentNonDetection) {
        // Hacer más fácil la detección
        detectionThresholdRef.current = Math.max(
          MIN_DETECTION_THRESHOLD,
          detectionThresholdRef.current - 0.05
        );
        console.log("Ajustando umbral de detección hacia abajo:", detectionThresholdRef.current);
      } else if (consistentDetection && avgQuality < 30) {
        // Si detectamos consistentemente pero calidad baja, ser más estrictos
        detectionThresholdRef.current = Math.min(
          0.8,
          detectionThresholdRef.current + 0.03
        );
        console.log("Ajustando umbral de detección hacia arriba:", detectionThresholdRef.current);
      }
    }
    
    // Verificar patrón fisiológico
    const hasPhysiologicalPattern = analyzePhysiologicalPattern(signal.filteredValue);
    
    // Lógica de estabilidad mejorada para evitar fluctuaciones rápidas
    if (signal.fingerDetected && hasPhysiologicalPattern) {
      consecutiveNonDetectionRef.current = 0;
      
      // Incrementar contador de bloqueo hasta el máximo
      signalLockCounterRef.current = Math.min(
        MAX_SIGNAL_LOCK,
        signalLockCounterRef.current + 1
      );
      
      // Incrementar contador de estabilidad
      stabilityCounterRef.current = Math.min(
        STABILITY_THRESHOLD + 5, // Permitir superar el umbral
        stabilityCounterRef.current + 1
      );
    } else {
      // Nueva lógica de enfriamiento para estabilidad
      const timeSinceLastDetection = now - lastDetectionTimeRef.current;
      
      if (stableDetectionRef.current && timeSinceLastDetection < DETECTION_COOLDOWN_MS) {
        // Si estamos en estado estable y aún no ha pasado el tiempo de enfriamiento,
        // mantener la detección a pesar de la señal débil
        signalLockCounterRef.current = Math.max(MAX_SIGNAL_LOCK / 2, signalLockCounterRef.current);
      } else {
        // Reducir contadores de forma paulatina
        if (signalLockCounterRef.current >= MAX_SIGNAL_LOCK) {
          // Solo empezar a reducir después de alcanzar máximo bloqueo
          consecutiveNonDetectionRef.current++;
          
          if (consecutiveNonDetectionRef.current > RELEASE_GRACE_PERIOD) {
            signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
            // Reducir contador de estabilidad de forma más lenta
            stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 0.5);
          }
        } else {
          // Reducción normal
          signalLockCounterRef.current = Math.max(0, signalLockCounterRef.current - 1);
          stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 0.5);
        }
      }
    }
    
    // Determinación final de detección con mayor estabilidad
    const isLockedIn = signalLockCounterRef.current >= MAX_SIGNAL_LOCK - 2;
    const currentThreshold = detectionThresholdRef.current;
    const isStable = stabilityCounterRef.current >= STABILITY_THRESHOLD;
    
    let finalDetection;
    
    // Si ya tenemos detección estable, ser más permisivos para mantenerla
    if (stableDetectionRef.current) {
      finalDetection = isLockedIn || rawDetectionRatio >= (currentThreshold - 0.1) || isStable;
    } else {
      // Si no tenemos detección estable, ser más estrictos para iniciarla
      finalDetection = (isLockedIn || rawDetectionRatio >= currentThreshold) && 
                       (hasPhysiologicalPattern || isLockedIn);
    }
    
    // Actualizar estado de detección estable
    if (finalDetection && !stableDetectionRef.current) {
      if (isStable) {
        stableDetectionRef.current = true;
        lastDetectionTimeRef.current = now;
        console.log("Detección de dedo estable activada");
      }
    } else if (!finalDetection && stableDetectionRef.current) {
      // Solo cambiar a no detección después del tiempo de enfriamiento
      const timeSinceLastStable = now - lastDetectionTimeRef.current;
      if (timeSinceLastStable > DETECTION_COOLDOWN_MS && stabilityCounterRef.current < 1) {
        stableDetectionRef.current = false;
        console.log("Detección de dedo estable desactivada");
      } else if (timeSinceLastStable <= DETECTION_COOLDOWN_MS) {
        // Mantener detección durante enfriamiento
        finalDetection = true; 
      }
    }
    
    // Actualizar timestamp si hay detección
    if (finalDetection) {
      lastDetectionTimeRef.current = now;
    }
    
    // Mejora de calidad para suavizar cambios
    const enhancementFactor = finalDetection ? 1.15 : 1.0;
    const enhancedQuality = Math.min(100, avgQuality * enhancementFactor);
    
    // Devolver señal modificada
    return {
      ...signal,
      fingerDetected: finalDetection,
      quality: enhancedQuality,
      // Mantener información intacta
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
