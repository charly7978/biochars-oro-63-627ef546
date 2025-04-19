/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback, useState, useMemo } from 'react';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '@/modules/vital-signs/VitalSignsProcessor';
import { ResultFactory } from '@/modules/vital-signs/factories/result-factory';
import { useArrhythmiaVisualization } from '@/hooks/vital-signs/use-arrhythmia-visualization';
import { useVitalSignsLogging } from '@/hooks/vital-signs/use-vital-signs-logging';
import { ProcessedSignal } from '@/types/signal';
import { SignalOptimizerManager } from '@/modules/signal-optimizer/SignalOptimizerManager';
import { ChannelFeedback, SignalChannelOptimizerParams } from '@/modules/signal-optimizer/SignalChannelOptimizer';

// Definir los canales que usará el optimizador
const OPTIMIZER_CHANNELS = ['hr', 'spo2', 'bp', 'glucose', 'lipids', 'hydration', 'general'];

// Definición local si no está en archivo importado
interface ExtendedProcessedSignalForHook extends ProcessedSignal {
  preBandpassValue?: number;
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
  }

  /**
   * Procesa la señal PPG pre-procesada (post-OpenCV, Kalman, Bandpass).
   * Usa SignalOptimizerManager para obtener valores optimizados por canal.
   * Llama a VitalSignsProcessor con los valores optimizados.
   * Aplica feedback al SignalOptimizerManager.
   */
  const processSignal = useCallback((processedSignal: ProcessedSignal, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    if (!processorRef.current) {
      console.error("VitalSignsProcessor no inicializado.");
      return ResultFactory.createEmptyResults();
    }
    
    // Casting a tipo extendido para uso interno si es necesario
    const extendedSignal = processedSignal as ExtendedProcessedSignalForHook;

    processedSignals.current += 1;

    // --- Procesamiento con SignalOptimizerManager --- 
    const optimizedValues: Record<string, number> = {};
    for (const channel of OPTIMIZER_CHANNELS) {
      optimizedValues[channel] = optimizerManager.process(channel, extendedSignal.rawValue);
    }
    const primaryOptimizedValue = optimizedValues['general'] ?? extendedSignal.filteredValue;

    // --- Llamada a VitalSignsProcessor (Con la firma CORRECTA según VitalSignsProcessor.ts) --- 
    const result = processorRef.current.processSignal(
      primaryOptimizedValue,
      extendedSignal,
      rrData,
      optimizedValues
    );

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
        }
    }

    // --- Log y visualización --- 
    logSignalData(primaryOptimizedValue, result, processedSignals.current); 
    if (result.arrhythmiaStatus.includes('DETECTED') && result.lastArrhythmiaData) {
      addArrhythmiaWindow(result.lastArrhythmiaData.timestamp - 500, result.lastArrhythmiaData.timestamp + 500);
    }

    return result;
  }, [optimizerManager, logSignalData, addArrhythmiaWindow]);

  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number): void => {
    processorRef.current?.applyBloodPressureCalibration(systolic, diastolic);
    optimizerManager.applyFeedback('bp', { 
      metricType: 'bp', 
      quality: 100, 
      confidence: 1, 
      manualOverride: true, 
    });
  }, [optimizerManager]);

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
