
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook integrador para procesamiento de señales y extracción de signos vitales
 * Conecta los módulos de extracción con los de procesamiento
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { usePPGExtraction } from './usePPGExtraction';
import { useUnifiedSignalProcessor } from './useUnifiedSignalProcessor';
import { useUnifiedVitalSignsAdapter } from './vital-signs/useUnifiedVitalSignsAdapter';
import { ProcessedPPGSignal } from '../modules/signal-processing/unified/types';

/**
 * Resultado integrado del procesamiento completo
 */
export interface IntegratedVitalsResult {
  // Datos de señal
  timestamp: number;
  quality: number;
  fingerDetected: boolean;
  
  // Señales procesadas
  rawValue: number;
  filteredValue: number;
  amplifiedValue: number;
  
  // Información cardíaca
  heartRate: number;
  isPeak: boolean;
  rrInterval: number | null;
  
  // Signos vitales
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  arrhythmiaCount: number;
}

/**
 * Hook que integra extracción y procesamiento con procesadores unificados
 */
export function useVitalSignsWithProcessing() {
  // Hooks de extracción y procesamiento
  const extraction = usePPGExtraction();
  const processing = useUnifiedSignalProcessor();
  const vitalSigns = useUnifiedVitalSignsAdapter();
  
  // Estado integrado
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<IntegratedVitalsResult | null>(null);
  
  // Contadores y buffers
  const processedFramesRef = useRef<number>(0);
  const lastProcessTimeRef = useRef<number>(Date.now());
  
  /**
   * Procesa un frame completo de la cámara
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isMonitoring) return;
    
    try {
      // 1. Extraer valor PPG crudo del frame
      extraction.processFrame(imageData);
      
      // El procesamiento posterior se maneja en el useEffect
    } catch (error) {
      console.error("Error procesando frame:", error);
    }
  }, [isMonitoring, extraction]);
  
  /**
   * Realiza el procesamiento cuando hay un nuevo resultado de extracción
   */
  useEffect(() => {
    if (!isMonitoring || !extraction.lastResult) return;
    
    try {
      // 2. Procesar el valor PPG extraído con el procesador unificado
      // La función correcta es processFrame, no processSignal
      // Debemos extraer un número del objeto ImageData, no pasarlo directamente
      processing.processFrame(extraction.lastResult.filteredValue);
      
      // Verificar si tenemos una señal procesada y hay un dedo detectado
      if (processing.lastSignal && processing.lastSignal.fingerDetected) {
        // 3. Procesar para obtener signos vitales
        const vitalsResult = vitalSigns.processSignal(
          processing.lastSignal.filteredValue, 
          processing.getRRIntervals()
        );
        
        // 4. Crear resultado integrado
        const integratedResult: IntegratedVitalsResult = {
          timestamp: processing.lastSignal.timestamp,
          quality: processing.lastSignal.quality,
          fingerDetected: processing.lastSignal.fingerDetected,
          
          rawValue: processing.lastSignal.rawValue,
          filteredValue: processing.lastSignal.filteredValue,
          amplifiedValue: processing.lastSignal.amplifiedValue,
          
          heartRate: processing.lastSignal.instantaneousBPM || 0,
          isPeak: processing.lastSignal.isPeak,
          rrInterval: processing.lastSignal.rrInterval,
          
          spo2: vitalsResult.spo2,
          pressure: vitalsResult.pressure,
          arrhythmiaStatus: vitalsResult.arrhythmiaStatus.split('|')[0] || '--',
          arrhythmiaCount: parseInt(vitalsResult.arrhythmiaStatus.split('|')[1] || '0', 10)
        };
        
        // Actualizar resultado
        setLastResult(integratedResult);
        
        // Incrementar contador de frames procesados
        processedFramesRef.current++;
        lastProcessTimeRef.current = Date.now();
      }
    } catch (error) {
      console.error("Error en procesamiento integrado:", error);
    }
  }, [isMonitoring, extraction.lastResult, processing, vitalSigns]);
  
  /**
   * Inicia el monitoreo completo
   */
  const startMonitoring = useCallback(() => {
    console.log("useVitalSignsWithProcessing: Iniciando monitoreo");
    
    // Iniciar todos los subsistemas
    extraction.startProcessing();
    processing.startProcessing();
    vitalSigns.initializeProcessor();
    
    processedFramesRef.current = 0;
    lastProcessTimeRef.current = Date.now();
    
    setIsMonitoring(true);
  }, [extraction, processing, vitalSigns]);
  
  /**
   * Detiene el monitoreo completo
   */
  const stopMonitoring = useCallback(() => {
    console.log("useVitalSignsWithProcessing: Deteniendo monitoreo");
    
    // Detener todos los subsistemas
    extraction.stopProcessing();
    processing.stopProcessing();
    vitalSigns.reset();
    
    setIsMonitoring(false);
    setLastResult(null);
  }, [extraction, processing, vitalSigns]);
  
  /**
   * Reinicia completamente el sistema
   */
  const reset = useCallback(() => {
    console.log("useVitalSignsWithProcessing: Reiniciando sistema");
    
    stopMonitoring();
    
    // Reiniciar todos los subsistemas
    extraction.reset();
    processing.reset();
    vitalSigns.fullReset();
    
    processedFramesRef.current = 0;
    lastProcessTimeRef.current = Date.now();
  }, [extraction, processing, vitalSigns, stopMonitoring]);
  
  return {
    // Estado
    isMonitoring,
    lastResult,
    processedFrames: processedFramesRef.current,
    
    // Métricas de extracción
    signalQuality: processing.getSignalQuality().quality,
    fingerDetected: processing.lastSignal?.fingerDetected || false,
    heartRate: processing.lastSignal?.instantaneousBPM || 0,
    
    // Acciones
    processFrame,
    startMonitoring,
    stopMonitoring,
    reset
  };
}
