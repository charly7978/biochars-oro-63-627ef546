
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { useState, useEffect, useCallback } from 'react';
import { ppgSignalService } from '../services/PPGSignalService';
import type { ProcessedSignal } from '../types/signal';

/**
 * Hook refactorizado que utiliza el servicio centralizado para el procesamiento de señal PPG
 * Proporciona una interfaz limpia para iniciar/detener el procesamiento y acceder a los resultados
 * Integra procesamiento multiespectral adaptativo, ICA y transformada wavelet
 */
export const useSignalProcessor = () => {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState<{
    frameCount: number;
    averageQuality: number;
    detectionRate: number;
  }>({
    frameCount: 0,
    averageQuality: 0,
    detectionRate: 0
  });
  
  // Contador de frames y calidad para estadísticas
  const frameCountRef = useCallback((prev: number) => prev + 1, []);
  const qualitySumRef = useCallback((prev: number, quality: number) => prev + quality, []);
  const detectionCountRef = useCallback((prev: number, detected: boolean) => detected ? prev + 1 : prev, []);
  
  // Iniciar procesamiento avanzado
  const startProcessing = useCallback(() => {
    ppgSignalService.startProcessing();
    setIsProcessing(true);
    setProcessingStats({
      frameCount: 0,
      averageQuality: 0,
      detectionRate: 0
    });
    console.log("useSignalProcessor: Procesamiento avanzado iniciado con multiespectral, ICA y wavelet");
  }, []);
  
  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    ppgSignalService.stopProcessing();
    setIsProcessing(false);
    setLastSignal(null);
    console.log("useSignalProcessor: Procesamiento detenido");
  }, []);
  
  // Procesar un frame con técnicas avanzadas
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;
    
    try {
      const signal = ppgSignalService.processFrame(imageData);
      
      if (signal) {
        setLastSignal(signal);
        
        // Actualizar estadísticas
        setProcessingStats(prev => {
          const newFrameCount = frameCountRef(prev.frameCount);
          const newQualitySum = qualitySumRef(prev.averageQuality * prev.frameCount, signal.quality);
          const newDetectionCount = detectionCountRef(prev.detectionRate * prev.frameCount, signal.fingerDetected);
          
          return {
            frameCount: newFrameCount,
            averageQuality: newQualitySum / newFrameCount,
            detectionRate: newDetectionCount / newFrameCount
          };
        });
        
        // Log detallado cada 60 frames
        if (signal.timestamp % 60 === 0) {
          console.log("Análisis multiespectral completo:", {
            calidad: signal.quality,
            dedoDetectado: signal.fingerDetected,
            valorFiltrado: signal.filteredValue.toFixed(2),
            firmaBiométrica: signal.physicalSignatureScore.toFixed(2),
            RGB: signal.rgbValues
          });
        }
      }
    } catch (error) {
      console.error("useSignalProcessor: Error procesando frame con técnicas avanzadas", error);
    }
  }, [isProcessing, frameCountRef, qualitySumRef, detectionCountRef]);
  
  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      ppgSignalService.stopProcessing();
    };
  }, []);
  
  return {
    lastSignal,
    isProcessing,
    startProcessing,
    stopProcessing,
    processFrame,
    stats: processingStats
  };
};
