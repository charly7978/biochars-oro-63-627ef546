
/**
 * Hook para procesamiento de signos vitales
 * Integra los módulos de procesamiento, optimización y cálculo
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignalOptimizer } from './useSignalOptimizer';
import { useVitalSignsCalculator } from './useVitalSignsCalculator';
import { VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook que integra el procesamiento, optimización y cálculo de signos vitales
 */
export const useVitalSignsProcessor = () => {
  // Estado para resultados
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Optimizador multicanal
  const { 
    optimizeSignal, 
    optimizedValues,
    reset: resetOptimizer
  } = useSignalOptimizer();
  
  // Calculador de signos vitales con feedback bidireccional
  const {
    calculateVitalSigns,
    lastCalculation,
    visualizationData,
    reset: resetCalculator
  } = useVitalSignsCalculator();
  
  // Referencia para conteo de señales procesadas
  const processedSignals = useRef(0);
  
  // Procesar cálculos cuando cambian las señales optimizadas
  useEffect(() => {
    if (isProcessing && Object.values(optimizedValues).some(value => value !== null)) {
      const result = calculateVitalSigns();
      
      if (result) {
        // Transformar los objetos de cálculo a valores simples para VitalSignsResult
        const processedResult: VitalSignsResult = {
          spo2: typeof result.spo2.value === 'number' ? result.spo2.value : 0,
          pressure: typeof result.bloodPressure.value === 'string' ? result.bloodPressure.value : "--/--",
          arrhythmiaStatus: result.arrhythmia.status || "--",
          glucose: typeof result.glucose.value === 'number' ? result.glucose.value : 0,
          lipids: {
            totalCholesterol: typeof result.cholesterol.value === 'number' ? result.cholesterol.value : 0,
            triglycerides: typeof result.triglycerides.value === 'number' ? result.triglycerides.value : 0
          },
          confidence: {
            glucose: result.glucose.confidence,
            lipids: (result.cholesterol.confidence + result.triglycerides.confidence) / 2,
            overall: 0.7
          },
          lastArrhythmiaData: result.arrhythmia.data
        };
        
        console.log("VitalSignsProcessor: Resultados procesados", processedResult);
        setLastValidResults(processedResult);
      }
    }
  }, [optimizedValues, calculateVitalSigns, isProcessing]);
  
  /**
   * Procesa una señal PPG y calcula signos vitales
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal: boolean = false
  ) => {
    if (isWeakSignal) {
      return lastValidResults || {
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
    
    setIsProcessing(true);
    processedSignals.current++;
    
    try {
      // Registro diagnóstico periódico
      if (processedSignals.current % 45 === 0) {
        console.log("useVitalSignsProcessor: Procesando señal", {
          inputValue: value,
          rrDataPresent: !!rrData,
          rrIntervals: rrData?.intervals.length || 0,
          signalNumber: processedSignals.current,
          optimizedChannels: Object.keys(optimizedValues).filter(
            k => optimizedValues[k] !== null
          ).length
        });
      }
      
      // Procesar señal a través del optimizador multicanal
      if (value !== 0) {
        // Crear objeto de señal PPG para el optimizador
        const ppgSignal = {
          timestamp: Date.now(),
          rawValue: value,
          filteredValue: value,
          normalizedValue: value,
          amplifiedValue: value,
          quality: 80,
          fingerDetected: true,
          signalStrength: 80,
          // Añadir datos RR para optimizador de frecuencia cardíaca
          metadata: {
            rrIntervals: rrData?.intervals || [],
            lastPeakTime: rrData?.lastPeakTime
          }
        };
        
        // Optimizar señal para todos los canales
        optimizeSignal(ppgSignal);
      }
      
      // El cálculo se realiza en el efecto cuando cambian los valores optimizados
      
      // Asegurarse de que devolvemos valores simples, no objetos de cálculo
      return lastValidResults || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      return lastValidResults || {
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
  }, [optimizeSignal, lastValidResults, optimizedValues]);
  
  /**
   * Reinicia el procesador manteniendo último resultado
   */
  const reset = useCallback(() => {
    console.log("useVitalSignsProcessor: Reset iniciado");
    
    // Guardar último resultado válido
    const savedResults = lastValidResults;
    
    // Reiniciar optimizador y calculador
    resetOptimizer();
    resetCalculator();
    
    setIsProcessing(false);
    
    console.log("useVitalSignsProcessor: Reset completado");
    return savedResults;
  }, [lastValidResults, resetOptimizer, resetCalculator]);
  
  /**
   * Reinicio completo incluyendo historial
   */
  const fullReset = useCallback(() => {
    console.log("useVitalSignsProcessor: Full reset iniciado");
    
    resetOptimizer();
    resetCalculator();
    processedSignals.current = 0;
    setLastValidResults(null);
    setIsProcessing(false);
    
    console.log("useVitalSignsProcessor: Full reset completado");
  }, [resetOptimizer, resetCalculator]);
  
  /**
   * Obtiene información de visualización para gráficos
   */
  const getVisualizationData = useCallback(() => {
    return visualizationData;
  }, [visualizationData]);
  
  /**
   * Obtiene información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      optimizedChannelsAvailable: Object.keys(optimizedValues).filter(
        k => optimizedValues[k] !== null
      ),
      lastCalculation: lastCalculation,
      visualizationAvailable: !!visualizationData
    };
  }, [optimizedValues, lastCalculation, visualizationData]);
  
  return {
    processSignal,
    reset,
    fullReset,
    getVisualizationData,
    getDebugInfo,
    lastValidResults
  };
};
