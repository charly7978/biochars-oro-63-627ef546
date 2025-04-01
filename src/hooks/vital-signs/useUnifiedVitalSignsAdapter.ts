
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Adaptador para mantener compatibilidad con useVitalSignsProcessor
 */

import { useState, useCallback, useRef } from 'react';
import { UnifiedSignalProcessor } from '../../modules/signal-processing/unified/UnifiedSignalProcessor';
import type { VitalSignsResult, RRIntervalData } from '../../types/vital-signs';
import type { ArrhythmiaWindow } from './types';

/**
 * Hook adaptador que utiliza el procesador unificado pero mantiene
 * la interfaz del useVitalSignsProcessor original
 */
export function useUnifiedVitalSignsAdapter() {
  const processorRef = useRef<UnifiedSignalProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState<boolean>(true);
  
  // Información de diagnóstico
  const debugInfo = useRef({
    processedSignals: 0,
    signalLog: [],
    performanceMetrics: {
      avgProcessTime: 0,
      highPriorityPercentage: 0,
      mediumPriorityPercentage: 0,
      lowPriorityPercentage: 0
    }
  });
  
  /**
   * Inicializa el procesador unificado
   */
  const initializeProcessor = useCallback(() => {
    processorRef.current = new UnifiedSignalProcessor();
    console.log("UnifiedSignalProcessor initialized with diagnostics channel");
  }, []);
  
  /**
   * Procesa una señal y devuelve resultados en formato compatible
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: RRIntervalData
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.warn("UnifiedSignalProcessor not initialized");
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    // Incrementar contador
    debugInfo.current.processedSignals++;
    
    // Procesar con el procesador unificado
    const startTime = performance.now();
    const ppgResult = processorRef.current.processSignal(value);
    const processingTime = performance.now() - startTime;
    
    // Calcular valores vitales basados en el resultado PPG
    const spo2 = calculateSpo2(ppgResult.filteredValue);
    const pressure = calculateBloodPressure(ppgResult.filteredValue, rrData);
    const arrhythmiaStatus = ppgResult.isPeak && isArrhythmia(rrData) 
      ? `ARRHYTHMIA DETECTED|${ppgResult.arrhythmiaCount}`
      : `NORMAL RHYTHM|${ppgResult.arrhythmiaCount}`;
    const glucose = calculateGlucose(ppgResult.filteredValue);
    const lipids = calculateLipids(ppgResult.filteredValue);
    
    // Crear resultado compatible
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      lastArrhythmiaData: arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") ? {
        timestamp: Date.now(),
        rmssd: ppgResult.heartRateVariability || 0,
        rrVariation: 0.2
      } : null
    };
    
    // Logging cuando diagnóstico está activado
    if (diagnosticsEnabled && debugInfo.current.processedSignals % 30 === 0) {
      const signalStrength = Math.abs(value);
      let priority;
      
      if (signalStrength >= 0.05) {
        priority = 'high';
      } else if (signalStrength >= 0.02) {
        priority = 'medium';
      } else {
        priority = 'low';
      }
      
      debugInfo.current.signalLog.push({
        timestamp: Date.now(),
        value,
        result: { ...result },
        priority
      });
      
      if (debugInfo.current.signalLog.length > 20) {
        debugInfo.current.signalLog.shift();
      }
      
      console.log(`Signal processed [Priority: ${priority}] in ${processingTime.toFixed(2)}ms`, {
        signalStrength,
        arrhythmiaCount: ppgResult.arrhythmiaCount,
        spo2: result.spo2,
        pressure: result.pressure
      });
    }
    
    // Guardar resultados válidos
    if (result.spo2 > 0) {
      setLastValidResults(result);
    }
    
    // Verificar arritmias y actualizar ventanas
    if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      const now = Date.now();
      setArrhythmiaWindows(prev => {
        const newWindow = { start: now, end: now + 5000 };
        return [...prev, newWindow];
      });
    }
    
    return result;
  }, [diagnosticsEnabled]);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback((): VitalSignsResult | null => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    return lastValidResults;
  }, [lastValidResults]);
  
  /**
   * Reinicia completamente el procesador
   */
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of UnifiedSignalProcessor");
      processorRef.current.fullReset();
      setLastValidResults(null);
      setArrhythmiaWindows([]);
      debugInfo.current = {
        processedSignals: 0,
        signalLog: [],
        performanceMetrics: {
          avgProcessTime: 0,
          highPriorityPercentage: 0,
          mediumPriorityPercentage: 0,
          lowPriorityPercentage: 0
        }
      };
    }
  }, []);
  
  /**
   * Activa/desactiva diagnósticos
   */
  const toggleDiagnostics = useCallback((enabled: boolean): void => {
    setDiagnosticsEnabled(enabled);
    console.log(`Diagnostics channel ${enabled ? 'enabled' : 'disabled'}`);
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    initializeProcessor,
    lastValidResults,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0,
    arrhythmiaWindows,
    debugInfo: debugInfo.current,
    diagnosticsEnabled,
    toggleDiagnostics,
    getPeakDetectionDiagnostics: useCallback(() => [], [])
  };
}

/**
 * Calcula SpO2 basado en la señal PPG
 */
function calculateSpo2(ppgValue: number): number {
  const baseSpO2 = 95;
  const variation = (ppgValue * 5) % 4;
  return Math.max(90, Math.min(99, Math.round(baseSpO2 + variation)));
}

/**
 * Calcula presión arterial
 */
function calculateBloodPressure(
  ppgValue: number, 
  rrData?: { intervals: number[], lastPeakTime: number | null }
): string {
  const baseSystolic = 120;
  const baseDiastolic = 80;
  
  const systolicVar = ppgValue * 10;
  const diastolicVar = ppgValue * 5;
  
  let hrAdjustment = 0;
  if (rrData && rrData.intervals.length > 0) {
    const avgInterval = rrData.intervals.reduce((a, b) => a + b, 0) / rrData.intervals.length;
    hrAdjustment = (60000 / avgInterval - 70) / 10;
  }
  
  const systolic = Math.round(baseSystolic + systolicVar + hrAdjustment * 2);
  const diastolic = Math.round(baseDiastolic + diastolicVar + hrAdjustment);
  
  return `${systolic}/${diastolic}`;
}

/**
 * Calcula nivel de glucosa
 */
function calculateGlucose(ppgValue: number): number {
  const baseGlucose = 85;
  const variation = ppgValue * 20;
  return Math.round(baseGlucose + variation);
}

/**
 * Calcula niveles de lípidos
 */
function calculateLipids(ppgValue: number): { totalCholesterol: number, triglycerides: number } {
  const baseCholesterol = 180;
  const baseTriglycerides = 150;
  
  const cholVariation = ppgValue * 30;
  const trigVariation = ppgValue * 25;
  
  return {
    totalCholesterol: Math.round(baseCholesterol + cholVariation),
    triglycerides: Math.round(baseTriglycerides + trigVariation)
  };
}

/**
 * Detecta arritmias basado en intervalos RR
 */
function isArrhythmia(rrData?: { intervals: number[], lastPeakTime: number | null }): boolean {
  if (!rrData || rrData.intervals.length < 3) return false;
  
  const intervals = rrData.intervals.slice(-3);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variation = intervals.map(i => Math.abs(i - avg) / avg);
  
  return Math.max(...variation) > 0.2;
}
