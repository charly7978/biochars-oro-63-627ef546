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

const OPTIMIZER_CHANNELS = ['hr', 'spo2', 'bp', 'arrhythmia', 'glucose', 'lipids', 'hydration', 'hemoglobin', 'general'];

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

  const { 
    isReady: tfModelReady,
    predict: tfPredict,
    error: tfError
  } = useTensorFlowModel('vital-signs-ppg', true);

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
      arrhythmia: { gain: 1.3, filterType: 'ema', emaAlpha: 0.5 },
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

  const processSignal = useCallback(async (processedSignal: ProcessedSignal, rrData?: { intervals: number[], lastPeakTime: number | null }): Promise<VitalSignsResult> => {
    if (!processorRef.current || !processingEnabledRef.current) {
      console.warn("VitalSignsProcessor not initialized or processing disabled.");
      return ResultFactory.createEmptyResults();
    }

    const now = Date.now();
    if (now - lastProcessingTime.current < 30) { 
      if (lastValidResults) {
        return lastValidResults;
      }
    }
    lastProcessingTime.current = now;

    const extendedSignal = processedSignal as ExtendedProcessedSignalForHook;
    processedSignals.current += 1;

    const optimizedValues: Record<string, number> = {};

    for (const channel of OPTIMIZER_CHANNELS) {
      if (channel === 'arrhythmia' && rrData && rrData.intervals.length > 0) {
        optimizedValues[channel] = optimizerManager.process(channel, extendedSignal.rawValue);
      } else {
        optimizedValues[channel] = optimizerManager.process(channel, extendedSignal.rawValue);
      }
    }
    const primaryOptimizedValue = optimizedValues['general'] ?? extendedSignal.filteredValue;

    let tfEnhancedValue = primaryOptimizedValue;

    if (tfModelReady && processedSignals.current % 5 === 0) {
      try {
        const signalWindow = extendedSignal.windowValues || [primaryOptimizedValue];
        const minVal = extendedSignal.minValue !== undefined ? extendedSignal.minValue : 0;
        const maxVal = extendedSignal.maxValue !== undefined ? extendedSignal.maxValue : 1;
        const normalizedInput = signalWindow.slice(-64).map(val => (val - minVal) / (maxVal - minVal || 1));
        while (normalizedInput.length < 64) normalizedInput.unshift(0);

        const predictionPromise = tfPredict(normalizedInput);
        if (predictionPromise) {
          try {
            const prediction = await Promise.resolve(predictionPromise);
            if (prediction && prediction.length > 0) {
              const factor = prediction[0];
              tfEnhancedValue = primaryOptimizedValue * (1 + factor * 0.1);
              console.log("TF enhancement applied:", factor.toFixed(4));
            }
          } catch (e) {
            console.error("Error in TensorFlow prediction:", e);
          }
        }
      } catch (err) {
        console.error("Error during TensorFlow process:", err);
      }
    }

    if (rrData && rrData.intervals.length > 0 && processedSignals.current % 30 === 0) {
      console.log("RR Data for arrhythmia detection:", {
        intervalCount: rrData.intervals.length,
        lastIntervals: rrData.intervals.slice(-3),
        lastPeakTime: rrData.lastPeakTime
      });
    }

    const result = processorRef.current.processSignal(
      tfEnhancedValue, 
      extendedSignal, 
      rrData, 
      optimizedValues
    );

    setLastValidResults(result);

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
    if (result.arrhythmiaStatus && result.arrhythmiaStatus.includes('ARRHYTHMIA DETECTED')) {
      feedback['arrhythmia'].confidence = Math.max(feedback['arrhythmia'].confidence || 0, 0.9);
    }

    for (const channel of OPTIMIZER_CHANNELS) {
      if (feedback[channel]) {
        optimizerManager.applyFeedback(channel, feedback[channel]);
      }
    }

    if (processedSignals.current % 30 === 0) {
      console.log("VitalSignsProcessor Hook: Vital signs result snapshot at signal #", processedSignals.current, {
        spo2: result.spo2,
        pressure: result.pressure,
        glucose: result.glucose,
        lipids: result.lipids,
        hydration: result.hydration,
        hemoglobin: result.hemoglobin,
        arrhythmiaStatus: result.arrhythmiaStatus,
      });
    }

    logSignalData(primaryOptimizedValue, result, processedSignals.current);
    if (result.arrhythmiaStatus.includes('ARRHYTHMIA DETECTED') && result.lastArrhythmiaData) {
      addArrhythmiaWindow(result.lastArrhythmiaData.timestamp - 500, result.lastArrhythmiaData.timestamp + 500);
    }

    return result;
  }, [optimizerManager, logSignalData, addArrhythmiaWindow, lastValidResults, tfModelReady, tfPredict]);

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
    signalLog
  };
};
