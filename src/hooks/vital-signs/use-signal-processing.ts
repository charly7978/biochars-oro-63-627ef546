
import { useState, useRef, useCallback, useEffect } from 'react';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaWindow } from './types';

/**
 * Hook para procesamiento avanzado de señales biométricas
 */
export const useSignalProcessing = () => {
  // State para procesador y datos
  const [isProcessing, setIsProcessing] = useState(false);
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  
  // Referencias para datos persistentes
  const vitalSignsProcessor = useRef<VitalSignsProcessor | null>(null);
  const ppgBuffer = useRef<number[]>([]);
  const processedSignals = useRef<number>(0);
  const debugInfo = useRef<{
    lastUpdateTime: number;
    peakCount: number;
    avgSignalValue: number;
    [key: string]: any;
  }>({
    lastUpdateTime: 0,
    peakCount: 0,
    avgSignalValue: 0
  });
  
  // Inicializar procesador
  useEffect(() => {
    if (!vitalSignsProcessor.current) {
      vitalSignsProcessor.current = new VitalSignsProcessor();
      console.log("useSignalProcessing: Procesador inicializado");
    }
    
    return () => {
      console.log("useSignalProcessing: Limpieza");
    };
  }, []);
  
  /**
   * Iniciar el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    processedSignals.current = 0;
    setArrhythmiaCounter(0);
    ppgBuffer.current = [];
    console.log("useSignalProcessing: Iniciando procesamiento");
  }, []);
  
  /**
   * Detener el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    console.log("useSignalProcessing: Deteniendo procesamiento");
  }, []);
  
  /**
   * Procesar una señal PPG
   */
  const processSignal = useCallback((value: number) => {
    if (!isProcessing || !vitalSignsProcessor.current) {
      return null;
    }
    
    // Actualizar contadores
    processedSignals.current++;
    
    // Almacenar en buffer circular
    ppgBuffer.current.push(value);
    if (ppgBuffer.current.length > 300) {
      ppgBuffer.current.shift();
    }
    
    // Calcular calidad de señal básica
    if (ppgBuffer.current.length > 20) {
      const recentValues = ppgBuffer.current.slice(-20);
      const amplitude = Math.max(...recentValues) - Math.min(...recentValues);
      const normQuality = Math.min(100, Math.max(0, amplitude * 500));
      setSignalQuality(normQuality);
    }
    
    // Procesar señal (sin usar rrData aquí)
    try {
      const result = vitalSignsProcessor.current.processSignal(value);
      
      // Actualizar información de depuración
      debugInfo.current = {
        ...debugInfo.current,
        lastUpdateTime: Date.now(),
        signalValue: value,
        resultSpo2: result.spo2,
        resultPressure: result.pressure,
        bufferLength: ppgBuffer.current.length
      };
      
      // Actualizar contador de arritmias si se detecta
      if (result.arrhythmiaStatus === "Detectada") {
        setArrhythmiaCounter(prev => prev + 1);
      }
      
      return result;
    } catch (error) {
      console.error("useSignalProcessing: Error procesando señal", error);
      return null;
    }
  }, [isProcessing]);
  
  /**
   * Obtener ventanas de arritmia
   */
  const getArrhythmiaWindows = useCallback((): ArrhythmiaWindow[] => {
    return [];
  }, []);
  
  /**
   * Obtener información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      ...debugInfo.current,
      processedSignals: processedSignals.current,
      ppgBufferLength: ppgBuffer.current.length,
      arrhythmiaCounter,
      processorActive: !!vitalSignsProcessor.current,
      signalLog: [] // Añadimos signalLog vacío para cumplir con el tipo esperado
    };
  }, [arrhythmiaCounter]);
  
  /**
   * Reset completo
   */
  const reset = useCallback(() => {
    if (vitalSignsProcessor.current) {
      vitalSignsProcessor.current.reset();
    }
    
    processedSignals.current = 0;
    ppgBuffer.current = [];
    setArrhythmiaCounter(0);
    setSignalQuality(0);
    
    console.log("useSignalProcessing: Reset realizado");
  }, []);
  
  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    processSignal,
    signalQuality,
    arrhythmiaCounter,
    getArrhythmiaWindows,
    getDebugInfo,
    reset
  };
};
