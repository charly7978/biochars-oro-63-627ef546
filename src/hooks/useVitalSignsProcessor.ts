/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '@/modules/vital-signs/VitalSignsProcessor';
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';
import { useArrhythmiaVisualization } from '@/hooks/vital-signs/use-arrhythmia-visualization';
import { useVitalSignsLogging } from '@/hooks/vital-signs/use-vital-signs-logging';
import { ProcessedSignal } from '@/types/signal';
import { SignalOptimizerManager } from '@/modules/signal-optimizer/SignalOptimizerManager';
import { ChannelFeedback, SignalChannelOptimizerParams } from '@/modules/signal-optimizer/SignalChannelOptimizer';
import { useTensorFlowModel } from '@/hooks/useTensorFlowModel';
import { toast } from 'sonner';
import * as tf from '@tensorflow/tfjs';

// Añadir canales específicos para facilitar mantenimiento
const OPTIMIZER_CHANNELS = ['hr', 'spo2', 'bp', 'arrhythmia', 'glucose', 'lipids', 'hydration', 'hemoglobin', 'general'];
// Intervalo mínimo entre procesamientos principales para evitar sobrecarga
const MIN_PROCESSING_INTERVAL_MS = 30;
// Umbral para marcar una arritmia como alta confianza
const ARRHYTHMIA_HIGH_CONFIDENCE = 0.9;
// Frecuencia de logging de datos
const LOG_INTERVAL = 30;
// Frecuencia para usar TensorFlow
const TF_PREDICTION_INTERVAL = 5;
// Tamaño de la ventana de entrada para TensorFlow
const TF_INPUT_WINDOW_SIZE = 64;

interface ExtendedProcessedSignalForHook extends ProcessedSignal {
  preBandpassValue?: number;
  windowValues?: number[];
  minValue?: number;
  maxValue?: number;
}

export const useVitalSignsProcessor = () => {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const { arrhythmiaWindows, addArrhythmiaWindow, clearArrhythmiaWindows } = useArrhythmiaVisualization();
  const { logSignalData, clearLog, getSignalLog, signalLog } = useVitalSignsLogging();
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [processingEnabled, setProcessingEnabled] = useState<boolean>(true);
  const processingEnabledRef = useRef<boolean>(true);
  const lastProcessingTime = useRef<number>(0);
  // Añadir referencia para el buffer de señales para TensorFlow
  const tfInputBuffer = useRef<number[]>([]);
  // Mantener últimos resultados de TF para optimización
  const lastTfPrediction = useRef<number | null>(null);

  const { 
    isReady: tfModelReady,
    predict: tfPredict,
    error: tfError
  } = useTensorFlowModel('vital-signs-ppg', true);

  // Optimización de TensorFlow mediante estrategia de memoria
  useEffect(() => {
    if (tfModelReady) {
      try {
        tf.env().set('WEBGL_CPU_FORWARD', false);
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        console.log("✅ TensorFlow memory optimizations applied");
      } catch (err) {
        console.warn("Could not apply TensorFlow memory optimizations:", err);
      }
    }
  }, [tfModelReady]);

  useEffect(() => {
    if (tfError) {
      console.error("Error in TensorFlow model:", tfError);
      toast.error("Error cargando modelo de análisis PPG");
    } else if (tfModelReady) {
      console.log("✅ Modelo TensorFlow listo para inferencia");
      toast.success("Modelo de análisis PPG cargado correctamente");
    }
  }, [tfModelReady, tfError]);

  const optimizerManager = useMemo(() => {
    console.log("Initializing SignalOptimizerManager with arrhythmia channel included...");
    const initialConfigs: Record<string, Partial<SignalChannelOptimizerParams>> = {
      hr: { gain: 1.5, filterType: 'kalman', kalmanQ: 0.08, kalmanR: 0.01 },
      spo2: { gain: 1.0, filterType: 'sma', filterWindow: 5 },
      bp: { gain: 1.8, filterType: 'kalman', kalmanQ: 0.1, kalmanR: 0.02 },
      arrhythmia: { gain: 1.3, filterType: 'kalman', kalmanQ: 0.12, kalmanR: 0.008 },
      glucose: { gain: 1.2, filterType: 'ema', emaAlpha: 0.3 },
      lipids: { gain: 1.1, filterType: 'ema', emaAlpha: 0.4 },
      hydration: { gain: 1.0, filterType: 'sma', filterWindow: 7 },
      hemoglobin: { gain: 1.0, filterType: 'sma', filterWindow: 7 },
      general: { gain: 1.0, filterType: 'kalman', kalmanQ: 0.12, kalmanR: 0.008 }
    };
    return new SignalOptimizerManager(initialConfigs);
  }, []);

  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
  }

  // Función auxiliar para normalizar un vector
  const normalizeSignal = useCallback((signalWindow: number[], minVal?: number, maxVal?: number): number[] => {
    const min = minVal !== undefined ? minVal : Math.min(...signalWindow);
    const max = maxVal !== undefined ? maxVal : Math.max(...signalWindow);
    const range = max - min || 1; // Evitar división por cero
    return signalWindow.map(val => (val - min) / range);
  }, []);

  // Función mejorada para predicción TensorFlow con caché
  const predictWithTensorFlow = useCallback(async (
    signalWindow: number[], 
    minVal?: number, 
    maxVal?: number
  ): Promise<number | null> => {
    if (!tfModelReady || !tfPredict) return null;
    try {
      const normalizedInput = normalizeSignal(
        signalWindow.slice(-TF_INPUT_WINDOW_SIZE), 
        minVal, 
        maxVal
      );
      const paddedInput = Array(TF_INPUT_WINDOW_SIZE).fill(0);
      normalizedInput.forEach((val, idx) => {
        paddedInput[paddedInput.length - normalizedInput.length + idx] = val;
      });
      const startTime = performance.now();
      // tfPredict espera un array de números y devuelve un array de números
      const prediction = await tfPredict(paddedInput);
      if (Array.isArray(prediction) && prediction.length > 0) {
        const factor = prediction[0];
        lastTfPrediction.current = factor;
        const duration = performance.now() - startTime;
        if (processedSignals.current % LOG_INTERVAL === 0) {
          console.log(`TF inference completed in ${duration.toFixed(2)}ms, factor: ${factor.toFixed(4)}`);
        }
        return factor;
      }
      return lastTfPrediction.current;
    } catch (err) {
      console.error("Error during TensorFlow prediction:", err);
      return lastTfPrediction.current;
    }
  }, [tfModelReady, tfPredict, normalizeSignal]);

  const processSignal = useCallback(async (processedSignal: ProcessedSignal, rrData?: { intervals: number[], lastPeakTime: number | null }): Promise<VitalSignsResult> => {
    if (!processorRef.current || !processingEnabledRef.current) {
      console.warn("VitalSignsProcessor not initialized or processing disabled.");
      return ResultFactory.createEmptyResults();
    }

    const now = Date.now();
    if (now - lastProcessingTime.current < MIN_PROCESSING_INTERVAL_MS) { 
      if (lastValidResults) {
        return lastValidResults;
      }
    }
    lastProcessingTime.current = now;

    const extendedSignal = processedSignal as ExtendedProcessedSignalForHook;
    processedSignals.current += 1;

    // Almacenar valores para TensorFlow
    if (extendedSignal.filteredValue !== undefined) {
      tfInputBuffer.current.push(extendedSignal.filteredValue);
      // Mantener tamaño de buffer controlado
      if (tfInputBuffer.current.length > TF_INPUT_WINDOW_SIZE * 2) {
        tfInputBuffer.current = tfInputBuffer.current.slice(-TF_INPUT_WINDOW_SIZE * 2);
      }
    }

    // Optimización multicanal mejorada
    const optimizedValues: Record<string, number> = {};
    for (const channel of OPTIMIZER_CHANNELS) {
      if (channel === 'arrhythmia' && rrData && rrData.intervals.length > 0) {
        // Usar datos RR para mejor detección de arritmias
        const lastRR = rrData.intervals[rrData.intervals.length - 1] || 0;
        const baseValue = extendedSignal.rawValue;
        const rrVariability = rrData.intervals.length > 2 ? 
          Math.abs(rrData.intervals[rrData.intervals.length - 1] - rrData.intervals[rrData.intervals.length - 2]) / lastRR : 0;
        
        // Ajustar valor en base a variabilidad RR para mejorar detección de arritmias
        const adjustedValue = baseValue * (1 + rrVariability);
        optimizedValues[channel] = optimizerManager.process(channel, adjustedValue);
      } else {
        optimizedValues[channel] = optimizerManager.process(channel, extendedSignal.rawValue);
      }
    }
    
    const primaryOptimizedValue = optimizedValues['general'] ?? extendedSignal.filteredValue;

    // TensorFlow con procesamiento condicional optimizado
    let tfEnhancedValue = primaryOptimizedValue;
    if (tfModelReady && processedSignals.current % TF_PREDICTION_INTERVAL === 0) {
      try {
        // Usar buffer dedicado para mejor rendimiento
        const tfInputData = tfInputBuffer.current.length >= TF_INPUT_WINDOW_SIZE ? 
          tfInputBuffer.current : extendedSignal.windowValues || [primaryOptimizedValue];
        
        const minVal = extendedSignal.minValue !== undefined ? extendedSignal.minValue : 0;
        const maxVal = extendedSignal.maxValue !== undefined ? extendedSignal.maxValue : 1;
        
        const factor = await predictWithTensorFlow(tfInputData, minVal, maxVal);
        if (factor !== null) {
          // Aplicar factor con limitación de valor para evitar cambios bruscos
          const limitedFactor = Math.max(-0.15, Math.min(0.15, factor));
          tfEnhancedValue = primaryOptimizedValue * (1 + limitedFactor);
        }
      } catch (err) {
        console.error("Error en procesamiento TensorFlow:", err);
      }
    }

    // Logging mejorado de datos RR para detección de arritmias
    if (rrData && rrData.intervals.length > 0 && processedSignals.current % LOG_INTERVAL === 0) {
      const lastIntervals = rrData.intervals.slice(-5);
      const rmssd = lastIntervals.length > 1 ? 
        Math.sqrt(lastIntervals.slice(1).reduce((sum, val, i) => 
          sum + Math.pow(val - lastIntervals[i], 2), 0) / (lastIntervals.length - 1)) : 0;
        
      console.log("RR Data:", {
        intervalCount: rrData.intervals.length,
        lastIntervals,
        lastPeakTime: rrData.lastPeakTime,
        rmssd: rmssd.toFixed(2) // Añadir RMSSD como métrica para arritmias
      });
    }

    // Procesamiento principal con valor mejorado
    const result = processorRef.current.processSignal(
      tfEnhancedValue, 
      extendedSignal, 
      rrData, 
      optimizedValues
    );

    setLastValidResults(result);

    // Sistema de feedback mejorado con mejor detección de calidad
    const feedback: Record<string, ChannelFeedback> = {};
    const baseQuality = extendedSignal.quality;
    // Calcular confianza con curva sigmoidea para mejor sensibilidad
    const baseConfidence = 1 / (1 + Math.exp(-0.05 * (baseQuality - 50)));
    
    // Inicializar feedback para todos los canales
    OPTIMIZER_CHANNELS.forEach(channel => {
      feedback[channel] = { 
        metricType: channel, 
        quality: baseQuality,
        confidence: baseConfidence 
      };
    });

    // Ajustar feedback específico por tipo de señal
    if (result.glucoseConfidence !== undefined) {
      feedback['glucose'].confidence = Math.max(baseConfidence * 0.5, result.glucoseConfidence);
    }
    if (result.lipidsConfidence !== undefined) {
      feedback['lipids'].confidence = Math.max(baseConfidence * 0.5, result.lipidsConfidence);
    }
    
    // Detección mejorada de arritmias con análisis de patrones
    if (result.arrhythmiaStatus) {
      if (result.arrhythmiaStatus.includes('ARRHYTHMIA DETECTED')) {
        feedback['arrhythmia'].confidence = ARRHYTHMIA_HIGH_CONFIDENCE;
        feedback['hr'].confidence = Math.max(0.7, feedback['hr'].confidence); // Aumentar confianza HR también
      } else if (result.arrhythmiaStatus.includes('POSSIBLE ARRHYTHMIA')) {
        feedback['arrhythmia'].confidence = Math.max(0.6, feedback['arrhythmia'].confidence);
      }
    }

    // Aplicar feedback a todos los canales con manejo de errores
    for (const channel of OPTIMIZER_CHANNELS) {
      if (feedback[channel]) {
        try {
          optimizerManager.applyFeedback(channel, feedback[channel]);
        } catch (err) {
          console.error(`Error applying feedback to channel ${channel}:`, err);
        }
      }
    }

    // Logging periódico para monitoreo de rendimiento
    if (processedSignals.current % LOG_INTERVAL === 0) {
      console.log("VitalSignsProcessor Hook: Results snapshot #", processedSignals.current, {
        spo2: result.spo2,
        pressure: result.pressure,
        glucose: result.glucose,
        lipids: result.lipids,
        hydration: result.hydration,
        hemoglobin: result.hemoglobin,
        arrhythmiaStatus: result.arrhythmiaStatus,
        qualityIndicator: baseQuality,
        tfModelActive: tfModelReady
      });
    }

    // Logging y análisis de arritmias
    logSignalData(primaryOptimizedValue, result, processedSignals.current);
    if (result.arrhythmiaStatus.includes('ARRHYTHMIA DETECTED') && result.lastArrhythmiaData) {
      // Ventana ampliada para mejor visualización
      addArrhythmiaWindow(
        result.lastArrhythmiaData.timestamp - 500, 
        result.lastArrhythmiaData.timestamp + 500
      );
    }

    return result;
  }, [optimizerManager, logSignalData, addArrhythmiaWindow, lastValidResults, tfModelReady, predictWithTensorFlow]);

  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number): void => {
    console.log(`Applying blood pressure calibration: ${systolic}/${diastolic} mmHg`);
    processorRef.current?.applyBloodPressureCalibration(systolic, diastolic);
    optimizerManager.applyFeedback('bp', { 
      metricType: 'bp', 
      quality: 100, 
      confidence: 1, 
      manualOverride: true, 
    });
    toast.success(`Calibración de presión arterial aplicada: ${systolic}/${diastolic} mmHg`);
  }, [optimizerManager]);

  const pauseProcessing = useCallback(() => {
    setProcessingEnabled(false);
    processingEnabledRef.current = false;
    console.log("Vital signs processing paused");
  }, []);

  const resumeProcessing = useCallback(() => {
    setProcessingEnabled(true);
    processingEnabledRef.current = true;
    console.log("Vital signs processing resumed");
  }, []);

  const reset = useCallback(() => {
    const resetResult = processorRef.current?.reset() ?? null;
    processedSignals.current = 0;
    clearArrhythmiaWindows();
    clearLog();
    setLastValidResults(null);
    optimizerManager.resetAll();
    // Reset del buffer de TensorFlow
    tfInputBuffer.current = [];
    lastTfPrediction.current = null;
    console.log("VitalSignsProcessor Hook: Reset completed.");
    return resetResult;
  }, [clearArrhythmiaWindows, clearLog, optimizerManager]);

  const fullReset = useCallback(() => {
    processorRef.current?.fullReset();
    processedSignals.current = 0;
    clearArrhythmiaWindows();
    clearLog();
    setLastValidResults(null);
    optimizerManager.resetAll();
    // Reset del buffer de TensorFlow
    tfInputBuffer.current = [];
    lastTfPrediction.current = null;
    console.log("VitalSignsProcessor Hook: Full Reset completed.");
  }, [clearArrhythmiaWindows, clearLog, optimizerManager]);

  return {
    processSignal,
    applyBloodPressureCalibration,
    reset,
    fullReset,
    pauseProcessing,
    resumeProcessing,
    lastValidResults,
    processingEnabled,
    arrhythmiaWindows,
    getSignalLog,
    signalLog,
    tensorFlowReady: tfModelReady,
    tensorFlowError: tfError
  };
};
