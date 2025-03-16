
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  // Estado interno
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Referencias para sincronización precisa de beep
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 250; // Intervalo mínimo entre beeps
  
  // Referencias para análisis de arritmias
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // Referencias para sincronización natural
  const expectedNextBeatTimeRef = useRef<number>(0);
  const heartRateVariabilityRef = useRef<number[]>([]);
  const beepPendingRef = useRef<boolean>(false);
  const stabilityCounterRef = useRef<number>(0);

  // Inicializar el procesador de latidos
  useEffect(() => {
    console.log('useHeartBeatProcessor: Inicializando nuevo procesador', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Crear nueva instancia
    processorRef.current = new HeartBeatProcessor();
    
    // Exponer para debugging si es necesario
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando procesador', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Función para reproducir el sonido de latido con sincronización natural
  const playBeepSound = useCallback(() => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    
    // Verificar intervalo mínimo para evitar beeps muy cercanos
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      return;
    }
    
    // Verificar si estamos en una ventana de tiempo válida para el beep
    if (currentBPM > 40) {
      const expectedInterval = 60000 / currentBPM;
      
      // Si hay un tiempo de beep esperado, verificar que estemos dentro de la ventana
      if (expectedNextBeatTimeRef.current > 0) {
        const timeDiff = Math.abs(now - expectedNextBeatTimeRef.current);
        
        // Si estamos fuera de la ventana temporal esperada, no reproducir
        if (timeDiff > expectedInterval * 0.2) {
          expectedNextBeatTimeRef.current = now + expectedInterval;
          return;
        }
      }
      
      // Actualizar próximo tiempo esperado
      expectedNextBeatTimeRef.current = now + expectedInterval;
    }
    
    try {
      // Reproducir el beep con el volumen adecuado
      processorRef.current.playBeep();
      lastBeepTimeRef.current = now;
      beepPendingRef.current = false;
    } catch (err) {
      console.error('useHeartBeatProcessor: Error reproduciendo beep', err);
    }
  }, [currentBPM]);

  // Algoritmo mejorado de detección de arritmias con análisis de contexto
  const detectArrhythmia = useCallback((rrIntervals: number[]): boolean => {
    if (rrIntervals.length < 5) return false;
    
    // Usar los últimos intervalos para análisis
    const lastIntervals = rrIntervals.slice(-5);
    const lastInterval = lastIntervals[lastIntervals.length - 1];
    
    // Cálculo estadístico robusto
    const sum = lastIntervals.reduce((a, b) => a + b, 0);
    const mean = sum / lastIntervals.length;
    
    // Umbral adaptativo basado en estabilidad previa
    let thresholdFactor = 0.30; // 30% por defecto
    if (stabilityCounterRef.current > 15) {
      // Más sensible con alta estabilidad
      thresholdFactor = 0.20;
    } else if (stabilityCounterRef.current < 5) {
      // Menos sensible al inicio
      thresholdFactor = 0.40;
    }
    
    // Criterios de arritmia ajustados para minimizar falsos positivos
    const variationRatio = Math.abs(lastInterval - mean) / mean;
    const isIrregular = variationRatio > thresholdFactor;
    
    // Actualizar contadores de estabilidad
    if (!isIrregular) {
      stabilityCounterRef.current++;
    } else {
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 2);
    }
    
    // Solo considerar arritmia si hay suficiente estabilidad previa
    const isArrhythmia = isIrregular && stabilityCounterRef.current > 10;
    
    // Guardar variabilidad para análisis futuro
    heartRateVariabilityRef.current.push(variationRatio);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    return isArrhythmia;
  }, []);

  // Procesar señal de entrada
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Procesar señal
    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const now = Date.now();
    
    // Actualizar intervalos RR
    if (rrData && rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    let currentBeatIsArrhythmia = false;
    
    // Verificar arritmia solo con suficiente confianza
    if (result.isPeak && result.confidence > 0.65 && lastRRIntervalsRef.current.length >= 5) {
      currentBeatIsArrhythmia = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
      lastIsArrhythmiaRef.current = currentBeatIsArrhythmia;
    }

    // Reproducir beep solo en picos con alta confianza
    if (result.isPeak && result.confidence > 0.65) {
      lastPeakTimeRef.current = now;
      
      // Marcar beep como pendiente para mejor sincronización
      beepPendingRef.current = true;
      
      // Reproducir inmediatamente, mejor sincronización natural
      playBeepSound();
    }

    // Con baja confianza, mantener valores previos
    if (result.confidence < 0.4) {
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Actualizar BPM con valores válidos
    if (result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      isArrhythmia: currentBeatIsArrhythmiaRef.current,
      rrData
    };
  }, [currentBPM, confidence, playBeepSound, detectArrhythmia]);

  // Reiniciar el procesador
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reiniciando procesador', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    // Resetear todos los estados
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    expectedNextBeatTimeRef.current = 0;
    heartRateVariabilityRef.current = [];
    beepPendingRef.current = false;
    stabilityCounterRef.current = 0;
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current
  };
};
