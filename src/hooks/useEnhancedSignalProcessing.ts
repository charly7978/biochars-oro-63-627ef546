
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para integrar el procesamiento de señales optimizado
 * Actúa como punto de entrada unificado para las mejoras
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOptimizedProcessing } from './useOptimizedProcessing';
import { OptimizationPhase } from '../modules/extraction/optimization/OptimizationManager';

export interface EnhancedProcessingResult {
  original: number;
  enhanced: number;
  quality: number;
  confidence: number;
  processingTime: number;
  isPeak?: boolean;
  peakValue?: number;
  features?: {
    [key: string]: number;
  };
}

export const useEnhancedSignalProcessing = (
  initialPhase: OptimizationPhase = 'phase1',
  autoInitialize: boolean = true
) => {
  // Integrar procesamiento optimizado
  const { 
    isInitialized,
    status,
    error,
    processSignal,
    initialize,
    advanceToNextPhase,
    setPhase,
    getDetailedMetrics
  } = useOptimizedProcessing(autoInitialize, {
    autoAdvancePhases: true,
    initialPhase
  });
  
  // Estado local
  const [lastResult, setLastResult] = useState<EnhancedProcessingResult | null>(null);
  const [signalBuffer, setSignalBuffer] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [phaseTransitioned, setPhaseTransitioned] = useState<boolean>(false);
  
  // Referencia al buffer para evitar closures en callbacks
  const signalBufferRef = useRef<number[]>([]);
  
  // Método principal para procesar una señal
  const processValue = useCallback(async (value: number): Promise<EnhancedProcessingResult | null> => {
    if (!isInitialized && !isProcessing) {
      setIsProcessing(true);
      await initialize();
      setIsProcessing(false);
    }
    
    // Actualizar buffer
    const updatedBuffer = [...signalBufferRef.current, value];
    if (updatedBuffer.length > 100) { // Mantener tamaño razonable
      updatedBuffer.shift();
    }
    
    signalBufferRef.current = updatedBuffer;
    setSignalBuffer(updatedBuffer);
    
    try {
      // Usar buffer o valor único según longitud
      const input = updatedBuffer.length >= 4 ? updatedBuffer : value;
      const result = await processSignal(input);
      
      if (!result) return null;
      
      // Adaptación y normalización del resultado
      const enhancedResult: EnhancedProcessingResult = {
        original: value,
        enhanced: result.enhanced || result.filteredValue || value,
        quality: result.quality || 0.5,
        confidence: result.confidence || 0.5,
        processingTime: result.processingTime || 0,
        isPeak: result.isPeak || result.hasPeak || false,
        features: {}
      };
      
      // Extraer características adicionales si existen
      if (result.peakValue !== undefined) {
        enhancedResult.peakValue = result.peakValue;
      }
      
      // Características adicionales si están disponibles
      if (result.amplitude !== undefined) {
        enhancedResult.features = {
          ...enhancedResult.features,
          amplitude: result.amplitude
        };
      }
      
      if (result.baseline !== undefined) {
        enhancedResult.features = {
          ...enhancedResult.features,
          baseline: result.baseline
        };
      }
      
      // Actualizar estado
      setLastResult(enhancedResult);
      
      return enhancedResult;
    } catch (err) {
      console.error("Error procesando señal:", err);
      return null;
    }
  }, [isInitialized, isProcessing, initialize, processSignal]);
  
  // Monitorear transiciones de fase
  useEffect(() => {
    if (status && status.phase !== initialPhase && !phaseTransitioned) {
      console.log(`[useEnhancedSignalProcessing] Transición a fase ${status.phase}`);
      setPhaseTransitioned(true);
    }
  }, [status, initialPhase, phaseTransitioned]);
  
  // Reiniciar procesamiento
  const reset = useCallback(() => {
    setSignalBuffer([]);
    signalBufferRef.current = [];
    setLastResult(null);
    setPhaseTransitioned(false);
    
    // No reiniciar el controlador de optimización para mantener mejoras
  }, []);
  
  return {
    // Estado
    isInitialized,
    status,
    error,
    lastResult,
    signalBuffer,
    isProcessing,
    
    // Acciones
    processValue,
    initialize,
    reset,
    advanceToNextPhase,
    setPhase,
    getDetailedMetrics
  };
};
