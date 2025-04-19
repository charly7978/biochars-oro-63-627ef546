
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

// Definir los canales que usará el optimizador
const OPTIMIZER_CHANNELS = ['hr', 'spo2', 'bp', 'glucose', 'lipids', 'hydration', 'general'];

// Definición local si no está en archivo importado
interface ExtendedProcessedSignalForHook extends ProcessedSignal {
  preBandpassValue?: number;
  // Añadimos propiedades que estaban faltando en la interfaz
  windowValues?: number[];
  minValue?: number;
  maxValue?: number;
}

/**
 * Hook principal para el procesamiento de signos vitales.
 * Orquesta SignalOptimizerManager y VitalSignsProcessor.
 * Solo utiliza datos reales sin simulación.
 */
export const useVitalSignsProcessor = () => {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const { arrhythmiaWindows, addArrhythmiaWindow, clearArrhythmiaWindows } = useArrhythmiaVisualization();
  const { logSignalData, clearLog, getSignalLog, signalLog } = useVitalSignsLogging();
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [processingEnabled, setProcessingEnabled] = useState<boolean>(true);
  const processingEnabledRef = useRef<boolean>(true);
  const lastProcessingTime = useRef<number>(0);
  
  // Integración TensorFlow para mejorar la precisión de los cálculos
  const { 
    isReady: tfModelReady,
    predict: tfPredict,
    error: tfError
  } = useTensorFlowModel('vital-signs-ppg', true);
  
  useEffect(() => {
    if (tfError) {
      console.error("Error en modelo TensorFlow:", tfError);
      toast.error("Error cargando modelo de análisis PPG");
    } else if (tfModelReady) {
      console.log("✅ Modelo TensorFlow listo para inferencia");
      toast.success("Modelo de análisis PPG cargado correctamente");
    }
  }, [tfModelReady, tfError]);

  // --- Inicio: SignalOptimizerManager --- 
  const optimizerManager = useMemo(() => {
    console.log("Initializing SignalOptimizerManager...");
    // Configuración inicial con tipos correctos
    const initialConfigs: Record<string, Partial<SignalChannelOptimizerParams>> = {
      hr: { gain: 1.5, filterType: 'kalman', kalmanQ: 0.08, kalmanR: 0.01 },
      spo2: { gain: 1.0, filterType: 'sma', filterWindow: 5 },
      bp: { gain: 1.8, filterType: 'kalman', kalmanQ: 0.1, kalmanR: 0.02 },
      glucose: { gain: 1.2, filterType: 'ema', emaAlpha: 0.3 },
      lipids: { gain: 1.1, filterType: 'ema', emaAlpha: 0.4 },
      hydration: { gain: 1.0, filterType: 'sma', filterWindow: 7 },
      general: { gain: 1.0, filterType: 'kalman', kalmanQ: 0.12, kalmanR: 0.008 }
    };
    return new SignalOptimizerManager(initialConfigs);
  }, []);
  // --- Fin: SignalOptimizerManager --- 

  // Inicializa el procesador de signos vitales una vez
  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
    console.log("useVitalSignsProcessor: VitalSignsProcessor instance created");
  }

  /**
   * Procesa la señal PPG pre-procesada (post-OpenCV, Kalman, Bandpass).
   * Usa SignalOptimizerManager para obtener valores optimizados por canal.
   * Llama a VitalSignsProcessor con los valores optimizados.
   * Aplica feedback al SignalOptimizerManager.
   */
  const processSignal = useCallback(async (
    processedSignal: ProcessedSignal, 
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): Promise<VitalSignsResult> => {
    if (!processorRef.current || !processingEnabledRef.current) {
      console.error("VitalSignsProcessor no inicializado o procesamiento desactivado.");
      return ResultFactory.createEmptyResults();
    }
    
    const now = Date.now();
    // Evitar cálculos excesivos que pueden sobrecargar el sistema
    if (now - lastProcessingTime.current < 30) { // 30ms mínimo entre procesados
      if (lastValidResults) {
        console.log("Skipping processing: Minimal interval not met");
        return lastValidResults;
      }
    }
    lastProcessingTime.current = now;
    
    // Casting a tipo extendido para uso interno si es necesario
    const extendedSignal = processedSignal as ExtendedProcessedSignalForHook;

    processedSignals.current += 1;

    console.log(`Processing signal #${processedSignals.current}`, {
      rawValue: extendedSignal.rawValue,
      filteredValue: extendedSignal.filteredValue,
      quality: extendedSignal.quality,
      fingerDetected: extendedSignal.fingerDetected,
      timestamp: new Date(extendedSignal.timestamp).toISOString(),
      rrDataAvailable: rrData !== undefined,
      rrIntervalsCount: rrData?.intervals.length ?? 0,
    });

    // --- Procesamiento con SignalOptimizerManager --- 
    const optimizedValues: Record<string, number> = {};
    for (const channel of OPTIMIZER_CHANNELS) {
      optimizedValues[channel] = optimizerManager.process(channel, extendedSignal.rawValue);
      console.log(`Optimized value for channel ${channel}: ${optimizedValues[channel].toFixed(4)}`);
    }
    const primaryOptimizedValue = optimizedValues['general'] ?? extendedSignal.filteredValue;
    console.log(`Primary optimized value used for processing: ${primaryOptimizedValue.toFixed(4)}`);

    // --- Opcional: Procesamiento TensorFlow si está disponible ---
    let tfEnhancedValue = primaryOptimizedValue;
    
    if (tfModelReady && processedSignals.current % 5 === 0) { // Reducir frecuencia de inferencia
      try {
        // Crear ventana de datos para TensorFlow
        const signalWindow = extendedSignal.windowValues || [primaryOptimizedValue];
        
        // Normalizar datos para entrada del modelo
        const normalizedInput = signalWindow.slice(-64).map(val => {
          const minVal = extendedSignal.minValue !== undefined ? extendedSignal.minValue : 0;
          const maxVal = extendedSignal.maxValue !== undefined ? extendedSignal.maxValue : 1;
          return (val - minVal) / ((maxVal - minVal) || 1);
        });
        
        // Rellenar array si es necesario
        while (normalizedInput.length < 64) {
          normalizedInput.unshift(0);
        }
        
        console.log("Starting TensorFlow inference with normalizedInput", normalizedInput.slice(-10));
        
        // Inferencia del modelo y manejo adecuado del resultado
        const predictionPromise = tfPredict(normalizedInput);
        if (predictionPromise) {
          try {
            const prediction = await Promise.resolve(predictionPromise);
            
            if (prediction && prediction.length > 0) {
              // Usar resultado para mejorar el valor optimizado
              const enhancementFactor = prediction[0];
              tfEnhancedValue = primaryOptimizedValue * (1 + enhancementFactor * 0.1);
              console.log("TF enhancement applied:", enhancementFactor.toFixed(4), "Enhanced value:", tfEnhancedValue.toFixed(4));
            }
          } catch (e) {
            console.error("Error procesando predicción TensorFlow:", e);
          }
        }
      } catch (err) {
        console.error("Error en procesamiento TensorFlow:", err);
      }
    }

    // --- DEBUG: Verificar si llegan datos RR para arrhythmia --- 
    if (rrData && rrData.intervals.length > 0 && processedSignals.current % 30 === 0) {
      console.log("RR data available for arrhythmia detection:", {
        intervalCount: rrData.intervals.length,
        lastIntervals: rrData.intervals.slice(-3),
        lastPeakTime: rrData.lastPeakTime
      });
    }

    // --- Llamada a VitalSignsProcessor (Con la firma CORRECTA según VitalSignsProcessor.ts) --- 
    const result = processorRef.current.processSignal(
      tfEnhancedValue || primaryOptimizedValue,  // Usar valor mejorado por TF si disponible
      extendedSignal,
      rrData,
      optimizedValues
    );

    // Ajuste: VitalSignsResult no tiene heartRate. Si quieres debug, muestra "arrhythmiaStatus" u otro disponible.
    console.log("VitalSignsProcessor results:", {
      // Removido heartRate por no existir en VitalSignsResult
      spo2: result.spo2,
      pressure: result.pressure,
      arrhythmiaStatus: result.arrhythmiaStatus,
      glucose: result.glucose,
      lipids: result.lipids,
      hydration: result.hydration,
      hemoglobin: result.hemoglobin,
    });

    // Actualizar siempre el estado 
    setLastValidResults(result);

    // --- Aplicar Feedback al Optimizador --- 
    const feedback: Record<string, ChannelFeedback> = {};
    const baseQuality = extendedSignal.quality;
    const baseConfidence = Math.max(0, Math.min(1, baseQuality / 85));
    OPTIMIZER_CHANNELS.forEach(channel => {
      feedback[channel] = { metricType: channel, quality: baseQuality, confidence: baseConfidence };
    });
    if (result.glucoseConfidence !== undefined) {
      feedback['glucose'].confidence = Math.max(baseConfidence * 0.5, result.glucoseConfidence);
    }
    if (result.lipidsConfidence !== undefined) {
      feedback['lipids'].confidence = Math.max(baseConfidence * 0.5, result.lipidsConfidence);
    }
    for (const channel of OPTIMIZER_CHANNELS) {
      if (feedback[channel]) {
        optimizerManager.applyFeedback(channel, feedback[channel]);
        console.log(`Feedback applied to channel ${channel}:`, feedback[channel]);
      }
    }

    // --- Debug: Resultados de signos vitales --- 
    if (processedSignals.current % 30 === 0) {
      console.log("Processed signals count: ", processedSignals.current);
      console.log("Current signal log size: ", signalLog.current.length);
      console.log("Results Snapshot:", result);
    }

    // --- Log y visualización --- 
    logSignalData(primaryOptimizedValue, result, processedSignals.current); 
    if (result.arrhythmiaStatus.includes('DETECTED') && result.lastArrhythmiaData) {
      addArrhythmiaWindow(result.lastArrhythmiaData.timestamp - 500, result.lastArrhythmiaData.timestamp + 500);
      console.log("Arrhythmia window added from", result.lastArrhythmiaData.timestamp - 500, "to", result.lastArrhythmiaData.timestamp + 500);
    }

    return result;
  }, [optimizerManager, logSignalData, addArrhythmiaWindow, lastValidResults, tfModelReady, tfPredict]);

  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number): void => {
    console.log(`Aplicando calibración de presión arterial: ${systolic}/${diastolic} mmHg`);
    processorRef.current?.applyBloodPressureCalibration(systolic, diastolic);
    optimizerManager.applyFeedback('bp', { 
      metricType: 'bp', 
      quality: 100, 
      confidence: 1.0 
    });
    toast.success(`Calibración de presión arterial aplicada: ${systolic}/${diastolic} mmHg`);
  }, [optimizerManager]);

  const pauseProcessing = useCallback(() => {
    setProcessingEnabled(false);
    processingEnabledRef.current = false;
    console.log("Procesamiento de signos vitales pausado");
  }, []);
  
  const resumeProcessing = useCallback(() => {
    setProcessingEnabled(true);
    processingEnabledRef.current = true;
    console.log("Procesamiento de signos vitales reanudado");
  }, []);

  const reset = useCallback(() => {
    const resetResult = processorRef.current?.reset() ?? null;
    processedSignals.current = 0;
    clearArrhythmiaWindows();
    clearLog();
    setLastValidResults(null);
    optimizerManager.resetAll();
    console.log("VitalSignsProcessor Hook: Reset completado.");
    return resetResult;
  }, [clearArrhythmiaWindows, clearLog, optimizerManager]);

  const fullReset = useCallback(() => {
    processorRef.current?.fullReset();
    processedSignals.current = 0;
    clearArrhythmiaWindows();
    clearLog();
    setLastValidResults(null);
    optimizerManager.resetAll();
    console.log("VitalSignsProcessor Hook: Full Reset completado.");
  }, [clearArrhythmiaWindows, clearLog, optimizerManager]);

  return {
    processSignal,
    reset,
    fullReset,
    applyBloodPressureCalibration,
    pauseProcessing,
    resumeProcessing,
    isProcessingEnabled: processingEnabled,
    isTensorFlowReady: tfModelReady,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() ?? 0,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: processedSignals.current,
      signalLog: getSignalLog(),
      optimizerParams: OPTIMIZER_CHANNELS.reduce((acc, channel) => {
        acc[channel] = optimizerManager.getParams(channel);
        return acc;
      }, {} as Record<string, any>)
    }
  };
};

