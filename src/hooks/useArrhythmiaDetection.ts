
/**
 * Hook para detección de arritmias basada en análisis PPG
 * Interfaz para integrar el servicio de detección de arritmias en componentes React
 * 
 * IMPORTANTE: Este hook SOLO utiliza datos reales, sin simulaciones. No hay Math.random().
 */

import { useCallback, useState, useEffect } from 'react';
import ArrhythmiaDetectionService, { 
  ArrhythmiaDetectionResult, 
  ArrhythmiaStatus, 
  UserProfile 
} from '../services/arrhythmia/index';

interface ArrhythmiaDetectionOptions {
  enableNotifications?: boolean;
  sensitivityLevel?: 'low' | 'normal' | 'high';
}

export function useArrhythmiaDetection(options: ArrhythmiaDetectionOptions = {}) {
  const [result, setResult] = useState<ArrhythmiaDetectionResult | null>(null);
  const [status, setStatus] = useState<ArrhythmiaStatus>('unknown');
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  // Obtener instancia del servicio
  const service = ArrhythmiaDetectionService;
  
  // Configurar sensibilidad
  useEffect(() => {
    // Aquí se podría configurar sensibilidad del servicio
    // Por ahora no aplicable, pero en futuras versiones
  }, [options.sensitivityLevel]);
  
  // Registrar listener para notificaciones
  useEffect(() => {
    if (options.enableNotifications) {
      const listener = (detectionResult: ArrhythmiaDetectionResult) => {
        setResult(detectionResult);
        setStatus(detectionResult.status);
      };
      
      service.addListener(listener);
      return () => {
        service.removeListener(listener);
      };
    }
  }, [options.enableNotifications]);
  
  // Procesar un latido (intervalo RR)
  const processHeartbeat = useCallback((
    rrInterval: number, 
    signalQuality: number = 100
  ): ArrhythmiaDetectionResult => {
    const detectionResult = service.processRRInterval(rrInterval, signalQuality);
    setResult(detectionResult);
    setStatus(detectionResult.status);
    return detectionResult;
  }, []);
  
  // Procesar segmento PPG para análisis morfológico
  const processPPGSegment = useCallback(async (
    ppgSegment: number[], 
    signalQuality: number = 100
  ): Promise<ArrhythmiaDetectionResult> => {
    const detectionResult = await service.processPPGSegment(ppgSegment, signalQuality);
    setResult(detectionResult);
    setStatus(detectionResult.status);
    return detectionResult;
  }, []);
  
  // Iniciar monitoreo continuo
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);
  
  // Detener monitoreo
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);
  
  // Configurar perfil de usuario
  const setUserProfile = useCallback((profile: UserProfile) => {
    service.setUserProfile(profile);
  }, []);
  
  // Reiniciar sistema
  const reset = useCallback(() => {
    service.reset();
    setResult(null);
    setStatus('unknown');
    setIsMonitoring(false);
  }, []);
  
  return {
    processHeartbeat,
    processPPGSegment,
    arrhythmiaResult: result,
    arrhythmiaStatus: status,
    isAbnormal: status !== 'normal' && status !== 'unknown',
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    setUserProfile,
    reset
  };
}
