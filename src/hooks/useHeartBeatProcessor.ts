
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
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastBeepTimeRef = useRef<number>(0);
  const MIN_BEEP_INTERVAL_MS = 300; // Aumentado para evitar beeps demasiado cercanos
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // Para análisis temporal más preciso
  const beatHistoryRef = useRef<Array<{time: number, isArrhythmia: boolean, interval: number}>>([]);
  const currentArrhythmiaWindowRef = useRef<{start: number, end: number | null}>({start: 0, end: null});
  const expectedNextBeatTimeRef = useRef<number>(0);
  const beepQueueRef = useRef<{time: number, played: boolean}[]>([]);
  
  // Contador para calibración
  const stabilityCounterRef = useRef<number>(0);
  const heartRateVariabilityRef = useRef<number[]>([]);

  useEffect(() => {
    console.log('useHeartBeatProcessor: Creando nueva instancia de HeartBeatProcessor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    processorRef.current = new HeartBeatProcessor();
    
    if (typeof window !== 'undefined') {
      (window as any).heartBeatProcessor = processorRef.current;
      console.log('useHeartBeatProcessor: Processor registrado en window', {
        processorRegistrado: !!(window as any).heartBeatProcessor,
        timestamp: new Date().toISOString()
      });
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
        console.log('useHeartBeatProcessor: Processor eliminado de window', {
          processorExiste: !!(window as any).heartBeatProcessor,
          timestamp: new Date().toISOString()
        });
      }
    };
  }, []);

  const playBeepSound = useCallback(() => {
    if (!processorRef.current) return;
    
    const now = Date.now();
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      console.log('useHeartBeatProcessor: Beep ignorado - demasiado cercano al anterior', {
        timeSinceLastBeep: now - lastBeepTimeRef.current,
        threshold: MIN_BEEP_INTERVAL_MS
      });
      return;
    }
    
    // Validación adicional para evitar beeps irregulares
    if (currentBPM > 40 && beatHistoryRef.current.length >= 3) {
      const expectedInterval = 60000 / currentBPM;
      const lastBeat = beatHistoryRef.current[beatHistoryRef.current.length - 1];
      
      // Verificar si estamos dentro de la ventana de tiempo esperada
      if (expectedNextBeatTimeRef.current > 0) {
        const timeDiff = Math.abs(now - expectedNextBeatTimeRef.current);
        
        // Si estamos muy lejos del tiempo esperado (>25% del intervalo), registrar pero no reproducir
        if (timeDiff > expectedInterval * 0.25) {
          console.log('useHeartBeatProcessor: Beep fuera de la ventana temporal esperada', {
            expectedTime: expectedNextBeatTimeRef.current,
            actualTime: now,
            difference: timeDiff,
            expectedInterval
          });
          
          // Aun así actualizamos para la próxima vez
          expectedNextBeatTimeRef.current = now + expectedInterval;
          return;
        }
      }
      
      // Actualizar próximo tiempo esperado
      expectedNextBeatTimeRef.current = now + expectedInterval;
    } else if (currentBPM > 0) {
      // Inicializar tiempo esperado si tenemos BPM pero no suficiente historia
      expectedNextBeatTimeRef.current = now + (60000 / currentBPM);
    }
    
    try {
      processorRef.current.playBeep();
      lastBeepTimeRef.current = now;
      console.log('useHeartBeatProcessor: Beep sincronizado reproducido', {
        timestamp: new Date().toISOString(),
        bpm: currentBPM
      });
    } catch (err) {
      console.error('useHeartBeatProcessor: Error al reproducir beep', err);
    }
  }, [currentBPM]);

  // Algoritmo mejorado de detección de arritmias
  const detectArrhythmia = useCallback((rrIntervals: number[]): boolean => {
    if (rrIntervals.length < 6) return false;
    
    // Usar más intervalos para análisis más preciso
    const lastIntervals = rrIntervals.slice(-6);
    const lastInterval = lastIntervals[lastIntervals.length - 1];
    
    // Usar más intervalos previos para mejor referencia
    const previousIntervals = rrIntervals.slice(-10, -1);
    if (previousIntervals.length < 5) return false;
    
    // Calcular estadísticas más robustas
    const sortedPrevious = [...previousIntervals].sort((a, b) => a - b);
    const medianPrevious = sortedPrevious[Math.floor(sortedPrevious.length / 2)];
    
    // Calcular variabilidad de intervalos previos
    let sumDev = 0;
    for (const interval of previousIntervals) {
      sumDev += Math.abs(interval - medianPrevious);
    }
    const avgVariability = sumDev / previousIntervals.length;
    
    // Guadar variabilidad para análisis
    heartRateVariabilityRef.current.push(avgVariability);
    if (heartRateVariabilityRef.current.length > 20) {
      heartRateVariabilityRef.current.shift();
    }
    
    // Criterio conservador - solo señalar arritmia si hay variación significativa
    // y tenemos suficiente estabilidad previa
    const variationFromMedian = Math.abs(lastInterval - medianPrevious) / medianPrevious;
    
    // Basado en estabilidad, ajustamos umbral
    let threshold = 0.30; // 30% por defecto
    if (stabilityCounterRef.current > 30) {
      // Cuando hay alta estabilidad, reducimos el umbral para detectar arritmias menores
      threshold = 0.20;
    } else if (stabilityCounterRef.current < 10) {
      // Con baja estabilidad, somos más conservadores
      threshold = 0.40;
    }
    
    const isPrematureBeat = lastInterval < (0.7 * medianPrevious);
    const isDelayedBeat = lastInterval > (1.4 * medianPrevious);
    const isIrregularVariation = variationFromMedian > threshold;
    
    // Si no hay anomalías, incrementar contador de estabilidad
    if (!isPrematureBeat && !isDelayedBeat && !isIrregularVariation) {
      stabilityCounterRef.current++;
    } else {
      // Ante anomalía, reducir contador pero no a cero para mantener contexto
      stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 3);
    }
    
    // Solo considerar como arritmia si hay suficiente estabilidad previa (evita falsos positivos al inicio)
    const isArrhythmia = (isPrematureBeat || isDelayedBeat || isIrregularVariation) && 
                          stabilityCounterRef.current > 5;
    
    // Registrar para análisis temporal
    const now = Date.now();
    beatHistoryRef.current.push({
      time: now, 
      isArrhythmia, 
      interval: lastInterval
    });
    
    // Actualizar ventana de arritmia para visualización
    if (isArrhythmia) {
      if (currentArrhythmiaWindowRef.current.end !== null) {
        currentArrhythmiaWindowRef.current = {
          start: now, 
          end: null
        };
      }
      
      console.log('useHeartBeatProcessor: Latido arrítmico detectado', {
        tipo: isPrematureBeat ? 'prematuro' : isDelayedBeat ? 'retrasado' : 'irregular',
        intervaloActual: lastInterval,
        medianaPrevios: medianPrevious,
        variación: variationFromMedian,
        umbral: threshold,
        estabilidad: stabilityCounterRef.current,
        timestamp: new Date().toISOString()
      });
    } else {
      if (currentArrhythmiaWindowRef.current.end === null) {
        currentArrhythmiaWindowRef.current.end = now;
      }
    }
    
    // Mantener historial acotado
    if (beatHistoryRef.current.length > 20) {
      beatHistoryRef.current = beatHistoryRef.current.slice(-20);
    }
    
    return isArrhythmia;
  }, []);

  const isTimestampInArrhythmiaWindow = useCallback((timestamp: number): boolean => {
    if (currentArrhythmiaWindowRef.current.end === null) {
      return timestamp >= currentArrhythmiaWindowRef.current.start;
    }
    
    // Buscar latidos arrítmicos cercanos al timestamp
    const arrhythmicBeats = beatHistoryRef.current.filter(beat => beat.isArrhythmia);
    if (arrhythmicBeats.length === 0) return false;
    
    // Considerar ventana temporal adaptativa basada en frecuencia cardíaca
    const windowSize = currentBPM > 0 ? Math.min(800, 60000 / currentBPM) : 800;
    
    return arrhythmicBeats.some(beat => Math.abs(beat.time - timestamp) < windowSize);
  }, [currentBPM]);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn('useHeartBeatProcessor: Processor no inicializado', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
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

    // Procesar señal con algoritmo mejorado
    const result = processorRef.current.processSignal(value);
    const rrData = processorRef.current.getRRIntervals();
    const now = Date.now();
    
    // Actualizar intervalos RR para análisis
    if (rrData && rrData.intervals.length > 0) {
      lastRRIntervalsRef.current = [...rrData.intervals];
    }
    
    let currentBeatIsArrhythmia = false;
    
    // Solo verificar arritmia con suficiente confianza
    if (result.isPeak && result.confidence > 0.70 && lastRRIntervalsRef.current.length >= 6) {
      currentBeatIsArrhythmia = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = currentBeatIsArrhythmia;
      lastIsArrhythmiaRef.current = currentBeatIsArrhythmia;
    } else {
      // Verificar si estamos en ventana de arritmia para coloración
      currentBeatIsArrhythmiaRef.current = isTimestampInArrhythmiaWindow(now);
    }

    // Solo reproducir beep en picos detectados con suficiente confianza y espaciado
    if (result.isPeak && result.confidence > 0.70 && 
        (!lastPeakTimeRef.current || 
         now - lastPeakTimeRef.current >= MIN_BEEP_INTERVAL_MS)) {
      
      lastPeakTimeRef.current = now;
      
      // Reproducir beep sincronizado
      playBeepSound();
    }

    // Con baja confianza, mantener valores previos sin actualizar
    if (result.confidence < 0.5) {
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

    // Actualizar BPM solo con valores válidos
    if (result.bpm > 0) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    return {
      ...result,
      isArrhythmia: currentBeatIsArrhythmiaRef.current,
      rrData
    };
  }, [currentBPM, confidence, playBeepSound, detectArrhythmia, isTimestampInArrhythmiaWindow]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reseteando processor', {
      sessionId: sessionId.current,
      prevBPM: currentBPM,
      prevConfidence: confidence,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.reset();
      console.log('useHeartBeatProcessor: Processor reseteado correctamente', {
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('useHeartBeatProcessor: No se pudo resetear - processor no existe', {
        timestamp: new Date().toISOString()
      });
    }
    
    // Resetear todos los estados
    setCurrentBPM(0);
    setConfidence(0);
    lastPeakTimeRef.current = null;
    lastBeepTimeRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    beatHistoryRef.current = [];
    currentArrhythmiaWindowRef.current = {start: 0, end: null};
    expectedNextBeatTimeRef.current = 0;
    beepQueueRef.current = [];
    stabilityCounterRef.current = 0;
    heartRateVariabilityRef.current = [];
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current
  };
};
