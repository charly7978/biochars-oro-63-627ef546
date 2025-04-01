
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Hook para signos vitales
 * Proporciona interfaz para procesamiento de signos vitales con arquitectura modular
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EventType, eventBus, useEventSubscription } from '../modules/events/EventBus';
import { VitalSignsResult } from '../modules/types/optimized-data';
import { cameraFrameReader } from '../modules/camera/CameraFrameReader';
import { heartBeatExtractor } from '../modules/extraction/HeartBeatExtractor';
import { ppgSignalExtractor } from '../modules/extraction/PPGSignalExtractor';
import { combinedSignalProvider } from '../modules/extraction/CombinedSignalProvider';
import { signalProcessor } from '../modules/processing/SignalProcessor';
import { signalOptimizer } from '../modules/optimization/SignalOptimizer';
import { vitalSignsCalculator } from '../modules/results/VitalSignsCalculator';
import { updateSignalLog } from '../utils/signalLogUtils';

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

interface ArrhythmiaWindow {
  start: number;
  end: number;
}

/**
 * Hook para procesamiento integral de signos vitales
 * Utiliza la arquitectura modular para proporcionar una interfaz unificada
 */
export const useVitalSignsProcessor = () => {
  // Estado
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Referencias para estado interno
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  // Inicialización
  useEffect(() => {
    console.log("useVitalSignsProcessor: Hook inicializado", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      // Detener todos los módulos al desmontar
      stopProcessing();
      
      console.log("useVitalSignsProcessor: Hook destruido", {
        sessionId: sessionId.current,
        señalesProcesadas: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  // Suscribirse a eventos de resultados
  useEventSubscription(EventType.VITAL_SIGNS_UPDATED, (result: VitalSignsResult) => {
    // Actualizar resultados válidos
    setLastValidResults(result);
    
    // Actualizar ventanas de arritmia si hay datos
    if (result.arrhythmiaData?.windows) {
      const formattedWindows = result.arrhythmiaData.windows.map(window => ({
        start: window[0],
        end: window[1]
      }));
      setArrhythmiaWindows(formattedWindows as any);
    }
    
    // Actualizar log
    const currentTime = Date.now();
    signalLog.current = updateSignalLog(
      signalLog.current, 
      currentTime, 
      result.heartRate, // usando la frecuencia cardíaca como valor de señal
      result, 
      processedSignals.current
    );
    
    processedSignals.current++;
  });
  
  /**
   * Procesar la señal
   * Esta función ahora coordina el procesamiento a través del sistema modular
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[]; lastPeakTime: number | null }) => {
    // En la nueva arquitectura, el procesamiento ocurre automáticamente
    // Esta función queda por compatibilidad, pero ya no maneja directamente el procesamiento
    
    // Registrar procesamiento (para debugging)
    console.log("useVitalSignsProcessor: Solicitud de procesamiento", {
      valorEntrada: value,
      rrDataPresente: !!rrData,
      intervalosRR: rrData?.intervals.length || 0,
      ultimosIntervalos: rrData?.intervals.slice(-3) || [],
      señalNúmero: processedSignals.current,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Retornar último resultado válido o valores por defecto
    return lastValidResults || {
      timestamp: Date.now(),
      heartRate: 0,
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      reliability: 0
    };
  }, [lastValidResults]);

  /**
   * Iniciar el procesamiento completo
   */
  const startProcessing = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      // Iniciar cámara
      const cameraStarted = await cameraFrameReader.startCamera();
      if (!cameraStarted) {
        setIsProcessing(false);
        throw new Error("No se pudo iniciar la cámara");
      }
      
      // Iniciar extracción
      heartBeatExtractor.startExtraction();
      ppgSignalExtractor.startExtraction();
      combinedSignalProvider.start();
      
      // Iniciar procesamiento
      signalProcessor.startProcessing();
      
      // Iniciar optimización
      signalOptimizer.start();
      
      // Comenzar lectura de frames
      cameraFrameReader.startFrameReading();
      
      setIsInitialized(true);
      console.log("useVitalSignsProcessor: Sistema completo iniciado");
      return true;
    } catch (error) {
      setIsProcessing(false);
      console.error("useVitalSignsProcessor: Error iniciando sistema", error);
      return false;
    }
  }, []);
  
  /**
   * Detener el procesamiento completo
   */
  const stopProcessing = useCallback(() => {
    // Detener en orden inverso
    signalOptimizer.stop();
    signalProcessor.stopProcessing();
    combinedSignalProvider.stop();
    ppgSignalExtractor.stopExtraction();
    heartBeatExtractor.stopExtraction();
    cameraFrameReader.stopFrameReading();
    
    setIsProcessing(false);
    console.log("useVitalSignsProcessor: Sistema completo detenido");
  }, []);

  /**
   * Soft reset: reiniciar los procesadores pero mantener resultados
   */
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo suave", {
      estadoAnterior: {
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null
      },
      timestamp: new Date().toISOString()
    });
    
    // Reiniciar procesadores pero no resultados
    signalProcessor.reset();
    signalOptimizer.reset();
    setArrhythmiaWindows([]);
    
    console.log("Reseteo suave completado - manteniendo resultados");
    return lastValidResults;
  }, [lastValidResults]);
  
  /**
   * Hard reset: borrar todos los resultados y reiniciar
   */
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reseteo completo", {
      estadoAnterior: {
        últimosResultados: lastValidResults ? {
          spo2: lastValidResults.spo2,
          presión: lastValidResults.pressure
        } : null,
        señalesProcesadas: processedSignals.current
      },
      timestamp: new Date().toISOString()
    });
    
    // Detener y reiniciar todo el sistema
    stopProcessing();
    setLastValidResults(null);
    setArrhythmiaWindows([]);
    processedSignals.current = 0;
    signalLog.current = [];
    setIsInitialized(false);
    
    console.log("Reseteo completo finalizado - borrando todos los resultados");
  }, [stopProcessing, lastValidResults]);

  return {
    processSignal,
    startProcessing,
    stopProcessing,
    reset,
    fullReset,
    lastValidResults,
    arrhythmiaWindows,
    isProcessing,
    isInitialized,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10)
    }
  };
};

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
