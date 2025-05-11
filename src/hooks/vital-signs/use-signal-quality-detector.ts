
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Configuración avanzada para detección de dedos
 * Todos los umbrales están optimizados para máxima sensibilidad manteniendo robustez
 */
interface AdvancedDetectionConfig {
  // Umbrales básicos
  weakSignalThreshold: number;
  maxConsecutiveWeakSignals: number;
  
  // Detección de patrones rítmicos
  patternDetectionWindowMs: number;
  minPeaksForRhythm: number;
  peakDetectionThreshold: number;
  requiredConsistentPatterns: number;
  minSignalVariance: number;
  
  // Intervalos fisiológicos
  minHeartRateIntervalMs: number; // 200 BPM
  maxHeartRateIntervalMs: number; // 30 BPM
  maxRhythmDeviation: number;
  
  // Confirmación y estabilidad
  consistencyRequirement: number; // % de intervalos que deben ser consistentes
  fastRecoveryFactor: number; // Factor para recuperación rápida
  
  // Ajustes de nivel avanzado
  adaptiveThresholding: boolean;
  spectralAnalysisEnabled: boolean;
  useKalmanFiltering: boolean;
}

/**
 * Hook mejorado para detección de dedos basado en patrones rítmicos fisiológicos
 * Utiliza múltiples algoritmos y técnicas avanzadas para detección robusta
 */
export const useSignalQualityDetector = () => {
  // Configuración optimizada para máxima sensibilidad
  const config = useRef<AdvancedDetectionConfig>({
    weakSignalThreshold: 0.15, // Reducido para mayor sensibilidad
    maxConsecutiveWeakSignals: 4, // Reducido para detección más rápida
    
    patternDetectionWindowMs: 2500, // Ventana más corta (2.5s)
    minPeaksForRhythm: 3, // Reducido para detectar más rápido
    peakDetectionThreshold: 0.15, // Más sensible
    requiredConsistentPatterns: 2, // Reducido para confirmación más rápida
    minSignalVariance: 0.02, // Reducido para mayor sensibilidad
    
    minHeartRateIntervalMs: 300, // ~200 BPM (latidos por minuto)
    maxHeartRateIntervalMs: 2000, // ~30 BPM
    maxRhythmDeviation: 200, // ms de desviación máxima entre intervalos
    
    consistencyRequirement: 0.6, // 60% de intervalos consistentes
    fastRecoveryFactor: 2, // Recuperación rápida
    
    adaptiveThresholding: true,
    spectralAnalysisEnabled: false, // Desactivado hasta implementar análisis espectral
    useKalmanFiltering: false, // Desactivado hasta implementar filtrado Kalman
  });
  
  // Referencias para estado
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const signalHistoryRef = useRef<Array<{time: number, value: number}>>([]);
  const lastPeakTimesRef = useRef<number[]>([]);
  const detectedRhythmicPatternsRef = useRef<number>(0);
  const fingerDetectionConfirmedRef = useRef<boolean>(false);
  
  // Estado para umbral adaptativo
  const adaptiveThresholdRef = useRef<number>(config.current.peakDetectionThreshold);
  
  // Monitorización de estado interno para debugging
  const [internalState, setInternalState] = useState({
    weakSignalCount: 0,
    patternCount: 0,
    fingerDetected: false,
    lastPeakTime: 0,
    signalQuality: 0
  });
  
  // Actualizar estado interno para debugging (solo cuando cambia)
  useEffect(() => {
    const interval = setInterval(() => {
      const newState = {
        weakSignalCount: consecutiveWeakSignalsRef.current,
        patternCount: detectedRhythmicPatternsRef.current,
        fingerDetected: fingerDetectionConfirmedRef.current,
        lastPeakTime: lastPeakTimesRef.current.length > 0 ? lastPeakTimesRef.current[lastPeakTimesRef.current.length - 1] : 0,
        signalQuality: calculateSignalQuality()
      };
      
      // Solo actualizar cuando hay cambios significativos
      if (newState.patternCount !== internalState.patternCount || 
          newState.fingerDetected !== internalState.fingerDetected ||
          Math.abs(newState.weakSignalCount - internalState.weakSignalCount) > 2) {
        setInternalState(newState);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [internalState]);
  
  /**
   * Calcula calidad de señal basada en patrones detectados y consistencia
   */
  const calculateSignalQuality = useCallback((): number => {
    if (!fingerDetectionConfirmedRef.current) return 0;
    
    const patternQuality = Math.min(100, detectedRhythmicPatternsRef.current * 20);
    const weakSignalPenalty = Math.min(50, consecutiveWeakSignalsRef.current * 10);
    
    return Math.max(0, patternQuality - weakSignalPenalty);
  }, []);
  
  /**
   * Detecta picos en el historial de señal con umbral adaptativo
   * Utiliza análisis de morfología de picos para mayor precisión
   */
  const detectPeaks = useCallback(() => {
    const now = Date.now();
    const recentSignals = signalHistoryRef.current
      .filter(point => now - point.time < config.current.patternDetectionWindowMs);
    
    if (recentSignals.length < 10) return false;
    
    // Verificar varianza mínima (rechazar señales casi constantes)
    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance < config.current.minSignalVariance) {
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      return false;
    }
    
    // Detectar picos con umbral adaptativo si está activado
    const peaks: number[] = [];
    const threshold = config.current.adaptiveThresholding
      ? calculateAdaptiveThreshold(values)
      : config.current.peakDetectionThreshold;
    
    // Almacenar umbral para uso futuro
    adaptiveThresholdRef.current = threshold;
    
    // Algoritmo mejorado de detección de picos (busca cruce ascendente/descendente)
    let rising = false;
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev = recentSignals[i - 1];
      const next = recentSignals[i + 1];
      
      // Detectar cambio de dirección ascendente a descendente
      if (!rising && current.value > prev.value) {
        rising = true;
      } else if (rising && current.value > next.value) {
        // Potencial pico si es significativamente mayor que el umbral
        if (Math.abs(current.value) > threshold) {
          peaks.push(current.time);
          rising = false;
        }
      }
    }
    
    // Verificar si tenemos suficientes picos
    if (peaks.length >= config.current.minPeaksForRhythm) {
      // Calcular intervalos entre picos
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      
      // Verificar intervalos fisiológicos plausibles
      const validIntervals = intervals.filter(interval => 
        interval >= config.current.minHeartRateIntervalMs && 
        interval <= config.current.maxHeartRateIntervalMs
      );
      
      if (validIntervals.length < Math.floor(intervals.length * config.current.consistencyRequirement)) {
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
        return false;
      }
      
      // Verificar consistencia en intervalos (ritmo)
      let consistentIntervals = 0;
      
      for (let i = 1; i < validIntervals.length; i++) {
        if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < config.current.maxRhythmDeviation) {
          consistentIntervals++;
        }
      }
      
      // Si tenemos intervalos consistentes, incrementar contador
      if (consistentIntervals >= config.current.minPeaksForRhythm - 1) {
        lastPeakTimesRef.current = peaks;
        detectedRhythmicPatternsRef.current++;
        
        // Si hemos detectado suficientes patrones, confirmar detección
        if (detectedRhythmicPatternsRef.current >= config.current.requiredConsistentPatterns) {
          fingerDetectionConfirmedRef.current = true;
          return true;
        }
      } else {
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      }
    } else {
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
    }
    
    return fingerDetectionConfirmedRef.current;
  }, []);
  
  /**
   * Calcula umbral adaptativo basado en estadísticas de la señal
   */
  const calculateAdaptiveThreshold = (values: number[]): number => {
    // Ordenar valores para cálculos estadísticos
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Obtener percentiles para estimación robusta
    const q25Index = Math.floor(sortedValues.length * 0.25);
    const q75Index = Math.floor(sortedValues.length * 0.75);
    const q25 = sortedValues[q25Index];
    const q75 = sortedValues[q75Index];
    
    // Rango intercuartil para estimar variabilidad
    const iqr = q75 - q25;
    
    // Calcular umbral basado en estadística robusta
    // Al menos un mínimo absoluto para evitar umbrales demasiado bajos
    const baseThreshold = q25 + (iqr * 0.7); // Más sensible (0.7 en vez de 1.5 estándar)
    
    return Math.max(config.current.peakDetectionThreshold * 0.7, baseThreshold);
  };
  
  /**
   * Función mejorada de detección con reconocimiento de patrones fisiológicos
   */
  const detectWeakSignal = (value: number): boolean => {
    const now = Date.now();
    
    // Agregar valor actual al historial
    signalHistoryRef.current.push({ time: now, value });
    
    // Mantener solo señales recientes
    signalHistoryRef.current = signalHistoryRef.current.filter(
      point => now - point.time < config.current.patternDetectionWindowMs * 2
    );
    
    // Si la detección de dedos ya está confirmada, usar detección de señal débil estándar
    if (fingerDetectionConfirmedRef.current) {
      if (Math.abs(value) < config.current.weakSignalThreshold) {
        consecutiveWeakSignalsRef.current++;
      } else {
        // Recuperación más rápida de falsos positivos
        consecutiveWeakSignalsRef.current = Math.max(0, 
          consecutiveWeakSignalsRef.current - config.current.fastRecoveryFactor);
      }
      
      // Verificar si se perdió la detección
      if (consecutiveWeakSignalsRef.current > config.current.maxConsecutiveWeakSignals * 2) {
        fingerDetectionConfirmedRef.current = false;
        detectedRhythmicPatternsRef.current = 0;
      }
      
      return consecutiveWeakSignalsRef.current >= config.current.maxConsecutiveWeakSignals;
    } 
    // De lo contrario, intentar detectar dedos mediante patrones rítmicos
    else {
      if (Math.abs(value) < config.current.weakSignalThreshold) {
        consecutiveWeakSignalsRef.current++;
      } else {
        consecutiveWeakSignalsRef.current = Math.max(0, 
          consecutiveWeakSignalsRef.current - config.current.fastRecoveryFactor);
      }
      
      // Intentar detectar patrones rítmicos
      const hasRhythmicPattern = detectPeaks();
      
      // Si detectamos un ritmo, podemos considerar la señal como fuerte
      if (hasRhythmicPattern) {
        consecutiveWeakSignalsRef.current = 0;
        return false;
      }
      
      return consecutiveWeakSignalsRef.current >= config.current.maxConsecutiveWeakSignals;
    }
  };
  
  /**
   * Verificar si se detecta dedo basado en patrones rítmicos
   */
  const isFingerDetected = useCallback((): boolean => {
    // Si ya hemos confirmado la detección de dedos, mantenerla a menos que
    // tengamos demasiadas señales débiles
    if (fingerDetectionConfirmedRef.current) {
      return consecutiveWeakSignalsRef.current < config.current.maxConsecutiveWeakSignals * 2;
    }
    
    // De lo contrario, verificar si hemos detectado suficientes patrones rítmicos
    return detectedRhythmicPatternsRef.current >= config.current.requiredConsistentPatterns;
  }, []);
  
  /**
   * Restablecer el detector de calidad de señal
   */
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
    signalHistoryRef.current = [];
    lastPeakTimesRef.current = [];
    detectedRhythmicPatternsRef.current = 0;
    fingerDetectionConfirmedRef.current = false;
    adaptiveThresholdRef.current = config.current.peakDetectionThreshold;
  };
  
  /**
   * Actualiza configuración en tiempo real
   */
  const updateConfig = (newConfig: Partial<AdvancedDetectionConfig>) => {
    config.current = { ...config.current, ...newConfig };
  };
  
  /**
   * Obtener diagnósticos internos
   */
  const getDiagnostics = () => {
    return {
      weakSignalCount: consecutiveWeakSignalsRef.current,
      patternCount: detectedRhythmicPatternsRef.current,
      fingerDetected: fingerDetectionConfirmedRef.current,
      peakTimes: lastPeakTimesRef.current,
      signalHistory: signalHistoryRef.current.slice(-20), // Últimos 20 puntos
      config: { ...config.current },
      adaptiveThreshold: adaptiveThresholdRef.current,
      signalQuality: calculateSignalQuality()
    };
  };
  
  return {
    detectWeakSignal,
    isFingerDetected,
    reset,
    updateConfig,
    getDiagnostics,
    consecutiveWeakSignalsRef,
    detectedRhythmicPatternsRef,
    fingerDetectionConfirmedRef,
    signalQuality: calculateSignalQuality()
  };
};
