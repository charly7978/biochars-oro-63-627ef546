/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../core/HeartBeatProcessor';
import { HeartBeatResult } from '../../core/types';
import { useCalibration } from './useCalibration';
import { useSignalQuality } from './useSignalQuality';
import { useArrhythmiaDetection } from './useArrhythmiaDetection';
import { useRRIntervalAnalysis } from './useRRIntervalAnalysis';
import { useHeartRateVariability } from './useHeartRateVariability';
import { useArtifactDetection } from './useArtifactDetection';
import { usePPGDataAnalysis } from './usePPGDataAnalysis';
import { useStressLevelEstimation } from './useStressLevelEstimation';
import { useHeartBeatLogging } from './useHeartBeatLogging';

/**
 * Hook para el procesamiento de la señal del latido cardíaco
 * Incluye calibración, análisis de calidad de la señal, detección de arritmias,
 * análisis del intervalo RR, variabilidad de la frecuencia cardíaca, detección de artefactos,
 * análisis de datos PPG y estimación del nivel de estrés.
 */
export const useHeartBeatProcessor = () => {
  // Estado para los resultados del latido cardíaco
  const [heartBeatResult, setHeartBeatResult] = useState<HeartBeatResult | null>(null);
  // Estado para indicar si el procesamiento está en curso
  const [isProcessing, setIsProcessing] = useState(false);
  // Referencia para el procesador de latidos cardíacos
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  // Referencia para el último valor de señal válido
  const lastValidSignalRef = useRef<number>(0);
  // Referencia para el contador de artefactos
  const artifactCounterRef = useRef<number>(0);
  // Referencia para el ID de sesión
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  // Referencia para el estado de procesamiento
  const isProcessingRef = useRef(false);

  // Hooks personalizados
  const {
    isCalibrating,
    startCalibration,
    endCalibration,
    calibrationProgress,
    calibrateProcessors,
    resetCalibration
  } = useCalibration();
  const { signalQuality, assessSignalQuality } = useSignalQuality();
  const { arrhythmiaStatus, detectArrhythmia } = useArrhythmiaDetection();
  const { rrIntervals, analyzeRRIntervals } = useRRIntervalAnalysis();
  const { hrvData, analyzeHRV } = useHeartRateVariability(rrIntervals);
  const { artifactDetected, detectArtifacts } = useArtifactDetection();
  const { ppgData, analyzePPGData } = usePPGDataAnalysis();
  const { stressLevel, estimateStressLevel } = useStressLevelEstimation(hrvData);
  const { logData, clearLog } = useHeartBeatLogging();

  // Inicialización del procesador de latidos cardíacos
  useEffect(() => {
    processorRef.current = new HeartBeatProcessor();
    console.log("useHeartBeatProcessor: Inicializando procesador", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });

    return () => {
      console.log("useHeartBeatProcessor: Limpiando procesador", {
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
      processorRef.current = null;
    };
  }, []);

  // Función para procesar la señal
  const processSignal = useCallback(
    (value: number) => {
      if (!processorRef.current) {
        console.warn("HeartBeatProcessor no está inicializado.");
        return null;
      }

      // Verificar si el valor de la señal es un número
      if (typeof value !== 'number') {
        console.error("Valor de señal inválido:", value);
        return null;
      }

      // Actualizar la última señal válida
      lastValidSignalRef.current = value;

      // Simular el procesamiento de la señal y obtener los resultados
      const result = processorRef.current.processSignal(value, isProcessingRef);

      // Registrar los datos
      logData(value, result, signalQuality, artifactDetected, stressLevel);

      // Actualizar el estado con los resultados del procesamiento
      setHeartBeatResult(result);

      // Devolver los resultados
      return result;
    },
    [logData, artifactDetected, signalQuality, stressLevel]
  );

  // Función para iniciar el procesamiento
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    isProcessingRef.current = true;
    console.log("Iniciando procesamiento de señal...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Función para detener el procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    isProcessingRef.current = false;
    console.log("Deteniendo procesamiento de señal...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Función para resetear el procesador
  const reset = useCallback(() => {
    console.warn("Reseteando el procesador y los estados...", {
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString()
    });
    resetCalibration();
    setHeartBeatResult(null);
    artifactCounterRef.current = 0;
    clearLog();
  }, [resetCalibration, clearLog]);

  return {
    heartBeatResult,
    isProcessing,
    startProcessing,
    stopProcessing,
    processSignal,
    signalQuality,
    artifactDetected,
    stressLevel,
    isCalibrating,
    startCalibration,
    endCalibration,
    calibrationProgress,
    calibrateProcessors,
    reset,
    arrhythmiaStatus,
    hrvData,
    ppgData
  };
};
