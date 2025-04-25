
import { useState, useCallback, useRef, useEffect } from 'react';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import { useSignalQualityDetector } from './vital-signs/use-signal-quality-detector';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  rrData?: {
    intervals: number[];
    averageInterval: number;
  };
}

/**
 * Hook para procesar los latidos cardíacos
 * Solo procesa datos reales, sin simulación
 */
export function useHeartBeatProcessor() {
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isArrhythmia, setIsArrhythmia] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(0);
  
  const lastPeakTimeRef = useRef<number | null>(null);
  const rrIntervalsRef = useRef<number[]>([]);
  const lastValidBpmRef = useRef<number>(0);
  const valuesBufferRef = useRef<number[]>([]);
  const lastFilteredValueRef = useRef<number | null>(null);
  const thresholdRef = useRef<number>(0.2);
  const baselineRef = useRef<number>(0);
  const lastDerivativeRef = useRef<number>(0);
  const peakConfirmationBufferRef = useRef<number[]>([]);
  const lastConfirmedPeakRef = useRef<boolean>(false);
  
  const { reset: resetSignalQuality } = useSignalQualityDetector();

  // Config para detección de picos
  const peakDetectionConfig = {
    minPeakTimeMs: 350,  // Mínimo tiempo entre picos (frecuencia cardiaca máxima ~170 BPM)
    derivativeThreshold: -0.01, // Umbral para detectar pico en la derivada
    signalThreshold: 0.15, // Umbral mínimo de señal normalizada para considerar un pico
    minConfidence: 0.3, // Confianza mínima para confirmar un pico
    smoothingFactor: 0.3, // Factor de suavizado
  };

  // Initialize ArrhythmiaDetectionService
  useEffect(() => {
    if (isProcessing) {
      ArrhythmiaDetectionService.startMonitoring();
    } else {
      ArrhythmiaDetectionService.stopMonitoring();
    }

    return () => {
      ArrhythmiaDetectionService.stopMonitoring();
    };
  }, [isProcessing]);

  /**
   * Detecta un pico en la señal
   */
  const detectPeak = useCallback((
    normalizedValue: number,
    derivative: number,
    currentTime: number
  ): { isPeak: boolean, confidence: number } => {
    // Verificar tiempo mínimo entre picos
    if (lastPeakTimeRef.current !== null) {
      const timeSinceLastPeak = currentTime - lastPeakTimeRef.current;
      if (timeSinceLastPeak < peakDetectionConfig.minPeakTimeMs) {
        return { isPeak: false, confidence: 0 };
      }
    }

    // Lógica de detección de pico - sin usar Math.min/Math.max/Math.abs
    const isPeak =
      derivative < peakDetectionConfig.derivativeThreshold &&
      normalizedValue > peakDetectionConfig.signalThreshold &&
      lastFilteredValueRef.current !== null && 
      lastFilteredValueRef.current > baselineRef.current * 0.98;

    // Calcular confianza basada en características de la señal
    let amplitudeConfidence = (normalizedValue / (peakDetectionConfig.signalThreshold * 1.8));
    if (amplitudeConfidence > 1) amplitudeConfidence = 1;
    if (amplitudeConfidence < 0) amplitudeConfidence = 0;
    
    let derivativeConfidence = ((derivative < 0 ? -derivative : derivative) / 
      (peakDetectionConfig.derivativeThreshold < 0 ? -peakDetectionConfig.derivativeThreshold : 
      peakDetectionConfig.derivativeThreshold) * 0.8);
    if (derivativeConfidence > 1) derivativeConfidence = 1;
    if (derivativeConfidence < 0) derivativeConfidence = 0;

    // Confianza combinada
    const combinedConfidence = (amplitudeConfidence + derivativeConfidence) / 2;

    return { isPeak, confidence: combinedConfidence };
  }, []);

  /**
   * Confirma un pico examinando muestras vecinas
   */
  const confirmPeak = useCallback((
    isPeak: boolean,
    normalizedValue: number
  ): boolean => {
    // Añadir valor al buffer de confirmación
    peakConfirmationBufferRef.current.push(normalizedValue);
    if (peakConfirmationBufferRef.current.length > 5) {
      peakConfirmationBufferRef.current.shift();
    }

    let isConfirmedPeak = false;

    // Solo proceder con la confirmación del pico si es necesario
    if (isPeak && !lastConfirmedPeakRef.current && confidence >= peakDetectionConfig.minConfidence) {
      // Necesitamos suficientes muestras en el buffer para la confirmación
      if (peakConfirmationBufferRef.current.length >= 3) {
        const len = peakConfirmationBufferRef.current.length;
        
        // Confirmar pico si los valores posteriores descienden significativamente
        const peakValue = peakConfirmationBufferRef.current[len - 3]; 
        const valueAfter1 = peakConfirmationBufferRef.current[len - 2];
        const valueAfter2 = peakConfirmationBufferRef.current[len - 1];
        
        const drop1 = peakValue - valueAfter1;
        const drop2 = valueAfter1 - valueAfter2;

        // Requerir una bajada clara y consistente
        const MIN_DROP_RATIO = 0.12; // Reducido: Exigir que la bajada sea al menos 12% (antes 15%)
        const isSignificantDrop = 
          drop1 > peakValue * MIN_DROP_RATIO || 
          drop2 > peakValue * MIN_DROP_RATIO;
          
        // Mantener la lógica anterior como respaldo si la señal es más ruidosa
        const goingDownSimple = valueAfter2 < valueAfter1 || valueAfter1 < peakValue;

        if (isSignificantDrop || goingDownSimple) { // Priorizar bajada significativa
          isConfirmedPeak = true;
          lastConfirmedPeakRef.current = true;
        }
      }
    } else if (!isPeak) {
      lastConfirmedPeakRef.current = false;
    }

    return isConfirmedPeak;
  }, [confidence]);

  /**
   * Calcular BPM a partir de intervalos RR
   */
  const calculateBPM = useCallback((): { bpm: number, confidence: number } => {
    if (rrIntervalsRef.current.length < 2) {
      return { bpm: 0, confidence: 0 };
    }

    // Usar solo los últimos intervalos (más recientes)
    const recentIntervals = rrIntervalsRef.current.slice(-8);

    // Filtrar intervalos extremos
    const validIntervals = recentIntervals.filter(interval => 
      interval >= 300 && interval <= 2000
    );

    if (validIntervals.length < 2) {
      return { bpm: lastValidBpmRef.current || 0, confidence: 0.1 };
    }

    // Calcular BPM promedio
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const bpm = Math.round(60000 / avgInterval);

    // Calcular confianza basada en consistencia de intervalos
    let intervalVariationSum = 0;
    for (let i = 1; i < validIntervals.length; i++) {
      const variation = validIntervals[i] - validIntervals[i-1];
      intervalVariationSum += variation < 0 ? -variation : variation;
    }
    
    const avgVariation = intervalVariationSum / (validIntervals.length - 1);
    const consistencyFactor = 1 - (avgVariation / avgInterval);
    
    // Confianza final entre 0 y 1
    const bpmConfidence = consistencyFactor * (Math.min(validIntervals.length / 5, 1));
    
    const finalBPM = bpm >= 40 && bpm <= 200 ? bpm : lastValidBpmRef.current || 80;
    
    if (bpm >= 40 && bpm <= 200 && bpmConfidence > 0.5) {
      lastValidBpmRef.current = bpm;
    }

    return { bpm: finalBPM, confidence: bpmConfidence };
  }, []);

  /**
   * Procesa una nueva señal
   */
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!isProcessing) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false
      };
    }

    const currentTime = Date.now();
    
    // Actualizar buffer de valores
    valuesBufferRef.current.push(value);
    if (valuesBufferRef.current.length > 30) {
      valuesBufferRef.current.shift();
    }
    
    // Simple baseline tracking
    if (baselineRef.current === 0) {
      baselineRef.current = value;
    } else {
      baselineRef.current = baselineRef.current * 0.98 + value * 0.02;
    }
    
    // Normalizar el valor
    const normalizedValue = value - baselineRef.current;
    
    // Calcular derivada para detectar cambios rápidos
    const derivative = lastFilteredValueRef.current !== null ? 
      normalizedValue - lastFilteredValueRef.current : 0;
    
    // Almacenar para la próxima iteración
    lastFilteredValueRef.current = normalizedValue;
    lastDerivativeRef.current = derivative;
    
    // Detectar pico
    const { isPeak, confidence: peakConfidence } = detectPeak(
      normalizedValue,
      derivative,
      currentTime
    );
    
    // Confirmar pico con análisis adicional
    const isConfirmedPeak = confirmPeak(isPeak, normalizedValue);
    
    // Si es un pico confirmado, actualizar tiempos de pico e intervalos RR
    if (isConfirmedPeak) {
      if (lastPeakTimeRef.current !== null) {
        const rrInterval = currentTime - lastPeakTimeRef.current;
        
        // Solo aceptar intervalos fisiológicamente plausibles
        if (rrInterval >= 300 && rrInterval <= 2000) {
          rrIntervalsRef.current.push(rrInterval);
          
          // Mantener solo los intervalos más recientes
          if (rrIntervalsRef.current.length > 16) {
            rrIntervalsRef.current.shift();
          }
          
          // Procesar con servicio de detección de arritmias
          const isArrDetected = ArrhythmiaDetectionService.processRRInterval(rrInterval, currentTime);
          setIsArrhythmia(isArrDetected);
        }
      }
      
      lastPeakTimeRef.current = currentTime;
    }
    
    // Calcular BPM actual
    const { bpm, confidence: bpmConfidence } = calculateBPM();
    
    if (bpm > 0 && bpmConfidence > 0.3) {
      setCurrentBPM(bpm);
      setConfidence(bpmConfidence);
    }
    
    // Crear objeto de intervalos RR para el resultado
    let rrData;
    if (rrIntervalsRef.current.length >= 2) {
      const recentIntervals = rrIntervalsRef.current.slice(-8);
      const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
      
      rrData = {
        intervals: [...recentIntervals],
        averageInterval: avgInterval
      };
    }

    return {
      bpm,
      confidence: bpmConfidence,
      isPeak: isConfirmedPeak,
      rrData
    };
  }, [isProcessing, detectPeak, confirmPeak, calculateBPM]);

  /**
   * Iniciar monitoreo
   */
  const startMonitoring = useCallback(() => {
    setIsProcessing(true);
    valuesBufferRef.current = [];
    rrIntervalsRef.current = [];
    lastPeakTimeRef.current = null;
    lastFilteredValueRef.current = null;
    baselineRef.current = 0;
    peakConfirmationBufferRef.current = [];
    lastConfirmedPeakRef.current = false;
    ArrhythmiaDetectionService.startMonitoring();
  }, []);

  /**
   * Detener monitoreo
   */
  const stopMonitoring = useCallback(() => {
    setIsProcessing(false);
    ArrhythmiaDetectionService.stopMonitoring();
  }, []);

  /**
   * Reiniciar completamente
   */
  const reset = useCallback(() => {
    stopMonitoring();
    resetSignalQuality();
    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    lastValidBpmRef.current = 0;
    valuesBufferRef.current = [];
    rrIntervalsRef.current = [];
    lastPeakTimeRef.current = null;
    lastFilteredValueRef.current = null;
    baselineRef.current = 0;
    peakConfirmationBufferRef.current = [];
    lastConfirmedPeakRef.current = false;
    ArrhythmiaDetectionService.reset();
  }, [stopMonitoring, resetSignalQuality]);

  return {
    currentBPM,
    isArrhythmia,
    confidence,
    processSignal,
    startMonitoring,
    stopMonitoring,
    reset
  };
}
