
/**
 * Hook para utilizar el optimizador de señal multicanal
 * Integra el optimizador con el flujo de procesamiento existente
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProcessedPPGSignal } from '../modules/signal-processing/types';
import { 
  SignalOptimizer, 
  OptimizedSignal, 
  VitalSignChannel,
  FeedbackData,
  createOptimizer
} from '../modules/signal-optimization';

/**
 * Hook para trabajar con el optimizador de señal multicanal
 */
export const useSignalOptimizer = () => {
  // Referencia al optimizador para mantener instancia estable
  const optimizerRef = useRef<SignalOptimizer | null>(null);
  
  // Estado para valores optimizados por canal
  const [optimizedValues, setOptimizedValues] = useState<Record<VitalSignChannel, OptimizedSignal | null>>({
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  });
  
  // Inicializar optimizador
  useEffect(() => {
    if (!optimizerRef.current) {
      optimizerRef.current = createOptimizer();
      console.log("SignalOptimizer: Inicializado a través de hook");
    }
    
    // Cleanup al desmontar
    return () => {
      if (optimizerRef.current) {
        optimizerRef.current.reset();
        optimizerRef.current = null;
      }
    };
  }, []);
  
  /**
   * Procesa una señal a través del optimizador
   */
  const optimizeSignal = useCallback((signal: ProcessedPPGSignal) => {
    if (!optimizerRef.current) return null;
    
    try {
      // Procesar a través de todos los canales
      const optimized = optimizerRef.current.optimizeSignal(signal);
      
      // Actualizar estado
      setOptimizedValues(optimized);
      
      return optimized;
    } catch (error) {
      console.error("Error optimizando señal:", error);
      return null;
    }
  }, []);
  
  /**
   * Envía retroalimentación de un módulo de cálculo al optimizador
   */
  const sendFeedback = useCallback((feedback: FeedbackData) => {
    if (!optimizerRef.current) return;
    
    try {
      optimizerRef.current.processFeedback(feedback);
    } catch (error) {
      console.error("Error procesando feedback:", error);
    }
  }, []);
  
  /**
   * Reinicia el optimizador
   */
  const reset = useCallback(() => {
    if (optimizerRef.current) {
      optimizerRef.current.reset();
      
      setOptimizedValues({
        heartRate: null,
        spo2: null,
        bloodPressure: null,
        glucose: null,
        cholesterol: null,
        triglycerides: null
      });
    }
  }, []);
  
  /**
   * Obtiene el valor optimizado para un canal específico
   */
  const getOptimizedChannel = useCallback((channel: VitalSignChannel) => {
    return optimizedValues[channel];
  }, [optimizedValues]);
  
  return {
    optimizeSignal,
    sendFeedback,
    reset,
    optimizedValues,
    getOptimizedChannel,
    optimizer: optimizerRef.current
  };
};
