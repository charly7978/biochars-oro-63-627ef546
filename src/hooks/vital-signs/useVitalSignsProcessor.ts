
import { useState, useCallback, useRef, useEffect } from 'react';
import { useHeartBeatProcessor } from '../heart-beat/useHeartBeatProcessor';
import { useOxygenSaturationProcessor } from './mock-processors';
import { useRespirationRateProcessor } from './mock-processors';
import { useBloodPressureProcessor } from './mock-processors';
import { useStressLevelProcessor } from './mock-processors';
import { VitalSignsResult } from './types';

// Performance tracking interfaces
interface ProcessingPerformance {
  framesPerSecond: number;
  processingTime: number;
  lastUpdateTime: number;
}

interface VitalSignsProcessorState {
  processedSignals: number;
  signalLog: Array<{ timestamp: number; value: number; result: any }>;
  performance?: ProcessingPerformance;
}

/**
 * Hook centralizado para el procesamiento de todos los signos vitales
 * Coordina los diferentes procesadores y optimiza el rendimiento
 */
export const useVitalSignsProcessor = () => {
  // Estado para seguimiento de rendimiento y logs
  const [state, setState] = useState<VitalSignsProcessorState>({
    processedSignals: 0,
    signalLog: []
  });

  // Referencias para medición de rendimiento
  const lastProcessTimeRef = useRef<number>(0);
  const processingTimesRef = useRef<number[]>([]);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Procesadores individuales para cada signo vital
  const heartBeatProcessor = useHeartBeatProcessor();
  const oxygenSaturationProcessor = useOxygenSaturationProcessor();
  const respirationRateProcessor = useRespirationRateProcessor();
  const bloodPressureProcessor = useBloodPressureProcessor();
  const stressLevelProcessor = useStressLevelProcessor();

  // Procesar una señal PPG y calcular todos los signos vitales
  const processSignal = useCallback((value: number): VitalSignsResult => {
    const startTime = performance.now();
    
    // Registrar tiempo entre frames para cálculo de FPS
    const now = Date.now();
    if (lastFrameTimeRef.current > 0) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      
      // Mantener solo los últimos 30 frames para el cálculo
      if (frameTimesRef.current.length > 30) {
        frameTimesRef.current.shift();
      }
    }
    lastFrameTimeRef.current = now;
    
    // Procesar frecuencia cardíaca (componente principal)
    const heartBeatResult = heartBeatProcessor.processSignal(value);
    
    // Usar el resultado de frecuencia cardíaca para otros procesadores
    const oxygenResult = oxygenSaturationProcessor.processSignal();
    const respirationResult = respirationRateProcessor.processSignal();
    const bloodPressureResult = bloodPressureProcessor.processSignal();
    const stressResult = stressLevelProcessor.processSignal();
    
    // Resultado combinado de todos los signos vitales
    const result: VitalSignsResult = {
      heartRate: {
        bpm: heartBeatResult.bpm,
        confidence: heartBeatResult.confidence,
        isPeak: heartBeatResult.isPeak,
        isArrhythmia: heartBeatResult.isArrhythmia || false,
        arrhythmiaCount: heartBeatResult.arrhythmiaCount || 0
      },
      oxygenSaturation: {
        spO2: oxygenResult.spO2,
        confidence: oxygenResult.confidence
      },
      respirationRate: {
        rpm: respirationResult.rpm,
        confidence: respirationResult.confidence
      },
      bloodPressure: {
        systolic: bloodPressureResult.systolic,
        diastolic: bloodPressureResult.diastolic,
        confidence: bloodPressureResult.confidence
      },
      stressLevel: {
        level: stressResult.level,
        confidence: stressResult.confidence
      }
    };
    
    // Calcular tiempo de procesamiento
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    processingTimesRef.current.push(processingTime);
    
    // Mantener solo los últimos 30 tiempos de procesamiento
    if (processingTimesRef.current.length > 30) {
      processingTimesRef.current.shift();
    }
    
    // Actualizar estadísticas de rendimiento cada 30 frames
    if (state.processedSignals % 30 === 0) {
      // Calcular FPS basado en tiempos entre frames
      const avgFrameTime = frameTimesRef.current.reduce((sum, time) => sum + time, 0) / 
                          Math.max(1, frameTimesRef.current.length);
      const framesPerSecond = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
      
      // Calcular tiempo promedio de procesamiento
      const avgProcessingTime = processingTimesRef.current.reduce((sum, time) => sum + time, 0) / 
                               Math.max(1, processingTimesRef.current.length);
      
      // Actualizar métricas de rendimiento
      setState(prevState => ({
        ...prevState,
        performance: {
          framesPerSecond,
          processingTime: avgProcessingTime,
          lastUpdateTime: now
        }
      }));
    }
    
    // Actualizar log de señales (mantener solo los últimos 100 puntos)
    setState(prevState => {
      const newLog = [...prevState.signalLog, { timestamp: now, value, result }];
      if (newLog.length > 100) {
        newLog.shift();
      }
      
      return {
        processedSignals: prevState.processedSignals + 1,
        signalLog: newLog,
        performance: prevState.performance
      };
    });
    
    lastProcessTimeRef.current = now;
    
    return result;
  }, [
    heartBeatProcessor, 
    oxygenSaturationProcessor, 
    respirationRateProcessor, 
    bloodPressureProcessor, 
    stressLevelProcessor, 
    state.processedSignals
  ]);
  
  // Reiniciar todos los procesadores
  const reset = useCallback(() => {
    heartBeatProcessor.reset();
    oxygenSaturationProcessor.reset();
    respirationRateProcessor.reset();
    bloodPressureProcessor.reset();
    stressLevelProcessor.reset();
    
    // Reiniciar estado y métricas
    setState({
      processedSignals: 0,
      signalLog: []
    });
    
    processingTimesRef.current = [];
    frameTimesRef.current = [];
    lastFrameTimeRef.current = 0;
    lastProcessTimeRef.current = 0;
    
    console.log('VitalSignsProcessor: Todos los procesadores reiniciados');
  }, [
    heartBeatProcessor, 
    oxygenSaturationProcessor, 
    respirationRateProcessor, 
    bloodPressureProcessor, 
    stressLevelProcessor
  ]);
  
  // Iniciar monitoreo en todos los procesadores
  const startMonitoring = useCallback(() => {
    heartBeatProcessor.startMonitoring();
    // Otros procesadores pueden tener su propia lógica de inicio
    console.log('VitalSignsProcessor: Monitoreo iniciado');
  }, [heartBeatProcessor]);
  
  // Detener monitoreo en todos los procesadores
  const stopMonitoring = useCallback(() => {
    heartBeatProcessor.stopMonitoring();
    // Otros procesadores pueden tener su propia lógica de detención
    console.log('VitalSignsProcessor: Monitoreo detenido');
  }, [heartBeatProcessor]);
  
  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      stopMonitoring();
      console.log('VitalSignsProcessor: Recursos liberados');
    };
  }, [stopMonitoring]);
  
  return {
    processSignal,
    reset,
    startMonitoring,
    stopMonitoring,
    performance: state.performance,
    stats: {
      processedSignals: state.processedSignals,
      logLength: state.signalLog.length
    },
    // Exponer procesadores individuales para acceso directo si es necesario
    processors: {
      heartBeat: heartBeatProcessor,
      oxygenSaturation: oxygenSaturationProcessor,
      respirationRate: respirationRateProcessor,
      bloodPressure: bloodPressureProcessor,
      stressLevel: stressLevelProcessor
    }
  };
};
