
/**
 * Hook para el procesamiento de ritmo cardíaco
 * Integra procesamiento de señal y retroalimentación audible
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatSignalProcessor } from './heart-beat/signal-processor';
import { BeepProcessor } from './heart-beat/beep-processor';
import { useSignalOptimizer } from './useSignalOptimizer';

/**
 * Hook para procesar ritmo cardíaco y generar feedback
 */
export const useHeartBeatProcessor = () => {
  // Estado para detección de arritmia
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  
  // Referencias para processors
  const signalProcessorRef = useRef<HeartBeatSignalProcessor | null>(null);
  const beepProcessorRef = useRef<BeepProcessor | null>(null);
  const isMonitoringRef = useRef(false);
  const lastBpmRef = useRef(0);
  const lastPeaksRef = useRef<number[]>([]);
  const arrhythmiaCountRef = useRef(0);
  
  // Acceder al optimizador de señal
  const { getOptimizedChannel } = useSignalOptimizer();
  
  // Inicializar procesadores al montar
  useEffect(() => {
    signalProcessorRef.current = new HeartBeatSignalProcessor();
    beepProcessorRef.current = new BeepProcessor();
    
    // Cleanup
    return () => {
      if (beepProcessorRef.current) {
        beepProcessorRef.current.dispose();
        beepProcessorRef.current = null;
      }
      signalProcessorRef.current = null;
    };
  }, []);
  
  /**
   * Detecta posibles arritmias basado en variabilidad RR
   */
  const detectArrhythmia = useCallback((rrIntervals: number[]) => {
    if (rrIntervals.length < 3) return false;
    
    // Calcular desviación estándar normalizada de intervalos RR
    const mean = rrIntervals.reduce((sum, interval) => sum + interval, 0) / rrIntervals.length;
    
    let variance = 0;
    for (const interval of rrIntervals) {
      variance += Math.pow(interval - mean, 2);
    }
    variance /= rrIntervals.length;
    
    const stdDev = Math.sqrt(variance);
    const normalizedStdDev = stdDev / mean;
    
    // Calcular diferencias sucesivas
    const successiveDiffs: number[] = [];
    for (let i = 1; i < rrIntervals.length; i++) {
      successiveDiffs.push(Math.abs(rrIntervals[i] - rrIntervals[i-1]));
    }
    
    // Calcular promedio de diferencias
    const avgDiff = successiveDiffs.reduce((sum, diff) => sum + diff, 0) / successiveDiffs.length;
    const normalizedAvgDiff = avgDiff / mean;
    
    // Criterios para posible arritmia
    const isHighVariability = normalizedStdDev > 0.15;
    const isHighSuccessiveDiff = normalizedAvgDiff > 0.18;
    
    // Detectar arritmia si se cumplen ambos criterios
    const detectedArrhythmia = isHighVariability && isHighSuccessiveDiff;
    
    if (detectedArrhythmia && !isArrhythmia) {
      arrhythmiaCountRef.current += 1;
      setIsArrhythmia(true);
      
      // Reiniciar estado después de un tiempo
      setTimeout(() => setIsArrhythmia(false), 5000);
    }
    
    return detectedArrhythmia;
  }, [isArrhythmia]);
  
  /**
   * Procesa una señal para detectar ritmo cardíaco
   */
  const processSignal = useCallback((value: number) => {
    if (!signalProcessorRef.current) return { bpm: 0, isPeak: false, confidence: 0, rrData: { intervals: [], lastPeakTime: null } };
    
    // Obtener señal optimizada del canal de ritmo cardíaco
    const optimizedSignal = getOptimizedChannel?.('heartRate');
    
    // Procesar señal (usar valor optimizado si está disponible)
    const result = signalProcessorRef.current.processSignal(
      optimizedSignal?.optimizedValue || value,
      Date.now(),
      optimizedSignal
    );
    
    // Actualizar BPM de referencia
    if (result.bpm > 0) {
      lastBpmRef.current = result.bpm;
    }
    
    // Detectar arritmia
    if (result.rrData.intervals.length >= 3) {
      detectArrhythmia(result.rrData.intervals);
    }
    
    // Reproducir beep si es un pico y estamos monitoreando
    if (result.isPeak && isMonitoringRef.current && result.confidence > 0.3) {
      beepProcessorRef.current?.playBeep(result.confidence);
      
      // Almacenar tiempo de pico para análisis
      lastPeaksRef.current.push(Date.now());
      if (lastPeaksRef.current.length > 10) {
        lastPeaksRef.current.shift();
      }
    }
    
    return result;
  }, [detectArrhythmia, getOptimizedChannel]);
  
  /**
   * Inicia el monitoreo con feedback audible
   */
  const startMonitoring = useCallback(() => {
    isMonitoringRef.current = true;
    
    // Inicializar audio (debe ser llamado después de interacción de usuario)
    beepProcessorRef.current?.initialize();
    
    // Ajustar frecuencia de beep según BPM
    if (beepProcessorRef.current && lastBpmRef.current > 0) {
      const frequency = 550 + Math.min(150, Math.max(-150, (lastBpmRef.current - 75) * 2));
      beepProcessorRef.current.setFrequency(frequency);
    }
  }, []);
  
  /**
   * Detiene el monitoreo
   */
  const stopMonitoring = useCallback(() => {
    isMonitoringRef.current = false;
    beepProcessorRef.current?.stopBeep();
  }, []);
  
  /**
   * Reinicia completamente el procesador
   */
  const reset = useCallback(() => {
    signalProcessorRef.current?.reset();
    beepProcessorRef.current?.stopBeep();
    lastBpmRef.current = 0;
    lastPeaksRef.current = [];
    arrhythmiaCountRef.current = 0;
    setIsArrhythmia(false);
  }, []);
  
  /**
   * Obtiene el contador de arritmias
   */
  const getArrhythmiaCount = useCallback(() => {
    return arrhythmiaCountRef.current;
  }, []);
  
  /**
   * Obtiene análisis sobre regularidad de ritmo
   */
  const getRhythmRegularity = useCallback(() => {
    if (lastPeaksRef.current.length < 4) return 100;
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < lastPeaksRef.current.length; i++) {
      intervals.push(lastPeaksRef.current[i] - lastPeaksRef.current[i-1]);
    }
    
    // Calcular variabilidad
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    let variance = 0;
    for (const interval of intervals) {
      variance += Math.pow(interval - mean, 2);
    }
    variance /= intervals.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficient = (stdDev / mean) * 100;
    
    // Convertir a puntuación de regularidad (0-100)
    const regularity = Math.max(0, Math.min(100, 100 - coefficient));
    
    return Math.round(regularity);
  }, []);
  
  return {
    processSignal,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    reset,
    getArrhythmiaCount,
    getRhythmRegularity
  };
};
