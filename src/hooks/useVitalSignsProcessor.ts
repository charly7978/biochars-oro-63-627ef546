
/**
 * Hook para procesamiento de signos vitales
 * Integra los módulos de procesamiento, optimización y cálculo
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../modules/vital-signs/VitalSignsProcessor';
import { useSignalOptimizer } from './useSignalOptimizer';
import { VitalSignChannel, FeedbackData } from '../modules/signal-optimization/types';

/**
 * Hook que integra el procesamiento, optimización y cálculo de signos vitales
 */
export const useVitalSignsProcessor = () => {
  // Referencias para instancias persistentes
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const lastValidResultsRef = useRef<VitalSignsResult | null>(null);
  
  // Estado para resultados actuales
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Optimizador de señal multicanal
  const { 
    optimizeSignal, 
    sendFeedback, 
    optimizedValues 
  } = useSignalOptimizer();
  
  /**
   * Inicializa el procesador
   */
  const initializeProcessor = useCallback(() => {
    console.log("useVitalSignsProcessor: Inicializando con optimizador multicanal");
    
    // Crear nueva instancia de procesador
    processorRef.current = new VitalSignsProcessor();
    
    // Reiniciar contadores
    processedSignals.current = 0;
  }, []);
  
  // Inicializar al montar componente
  useEffect(() => {
    initializeProcessor();
    
    return () => {
      processorRef.current = null;
    };
  }, [initializeProcessor]);
  
  /**
   * Procesa una señal PPG y calcula signos vitales
   * Utiliza el optimizador multicanal para procesar cada canal de forma independiente
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal: boolean = false
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
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
    
    // Incrementar contador de señales procesadas
    processedSignals.current++;
    
    // Si la señal es débil, retornar ceros
    if (isWeakSignal) {
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
    
    try {
      // Registro para diagnóstico
      if (processedSignals.current % 45 === 0) {
        console.log("useVitalSignsProcessor: Procesando señal", {
          inputValue: value,
          rrDataPresent: !!rrData,
          rrIntervals: rrData?.intervals.length || 0,
          arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
          signalNumber: processedSignals.current,
          optimizedChannels: Object.keys(optimizedValues).filter(
            k => optimizedValues[k as VitalSignChannel] !== null
          ).length
        });
      }
      
      // Procesar señal a través del optimizador multicanal si hay un valor PPG
      // El optimizador dividirá la señal en canales especializados
      if (optimizeSignal && value !== 0) {
        // Crear objeto de señal PPG para el optimizador
        const ppgSignal = {
          timestamp: Date.now(),
          rawValue: value,
          filteredValue: value,
          normalizedValue: value,
          amplifiedValue: value,
          quality: 80, // Valor temporal, en producción usaríamos la calidad real
          fingerDetected: true,
          signalStrength: 80 // Valor temporal
        };
        
        // Optimizar señal para todos los canales
        optimizeSignal(ppgSignal);
      }
      
      // Procesar señal directamente con los valores optimizados si están disponibles
      let result: VitalSignsResult;
      
      // Generar resultado usando valores optimizados de cada canal
      result = processorRef.current.processSignal(
        optimizedValues?.heartRate?.optimizedValue || value, 
        rrData
      );
      
      // Actualizar con valores de otros canales optimizados si están disponibles
      if (optimizedValues?.spo2?.optimizedValue !== undefined && optimizedValues.spo2 !== null) {
        const spo2Result = 
          processorRef.current.calculateSpo2(optimizedValues.spo2.optimizedValue);
        
        if (spo2Result > 0) {
          result.spo2 = spo2Result;
          
          // Enviar retroalimentación al optimizador
          sendFeedback({
            channel: 'spo2',
            confidence: spo2Result > 90 ? 0.8 : spo2Result > 80 ? 0.5 : 0.3,
            timestamp: Date.now()
          });
        }
      }
      
      // Actualizar presión arterial con canal optimizado
      if (optimizedValues?.bloodPressure?.optimizedValue !== undefined && 
          optimizedValues.bloodPressure !== null) {
        const bpResult = processorRef.current.calculateBloodPressure(
          optimizedValues.bloodPressure.optimizedValue,
          rrData?.intervals || []
        );
        
        if (bpResult !== "--/--") {
          result.pressure = bpResult;
          
          // Extraer valores numéricos para estimar confianza
          const [systolic, diastolic] = bpResult.split("/").map(Number);
          const confidence = 
            (systolic && diastolic && systolic > 80 && diastolic > 50) ? 0.7 : 0.4;
          
          // Enviar retroalimentación
          sendFeedback({
            channel: 'bloodPressure',
            confidence,
            timestamp: Date.now()
          });
        }
      }
      
      // Actualizar glucosa con canal optimizado
      if (optimizedValues?.glucose?.optimizedValue !== undefined && 
          optimizedValues.glucose !== null) {
        const glucoseResult = processorRef.current.calculateGlucose(
          optimizedValues.glucose.optimizedValue
        );
        
        if (glucoseResult > 0) {
          result.glucose = glucoseResult;
          
          // Enviar retroalimentación
          sendFeedback({
            channel: 'glucose',
            confidence: glucoseResult > 80 && glucoseResult < 200 ? 0.6 : 0.3,
            timestamp: Date.now()
          });
        }
      }
      
      // Actualizar lípidos con canales optimizados
      if (optimizedValues?.cholesterol?.optimizedValue !== undefined && 
          optimizedValues.cholesterol !== null) {
        const cholesterolResult = processorRef.current.calculateTotalCholesterol(
          optimizedValues.cholesterol.optimizedValue
        );
        
        if (cholesterolResult > 0) {
          result.lipids.totalCholesterol = cholesterolResult;
          
          // Enviar retroalimentación
          sendFeedback({
            channel: 'cholesterol',
            confidence: cholesterolResult > 100 && cholesterolResult < 240 ? 0.65 : 0.4,
            timestamp: Date.now()
          });
        }
      }
      
      if (optimizedValues?.triglycerides?.optimizedValue !== undefined && 
          optimizedValues.triglycerides !== null) {
        const triglyceridesResult = processorRef.current.calculateTriglycerides(
          optimizedValues.triglycerides.optimizedValue
        );
        
        if (triglyceridesResult > 0) {
          result.lipids.triglycerides = triglyceridesResult;
          
          // Enviar retroalimentación
          sendFeedback({
            channel: 'triglycerides',
            confidence: triglyceridesResult > 50 && triglyceridesResult < 200 ? 0.6 : 0.35,
            timestamp: Date.now()
          });
        }
      }
      
      // Almacenar último resultado válido para referencia
      if (result.spo2 > 0 || result.pressure !== "--/--" || result.glucose > 0) {
        lastValidResultsRef.current = { ...result };
        setLastValidResults(lastValidResultsRef.current);
      }
      
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      // Devolver último resultado válido o valores por defecto
      return lastValidResultsRef.current || {
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
  }, [optimizeSignal, optimizedValues, sendFeedback]);
  
  /**
   * Reinicia el procesador manteniendo último resultado
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated");
    
    processorRef.current.reset();
    
    console.log("useVitalSignsProcessor: Reset completed");
    return lastValidResultsRef.current;
  }, []);
  
  /**
   * Reinicio completo incluyendo historial
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated");
    
    processorRef.current.fullReset();
    processedSignals.current = 0;
    lastValidResultsRef.current = null;
    setLastValidResults(null);
    
    console.log("useVitalSignsProcessor: Full reset complete");
  }, []);
  
  /**
   * Obtiene el contador de arritmias
   */
  const getArrhythmiaCounter = useCallback(() => {
    return processorRef.current?.getArrhythmiaCounter() || 0;
  }, []);
  
  /**
   * Obtiene información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      optimizedChannelsAvailable: Object.keys(optimizedValues).filter(
        k => optimizedValues[k as VitalSignChannel] !== null
      )
    };
  }, [optimizedValues]);
  
  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    lastValidResults
  };
};
