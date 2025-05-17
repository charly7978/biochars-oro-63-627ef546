
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '../../core/types';
import { useHeartbeatFeedback } from '../useHeartbeatFeedback';

/**
 * Hook para procesamiento de latidos cardíacos
 * Centraliza la lógica de detección y retroalimentación
 */
export function useHeartBeatProcessor(
  feedbackEnabled: boolean = true,
  sampleRate: number = 30
) {
  // Estado para resultados de latidos
  const [heartBeatResult, setHeartBeatResult] = useState<HeartBeatResult | null>(null);
  
  // Referencias para procesador y audio
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Hook de retroalimentación
  const triggerFeedback = useHeartbeatFeedback(feedbackEnabled);
  
  // Contador de arritmias
  const arrhythmiaCounterRef = useRef<number>(0);
  const processedValuesRef = useRef<number>(0);
  
  // Inicializar contexto de audio y procesador
  useEffect(() => {
    try {
      if (feedbackEnabled && typeof AudioContext !== 'undefined') {
        audioContextRef.current = new AudioContext();
        console.log("useHeartBeatProcessor: Audio context initialized");
      }
    } catch (error) {
      console.error("useHeartBeatProcessor: Failed to initialize audio context", error);
    }
    
    // Crear procesador
    processorRef.current = new HeartBeatProcessor(audioContextRef.current);
    
    return () => {
      // Cleanup
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [feedbackEnabled]);
  
  /**
   * Procesa un valor de señal PPG filtrado
   */
  const processValue = useCallback((value: number): HeartBeatResult | null => {
    if (!processorRef.current) {
      return null;
    }
    
    // Incrementar contador de valores procesados
    processedValuesRef.current++;
    
    // Procesar valor
    const result = processorRef.current.processValue(value);
    
    // Si tenemos un resultado válido, actualizar estado
    if (result && result.bpm > 0) {
      setHeartBeatResult(result);
      
      // Actualizar contador de arritmias
      if (result.isArrhythmia) {
        arrhythmiaCounterRef.current = result.arrhythmiaCount;
        
        // Activar retroalimentación de arritmia
        if (feedbackEnabled) {
          triggerFeedback('arrhythmia');
        }
      } else if (feedbackEnabled && processedValuesRef.current % Math.round(sampleRate / 2) === 0) {
        // Activar retroalimentación normal cada ciertos frames para simular latidos
        triggerFeedback('normal');
      }
      
      return result;
    }
    
    return heartBeatResult;
  }, [feedbackEnabled, triggerFeedback, sampleRate, heartBeatResult]);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setHeartBeatResult(null);
    processedValuesRef.current = 0;
  }, []);
  
  /**
   * Reinicio completo incluyendo contador de arritmias
   */
  const fullReset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.fullReset();
    }
    
    setHeartBeatResult(null);
    arrhythmiaCounterRef.current = 0;
    processedValuesRef.current = 0;
  }, []);
  
  /**
   * Obtiene contador actual de arritmias
   */
  const getArrhythmiaCounter = useCallback(() => {
    return arrhythmiaCounterRef.current;
  }, []);
  
  /**
   * Obtiene intervalos RR y último tiempo de pico
   */
  const getRRIntervals = useCallback(() => {
    if (!processorRef.current) {
      return { intervals: [], lastPeakTime: null };
    }
    
    return processorRef.current.getRRIntervals();
  }, []);
  
  return {
    heartBeatResult,
    processValue,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getRRIntervals,
    processedValues: processedValuesRef.current
  };
}
