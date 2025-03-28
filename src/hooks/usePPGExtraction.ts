
/**
 * Hook para extraer y procesar datos PPG
 * Integra todos los módulos de procesamiento y cálculo
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CameraFrameProcessor } from '../modules/camera/CameraFrameProcessor';
import { ProcessedPPGSignal } from '../modules/signal-processing/types';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';

interface PPGExtractionResult {
  rawValue: number;
  filteredValue: number;
  isPeak: boolean;
  bpm: number;
  signalQuality: number;
  fingerDetected: boolean;
  confidence: number;
  timestamp: number;
  vitalSignsData: any;
}

export const usePPGExtraction = () => {
  // Estado local
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<PPGExtractionResult | null>(null);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Referencias
  const frameProcessorRef = useRef<CameraFrameProcessor | null>(null);
  const signalCountRef = useRef(0);
  const calibrationProgressRef = useRef(0);
  
  // Integración con procesador de signos vitales
  const {
    processSignal,
    reset: resetVitalSigns,
    lastValidResults
  } = useVitalSignsProcessor();
  
  // Inicializar procesador de frames
  useEffect(() => {
    if (!frameProcessorRef.current) {
      frameProcessorRef.current = new CameraFrameProcessor();
      console.log("usePPGExtraction: Frame processor initializado");
    }
    
    return () => {
      if (frameProcessorRef.current) {
        frameProcessorRef.current.reset();
      }
    };
  }, []);
  
  // Reinicia el procesamiento
  const resetProcessing = useCallback(() => {
    if (frameProcessorRef.current) {
      frameProcessorRef.current.reset();
    }
    
    resetVitalSigns();
    setLastResult(null);
    setFingerDetected(false);
    setSignalQuality(0);
    signalCountRef.current = 0;
    calibrationProgressRef.current = 0;
    
    console.log("usePPGExtraction: Procesamiento reiniciado");
  }, [resetVitalSigns]);
  
  // Procesa un frame de imagen
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing || !frameProcessorRef.current) return;
    
    try {
      // Procesar frame a través del procesador
      const result = frameProcessorRef.current.processFrame(imageData);
      
      if (result) {
        const { ppgSignal, heartBeatData } = result;
        
        // Actualizar estado de detección de dedo
        setFingerDetected(ppgSignal.fingerDetected);
        
        // Actualizar calidad de señal
        setSignalQuality(ppgSignal.quality);
        
        // Actualizar calibración solo si hay dedo detectado
        if (ppgSignal.fingerDetected) {
          signalCountRef.current++;
          calibrationProgressRef.current = Math.min(1, signalCountRef.current / 50);
        }
        
        // Procesar señal para obtener signos vitales
        const vitalSigns = processSignal(
          ppgSignal.filteredValue,
          { intervals: heartBeatData.intervals, lastPeakTime: heartBeatData.lastPeakTime },
          !ppgSignal.fingerDetected || ppgSignal.quality < 30
        );
        
        // Crear resultado
        const extractionResult: PPGExtractionResult = {
          rawValue: ppgSignal.rawValue,
          filteredValue: ppgSignal.filteredValue,
          isPeak: heartBeatData.isPeak,
          bpm: vitalSigns?.spo2 || 0, // Usado como referencia temporal
          signalQuality: ppgSignal.quality,
          fingerDetected: ppgSignal.fingerDetected,
          confidence: 0.5, // Valor inicial, se mejorará más adelante
          timestamp: ppgSignal.timestamp,
          vitalSignsData: vitalSigns
        };
        
        // Actualizar resultado
        setLastResult(extractionResult);
      }
    } catch (error) {
      console.error("Error procesando frame:", error);
    }
  }, [isProcessing, processSignal]);
  
  // Maneja la llegada de un flujo de cámara
  const handleStreamReady = useCallback((stream: MediaStream) => {
    setIsCameraReady(true);
    console.log("usePPGExtraction: Stream de cámara listo");
  }, []);
  
  // Inicia el procesamiento
  const startProcessing = useCallback(() => {
    resetProcessing();
    setIsProcessing(true);
    console.log("usePPGExtraction: Procesamiento iniciado");
  }, [resetProcessing]);
  
  // Detiene el procesamiento
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    console.log("usePPGExtraction: Procesamiento detenido");
  }, []);
  
  // Alias para procesamiento de señal PPG desde módulos externos
  const handleProcessedSignal = useCallback((ppgSignal: ProcessedPPGSignal, heartBeatData: any) => {
    if (!isProcessing) return;
    
    try {
      // Actualizar estado de detección de dedo
      setFingerDetected(ppgSignal.fingerDetected);
      
      // Actualizar calidad de señal
      setSignalQuality(ppgSignal.quality);
      
      // Procesar señal para obtener signos vitales
      const vitalSigns = processSignal(
        ppgSignal.filteredValue,
        { intervals: heartBeatData.intervals, lastPeakTime: heartBeatData.lastPeakTime },
        !ppgSignal.fingerDetected || ppgSignal.quality < 30
      );
      
      // Crear resultado
      const extractionResult: PPGExtractionResult = {
        rawValue: ppgSignal.rawValue,
        filteredValue: ppgSignal.filteredValue,
        isPeak: ppgSignal.isPeak || false,
        bpm: vitalSigns?.spo2 || 0,
        signalQuality: ppgSignal.quality,
        fingerDetected: ppgSignal.fingerDetected,
        confidence: 0.5,
        timestamp: ppgSignal.timestamp,
        vitalSignsData: vitalSigns
      };
      
      // Actualizar resultado
      setLastResult(extractionResult);
    } catch (error) {
      console.error("Error procesando señal PPG:", error);
    }
  }, [isProcessing, processSignal]);
  
  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame,
    lastResult,
    fingerDetected,
    signalQuality,
    isCameraReady,
    handleStreamReady,
    handleProcessedSignal,
    calibrationProgress: calibrationProgressRef.current,
    vitalSignsData: lastValidResults
  };
};
