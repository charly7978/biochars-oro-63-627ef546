
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue?: number;
  arrhythmiaCount: number;
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
  const lastProcessedTimeRef = useRef<number>(0);
  const processingIntervalRef = useRef<number>(25); // Process at 40Hz by default
  const signalBufferRef = useRef<number[]>([]);
  const BUFFER_SIZE = 30; // Mayor buffer para análisis de señal

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

    // Implement rate limiting to avoid processing too many signals too quickly
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < processingIntervalRef.current) {
      return {
        bpm: currentBPM,
        confidence,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: processorRef.current.getRRIntervals()
      };
    }
    lastProcessedTimeRef.current = now;

    // Almacenar la señal en un buffer para análisis de calidad
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > BUFFER_SIZE) {
      signalBufferRef.current.shift();
    }

    // Realizar pre-análisis de calidad de la señal
    const signalQuality = analyzeSignalQuality(signalBufferRef.current);

    // Aplicar amplificación adaptativa basada en la calidad de la señal
    // Cuando la calidad es menor, amplificamos más para detectar mejor
    const amplificationFactor = calculateAmplificationFactor(signalQuality);
    const amplifiedValue = value * amplificationFactor;

    console.log('useHeartBeatProcessor - processSignal detallado:', {
      inputValue: value,
      amplifiedValue: amplifiedValue.toFixed(2),
      amplificationFactor: amplificationFactor.toFixed(2),
      signalQuality: signalQuality.toFixed(2),
      currentProcessor: !!processorRef.current,
      processorMethods: processorRef.current ? Object.getOwnPropertyNames(Object.getPrototypeOf(processorRef.current)) : [],
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });

    const result = processorRef.current.processSignal(amplifiedValue);
    const rrData = processorRef.current.getRRIntervals();

    console.log('useHeartBeatProcessor - resultado detallado:', {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: result.arrhythmiaCount,
      rrIntervals: JSON.stringify(rrData.intervals),
      ultimosIntervalos: rrData.intervals.slice(-5),
      ultimoPico: rrData.lastPeakTime,
      tiempoDesdeUltimoPico: rrData.lastPeakTime ? Date.now() - rrData.lastPeakTime : null,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Usar un umbral de confianza más apropiado para diferentes etapas de detección
    const dynamicConfidenceThreshold = result.bpm > 0 ? 0.65 : 0.75;
    
    if (result.confidence < dynamicConfidenceThreshold) {
      console.log('useHeartBeatProcessor: Confianza insuficiente, ignorando pico', { confidence: result.confidence });
      return {
        bpm: currentBPM,
        confidence: result.confidence,
        isPeak: false,
        arrhythmiaCount: 0,
        filteredValue: amplifiedValue,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    if (result.bpm > 0) {
      // Only update BPM if it's within a reasonable physiological range
      if (result.bpm >= 45 && result.bpm <= 180) {
        console.log('useHeartBeatProcessor - Actualizando BPM y confianza', {
          prevBPM: currentBPM,
          newBPM: result.bpm,
          prevConfidence: confidence,
          newConfidence: result.confidence,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
        
        // Use weighted average to smooth BPM updates, con mayor peso al nuevo valor
        // para una respuesta más rápida y precisa
        const newBPM = currentBPM === 0 ? 
          result.bpm : 
          Math.round(result.bpm * 0.4 + currentBPM * 0.6);
        
        setCurrentBPM(newBPM);
        setConfidence(result.confidence);
      } else {
        console.log('useHeartBeatProcessor - BPM fuera de rango fisiológico', {
          invalidBPM: result.bpm,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString()
        });
      }
    }

    return {
      ...result,
      filteredValue: amplifiedValue,
      rrData
    };
  }, [currentBPM, confidence]);

  // Analiza la calidad de la señal basándose en características como variabilidad y rango
  const analyzeSignalQuality = (buffer: number[]): number => {
    if (buffer.length < 10) return 0.5; // Valor por defecto si no hay suficientes datos
    
    // Calcular estadísticas básicas
    const min = Math.min(...buffer);
    const max = Math.max(...buffer);
    const range = max - min;
    const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    
    // Cálculo de varianza y desviación estándar
    const variance = buffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / buffer.length;
    const stdDev = Math.sqrt(variance);
    
    // Coeficiente de variación - una medida de la dispersión relativa
    const cv = stdDev / (Math.abs(mean) || 1);
    
    // Análisis de diferencias entre muestras consecutivas (para detectar ruido)
    const diffSum = buffer.slice(1).reduce((sum, val, i) => sum + Math.abs(val - buffer[i]), 0);
    const avgDiff = diffSum / (buffer.length - 1);
    
    // Calcular una puntuación de 0-1 donde 1 es la mejor calidad
    // La calidad óptima tiene: variabilidad moderada (no muy alta ni muy baja)
    let quality = 0;
    
    // 1. Penalizar si el rango es muy pequeño (señal muy débil)
    if (range < 0.1) {
      quality = 0.2;
    } 
    // 2. Penalizar si el CV es muy alto (mucho ruido)
    else if (cv > 0.5) {
      quality = 0.3;
    }
    // 3. Penalizar si las diferencias entre muestras son muy bruscas (ruido de alta frecuencia)
    else if (avgDiff > 0.3) {
      quality = 0.4;
    }
    // 4. Calidad media-alta cuando los parámetros son razonables
    else {
      // Mapear el CV a una escala de calidad (menor CV = mejor calidad, hasta cierto punto)
      const cvScore = cv < 0.05 ? 0.7 : (cv > 0.3 ? 0.5 : map(cv, 0.05, 0.3, 0.7, 0.5));
      
      // Mapear el rango a una escala de calidad (rango moderado = mejor calidad)
      const rangeScore = (range < 0.2) ? map(range, 0.1, 0.2, 0.5, 0.8) : 
                         (range > 1.0 ? map(range, 1.0, 2.0, 0.8, 0.5) : 0.8);
      
      // Combinar puntuaciones
      quality = (cvScore * 0.5 + rangeScore * 0.5);
    }
    
    return quality;
  };
  
  // Función auxiliar para mapear un valor de un rango a otro
  const map = (value: number, inMin: number, inMax: number, outMin: number, outMax: number): number => {
    return ((value - inMin) * (outMax - outMin) / (inMax - inMin)) + outMin;
  };
  
  // Calcular factor de amplificación basado en calidad de señal y otras heurísticas
  const calculateAmplificationFactor = (quality: number): number => {
    // Amplificación base
    const baseFactor = 1.8;
    
    // Ajustar amplificación inversamente proporcional a la calidad
    // Señales de menor calidad necesitan más amplificación
    const qualityAdjustment = map(quality, 0, 1, 0.8, -0.3);
    
    // Calcular factor final con límites
    const factor = Math.max(1.2, Math.min(2.5, baseFactor + qualityAdjustment));
    
    return factor;
  };

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
    
    setCurrentBPM(0);
    setConfidence(0);
    lastProcessedTimeRef.current = 0;
    signalBufferRef.current = [];
  }, [currentBPM, confidence]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset
  };
};
