
import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrhythmiaStatus, ArrhythmiaDetectionResult } from '@/services/arrhythmia/types'; 
import ArrhythmiaDetectionService from '@/services/arrhythmia';
import { ArrhythmiaWindow } from '@/types/arrhythmia';
import { toast } from 'sonner';

interface ArrhythmiaVisualizationHook {
  arrhythmiaWindows: ArrhythmiaWindow[];
  addArrhythmiaWindow: (status: ArrhythmiaStatus, probability: number, intervals: number[], details?: Record<string, any>) => void;
  clearArrhythmiaWindows: () => void;
  processArrhythmiaStatus: (status: string, data: any) => boolean;
  registerArrhythmiaNotification: () => void;
}

export const useArrhythmiaVisualization = (): ArrhythmiaVisualizationHook => {
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const lastNotificationRef = useRef<number>(0);
  const MIN_NOTIFICATION_INTERVAL = 5000; // 5 segundos entre notificaciones
  
  // Al iniciar, obtenemos las ventanas existentes del servicio
  useEffect(() => {
    const existingWindows = ArrhythmiaDetectionService.getArrhythmiaWindows();
    if (existingWindows && existingWindows.length > 0) {
      setArrhythmiaWindows(existingWindows as ArrhythmiaWindow[]);
    }
    
    // Agregamos un listener para actualizaciones
    const handleArrhythmiaDetection = (result: ArrhythmiaDetectionResult) => {
      if (result.status !== 'normal' && result.status !== 'unknown' && result.probability > 0.7) {
        const newWindow: ArrhythmiaWindow = {
          timestamp: result.timestamp,
          duration: result.latestIntervals.reduce((sum, interval) => sum + interval, 0),
          status: result.status,
          intervals: [...result.latestIntervals],
          probability: result.probability,
          details: { ...result.details }
        };
        
        setArrhythmiaWindows(prev => [...prev, newWindow]);
      }
    };
    
    ArrhythmiaDetectionService.addArrhythmiaListener(handleArrhythmiaDetection);
    
    return () => {
      ArrhythmiaDetectionService.removeArrhythmiaListener(handleArrhythmiaDetection);
    };
  }, []);
  
  /**
   * Registrar una ventana de arritmia
   */
  const addArrhythmiaWindow = useCallback((
    status: ArrhythmiaStatus,
    probability: number,
    intervals: number[],
    details: Record<string, any> = {}
  ): void => {
    // Crear nueva ventana
    const newWindow: ArrhythmiaWindow = {
      timestamp: Date.now(),
      duration: intervals.reduce((sum, interval) => sum + interval, 0),
      status,
      intervals,
      probability,
      details
    };
    
    // Añadir al estado
    setArrhythmiaWindows(prev => [...prev, newWindow]);
    
    // Registrar también en el servicio
    ArrhythmiaDetectionService.processRRInterval(
      intervals.length > 0 ? intervals[intervals.length - 1] : 800,
      90
    );
  }, []);
  
  /**
   * Procesar cambio de estado de arritmia
   * Retorna true si debe notificarse
   */
  const processArrhythmiaStatus = useCallback((
    status: string,
    data: any
  ): boolean => {
    // Verificar si estamos en arritmia
    if (status && status !== "Normal" && status !== "--") {
      const now = Date.now();
      const shouldNotify = now - lastNotificationRef.current > MIN_NOTIFICATION_INTERVAL;
      
      if (shouldNotify) {
        lastNotificationRef.current = now;
      }
      
      return shouldNotify;
    }
    
    return false;
  }, []);
  
  /**
   * Registrar notificación de arritmia
   */
  const registerArrhythmiaNotification = useCallback((): void => {
    toast.warning('¡Posible arritmia detectada!', {
      description: 'Se ha detectado un ritmo cardíaco irregular.',
      duration: 5000,
    });
  }, []);
  
  /**
   * Limpiar ventanas de arritmia
   */
  const clearArrhythmiaWindows = useCallback((): void => {
    setArrhythmiaWindows([]);
    ArrhythmiaDetectionService.reset();
  }, []);
  
  return {
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows,
    processArrhythmiaStatus,
    registerArrhythmiaNotification
  };
};
