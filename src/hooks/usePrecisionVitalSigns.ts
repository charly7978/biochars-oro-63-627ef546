
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para procesamiento de signos vitales con precisión mejorada
 * Integra calibración, validación cruzada y ajustes ambientales
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PrecisionVitalSignsProcessor, PrecisionVitalSignsResult } from '../modules/vital-signs/PrecisionVitalSignsProcessor';
import { CalibrationReference } from '../modules/vital-signs/calibration/CalibrationManager';
import type { ProcessedSignal } from '../types/signal';

/**
 * Estado del hook de signos vitales de precisión
 */
export interface PrecisionVitalSignsState {
  isProcessing: boolean;
  isCalibrated: boolean;
  lastResult: PrecisionVitalSignsResult | null;
  calibrationStatus: {
    hasReference: boolean;
    confidence: number;
  };
  environmentalStatus: {
    lightDetected: number;
    motionDetected: number;
  };
}

/**
 * Hook para gestionar signos vitales con precisión mejorada
 */
export function usePrecisionVitalSigns() {
  // Inicializar procesador
  const processorRef = useRef<PrecisionVitalSignsProcessor | null>(null);
  
  // Estado local
  const [state, setState] = useState<PrecisionVitalSignsState>({
    isProcessing: false,
    isCalibrated: false,
    lastResult: null,
    calibrationStatus: {
      hasReference: false,
      confidence: 0
    },
    environmentalStatus: {
      lightDetected: 50,
      motionDetected: 0
    }
  });
  
  // Access to raw and filtered signal data
  const [signalData, setSignalData] = useState({
    rawValue: 0,
    filteredValue: 0,
    signalQuality: 0,
    fingerDetected: false
  });
  
  // Inicializar procesador
  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new PrecisionVitalSignsProcessor();
      console.log("usePrecisionVitalSigns: Procesador inicializado");
    }
    
    return () => {
      if (processorRef.current) {
        processorRef.current.stop();
        processorRef.current = null;
      }
    };
  }, []);
  
  // Iniciar procesamiento
  const startProcessing = useCallback(() => {
    if (!processorRef.current) return;
    
    processorRef.current.start();
    
    setState(prev => ({
      ...prev,
      isProcessing: true
    }));
    
    console.log("usePrecisionVitalSigns: Procesamiento iniciado");
  }, []);
  
  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    if (!processorRef.current) return;
    
    processorRef.current.stop();
    
    setState(prev => ({
      ...prev,
      isProcessing: false
    }));
    
    console.log("usePrecisionVitalSigns: Procesamiento detenido");
  }, []);
  
  // Procesar señal
  const processSignal = useCallback((signal: ProcessedSignal): PrecisionVitalSignsResult | null => {
    if (!processorRef.current || !state.isProcessing) {
      return null;
    }
    
    try {
      // Update signal data state
      setSignalData({
        rawValue: signal.rawValue,
        filteredValue: signal.filteredValue,
        signalQuality: signal.quality,
        fingerDetected: signal.fingerDetected
      });
      
      // Procesar señal con precisión mejorada
      const result = processorRef.current.processSignal(signal);
      
      // Actualizar estado con el resultado
      setState(prev => ({
        ...prev,
        lastResult: result,
        isCalibrated: result.isCalibrated,
        calibrationStatus: {
          hasReference: result.isCalibrated,
          confidence: result.precisionMetrics.calibrationConfidence
        },
        environmentalStatus: {
          lightDetected: processorRef.current?.getDiagnostics().environmentalConditions.lightLevel || 50,
          motionDetected: processorRef.current?.getDiagnostics().environmentalConditions.motionLevel || 0
        }
      }));
      
      return result;
    } catch (error) {
      console.error("usePrecisionVitalSigns: Error procesando señal", error);
      return null;
    }
  }, [state.isProcessing]);
  
  // Agregar datos de referencia para calibración
  const addCalibrationReference = useCallback((reference: CalibrationReference): boolean => {
    if (!processorRef.current) return false;
    
    const success = processorRef.current.addCalibrationReference(reference);
    
    if (success) {
      // Actualizar estado de calibración
      setState(prev => ({
        ...prev,
        isCalibrated: processorRef.current?.isCalibrated() || false,
        calibrationStatus: {
          hasReference: true,
          confidence: processorRef.current?.getDiagnostics().calibrationFactors.confidence || 0
        }
      }));
    }
    
    return success;
  }, []);
  
  // Actualizar condiciones ambientales
  const updateEnvironment = useCallback((deviceLight: number, deviceMotion: number = 0) => {
    if (!processorRef.current) return;
    
    processorRef.current.updateEnvironmentalConditions({
      lightLevel: deviceLight,
      motionLevel: deviceMotion
    });
    
    setState(prev => ({
      ...prev,
      environmentalStatus: {
        lightDetected: deviceLight,
        motionDetected: deviceMotion
      }
    }));
    
  }, []);
  
  // Resetear estado
  const reset = useCallback(() => {
    if (!processorRef.current) return;
    
    processorRef.current.reset();
    setSignalData({
      rawValue: 0,
      filteredValue: 0,
      signalQuality: 0,
      fingerDetected: false
    });
    
    setState({
      isProcessing: false,
      isCalibrated: processorRef.current.isCalibrated(),
      lastResult: null,
      calibrationStatus: {
        hasReference: processorRef.current.isCalibrated(),
        confidence: processorRef.current.getDiagnostics().calibrationFactors.confidence
      },
      environmentalStatus: {
        lightDetected: 50,
        motionDetected: 0
      }
    });
    
    console.log("usePrecisionVitalSigns: Estado reiniciado");
  }, []);
  
  // Obtener diagnósticos
  const getDiagnostics = useCallback(() => {
    if (!processorRef.current) return null;
    
    return processorRef.current.getDiagnostics();
  }, []);
  
  return {
    ...state,
    ...signalData,
    startProcessing,
    stopProcessing,
    processSignal,
    addCalibrationReference,
    updateEnvironment,
    reset,
    getDiagnostics
  };
}
