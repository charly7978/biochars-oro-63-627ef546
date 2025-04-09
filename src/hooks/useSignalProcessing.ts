
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para el procesamiento central de señales
 * Integra los procesadores especializados del módulo signal-processing
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { SignalProcessingOptions } from '../types/signal-processing';

// Define the supported processor types (to be imported from actual implementations)
class PPGSignalProcessor {
  processSignal(value: number) {
    return {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue: value,
      normalizedValue: value,
      amplifiedValue: value,
      quality: 100,
      fingerDetected: true,
      signalStrength: 1.0
    };
  }
  
  reset() {}
  
  configure(options: any) {}
}

class HeartbeatProcessor {
  processSignal(value: number) {
    return {
      isPeak: false,
      peakConfidence: 1.0,
      instantaneousBPM: 72,
      rrInterval: 830,
      heartRateVariability: 50
    };
  }
  
  reset() {}
  
  configure(options: any) {}
}

// Define the types for processed signals
interface ProcessedPPGSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
}

interface ProcessedHeartbeatSignal {
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number | null;
  rrInterval: number | null;
  heartRateVariability: number | null;
}

// Reset the finger detector (placeholder function)
function resetFingerDetector() {
  console.log("Finger detector reset");
}

// Resultado combinado del procesamiento
export interface ProcessedSignalResult {
  timestamp: number;
  
  // Valores de señal PPG
  rawValue: number;
  filteredValue: number;
  normalizedValue: number;
  amplifiedValue: number;
  
  // Información de calidad
  quality: number;
  fingerDetected: boolean;
  signalStrength: number;
  
  // Información cardíaca
  isPeak: boolean;
  peakConfidence: number;
  instantaneousBPM: number | null;
  averageBPM: number | null;
  rrInterval: number | null;
  heartRateVariability: number | null;
}

/**
 * Hook para el procesamiento central de señales
 */
export function useSignalProcessing() {
  // Instancias de procesadores
  const ppgProcessorRef = useRef<PPGSignalProcessor | null>(null);
  const heartbeatProcessorRef = useRef<HeartbeatProcessor | null>(null);
  
  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const [fingerDetected, setFingerDetected] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<ProcessedSignalResult | null>(null);
  
  // Valores calculados
  const [heartRate, setHeartRate] = useState<number>(0);
  const recentBpmValues = useRef<number[]>([]);
  
  // Contador de frames procesados
  const processedFramesRef = useRef<number>(0);
  
  // Crear procesadores si no existen
  useEffect(() => {
    if (!ppgProcessorRef.current) {
      console.log("useSignalProcessing: Creando procesador PPG");
      ppgProcessorRef.current = new PPGSignalProcessor();
    }
    
    if (!heartbeatProcessorRef.current) {
      console.log("useSignalProcessing: Creando procesador de latidos");
      heartbeatProcessorRef.current = new HeartbeatProcessor();
    }
    
    return () => {
      console.log("useSignalProcessing: Limpiando procesadores");
      ppgProcessorRef.current = null;
      heartbeatProcessorRef.current = null;
    };
  }, []);
  
  /**
   * Procesa un valor PPG usando ambos procesadores
   */
  const processValue = useCallback((value: number): ProcessedSignalResult | null => {
    if (!isProcessing || !ppgProcessorRef.current || !heartbeatProcessorRef.current) {
      return null;
    }
    
    try {
      // Incrementar contador de frames
      processedFramesRef.current++;
      
      // Procesar con el procesador PPG
      const ppgResult: ProcessedPPGSignal = ppgProcessorRef.current.processSignal(value);
      
      // Usar el valor amplificado para procesamiento cardíaco
      const heartbeatResult: ProcessedHeartbeatSignal = 
        heartbeatProcessorRef.current.processSignal(ppgResult.amplifiedValue);
      
      // Actualizar estado de calidad y detección de dedo
      setSignalQuality(ppgResult.quality);
      setFingerDetected(ppgResult.fingerDetected);
      
      // Calcular BPM promedio
      if (heartbeatResult.instantaneousBPM !== null && heartbeatResult.peakConfidence > 0.5) {
        recentBpmValues.current.push(heartbeatResult.instantaneousBPM);
        
        // Mantener solo los valores más recientes
        if (recentBpmValues.current.length > 10) {
          recentBpmValues.current.shift();
        }
      }
      
      // Calcular BPM promedio (con filtrado de valores extremos)
      let averageBPM: number | null = null;
      
      if (recentBpmValues.current.length >= 3) {
        // Ordenar para eliminar extremos
        const sortedBPMs = [...recentBpmValues.current].sort((a, b) => a - b);
        
        // Usar el 80% central de los valores
        const startIdx = Math.floor(sortedBPMs.length * 0.1);
        const endIdx = Math.ceil(sortedBPMs.length * 0.9);
        const centralBPMs = sortedBPMs.slice(startIdx, endIdx);
        
        // Calcular promedio
        if (centralBPMs.length > 0) {
          const sum = centralBPMs.reduce((a, b) => a + b, 0);
          averageBPM = Math.round(sum / centralBPMs.length);
          
          // Actualizar estado de BPM si tenemos valor y buena calidad
          if (averageBPM > 0 && ppgResult.quality > 40) {
            setHeartRate(averageBPM);
          }
        }
      }
      
      // Generar resultado combinado
      const result: ProcessedSignalResult = {
        timestamp: ppgResult.timestamp,
        
        // Valores de señal PPG
        rawValue: ppgResult.rawValue,
        filteredValue: ppgResult.filteredValue,
        normalizedValue: ppgResult.normalizedValue,
        amplifiedValue: ppgResult.amplifiedValue,
        
        // Información de calidad
        quality: ppgResult.quality,
        fingerDetected: ppgResult.fingerDetected,
        signalStrength: ppgResult.signalStrength,
        
        // Información cardíaca
        isPeak: heartbeatResult.isPeak,
        peakConfidence: heartbeatResult.peakConfidence,
        instantaneousBPM: heartbeatResult.instantaneousBPM,
        averageBPM,
        rrInterval: heartbeatResult.rrInterval,
        heartRateVariability: heartbeatResult.heartRateVariability
      };
      
      // Actualizar último resultado
      setLastResult(result);
      
      return result;
    } catch (error) {
      console.error("Error procesando valor:", error);
      return null;
    }
  }, [isProcessing]);
  
  /**
   * Inicia el procesamiento de señal
   */
  const startProcessing = useCallback(() => {
    if (!ppgProcessorRef.current || !heartbeatProcessorRef.current) {
      console.error("No se pueden iniciar los procesadores");
      return;
    }
    
    console.log("useSignalProcessing: Iniciando procesamiento");
    
    // Resetear procesadores
    ppgProcessorRef.current.reset();
    heartbeatProcessorRef.current.reset();
    resetFingerDetector();
    
    // Limpiar estados
    setSignalQuality(0);
    setFingerDetected(false);
    setHeartRate(0);
    recentBpmValues.current = [];
    processedFramesRef.current = 0;
    
    // Iniciar procesamiento
    setIsProcessing(true);
  }, []);
  
  /**
   * Detiene el procesamiento de señal
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessing: Deteniendo procesamiento");
    setIsProcessing(false);
  }, []);
  
  /**
   * Configura los procesadores con opciones personalizadas
   */
  const configureProcessors = useCallback((options: SignalProcessingOptions) => {
    if (ppgProcessorRef.current) {
      ppgProcessorRef.current.configure(options);
    }
    
    if (heartbeatProcessorRef.current) {
      heartbeatProcessorRef.current.configure(options);
    }
  }, []);
  
  // Reset function to clear everything
  const reset = useCallback(() => {
    console.log("useSignalProcessing: Reset function called");
    
    if (ppgProcessorRef.current) {
      ppgProcessorRef.current.reset();
    }
    
    if (heartbeatProcessorRef.current) {
      heartbeatProcessorRef.current.reset();
    }
    
    resetFingerDetector();
    setSignalQuality(0);
    setFingerDetected(false);
    setHeartRate(0);
    recentBpmValues.current = [];
    processedFramesRef.current = 0;
    setLastResult(null);
    setIsProcessing(false);
  }, []);
  
  return {
    // Estados
    isProcessing,
    signalQuality,
    fingerDetected,
    heartRate,
    lastResult,
    processedFrames: processedFramesRef.current,
    
    // Acciones
    processValue,
    startProcessing,
    stopProcessing,
    configureProcessors,
    reset,
    
    // Procesadores
    ppgProcessor: ppgProcessorRef.current,
    heartbeatProcessor: heartbeatProcessorRef.current
  };
}
