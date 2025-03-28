
/**
 * Hook para utilizar el optimizador de señal
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  SignalOptimizer, 
  VitalSignChannel, 
  OptimizedSignal,
  FeedbackData
} from '../modules/signal-optimization/types';
import { createSignalOptimizer } from '../modules/signal-optimization/SignalOptimizer';
import { ProcessedPPGSignal } from '../modules/signal-processing/types';

/**
 * Hook que proporciona acceso al optimizador de señal multicanal
 */
export const useSignalOptimizer = () => {
  // Crear instancia del optimizador
  const [optimizer] = useState<SignalOptimizer>(() => createSignalOptimizer());
  
  // Estado para resultados más recientes
  const [optimizedSignals, setOptimizedSignals] = useState<Record<VitalSignChannel, OptimizedSignal | null>>({
    heartRate: null,
    spo2: null,
    bloodPressure: null,
    glucose: null,
    cholesterol: null,
    triglycerides: null
  });
  
  // Procesar una señal PPG
  const processSignal = useCallback((signal: ProcessedPPGSignal) => {
    if (!signal) return null;
    
    // Optimizar la señal para todos los canales
    const results = optimizer.optimizeSignal(signal);
    setOptimizedSignals(results);
    
    return results;
  }, [optimizer]);
  
  // Enviar retroalimentación para un canal específico
  const sendFeedback = useCallback((feedback: FeedbackData) => {
    optimizer.processFeedback(feedback);
  }, [optimizer]);
  
  // Reiniciar el optimizador
  const reset = useCallback(() => {
    optimizer.reset();
    setOptimizedSignals({
      heartRate: null,
      spo2: null,
      bloodPressure: null,
      glucose: null,
      cholesterol: null,
      triglycerides: null
    });
  }, [optimizer]);
  
  // Obtener optimizador para un canal específico
  const getChannelOptimizer = useCallback((channel: VitalSignChannel) => {
    return optimizer.getChannelOptimizer(channel);
  }, [optimizer]);
  
  return {
    optimizedSignals,
    processSignal,
    sendFeedback,
    reset,
    getChannelOptimizer
  };
};
