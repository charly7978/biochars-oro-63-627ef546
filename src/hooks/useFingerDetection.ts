
/**
 * Centralización de lógica de detección de dedo incluyendo retroalimentación
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fingerDetectionService as service } from '@/services/FingerDetectionService';

export function useFingerDetection() {
  const [detectionResult, setDetectionResult] = useState({
    isFingerDetected: false,
    quality: 0,
    confidence: 0,
    rhythmDetected: false,
    signalStrength: 0,
    lastUpdate: 0,
    feedback: "Esperando señal..."
  });

  // Exponer función para procesar nuevas señales
  const processNewSignal = useCallback((rawValue: number) => {
    const result = service.processSignal(rawValue);
    // Asegurarse que feedback no sea undefined (cumple con estado esperado)
    setDetectionResult({
      ...result,
      feedback: result.feedback ?? "Esperando señal..."
    });
    return result;
  }, []);

  // Permitir resetear servicio y estado
  const resetDetection = useCallback(() => {
    service.reset();
    setDetectionResult({
      isFingerDetected: false,
      quality: 0,
      confidence: 0,
      rhythmDetected: false,
      signalStrength: 0,
      lastUpdate: 0,
      feedback: "Esperando señal..."
    });
  }, []);

  return {
    detectionResult,
    processNewSignal,
    resetDetection
  };
}
