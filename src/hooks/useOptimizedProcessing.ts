
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para acceder a las capacidades optimizadas de procesamiento de señales
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  OptimizationController, 
  getOptimizationController,
  OptimizationStatus
} from '../modules/extraction/OptimizationController';
import { OptimizationPhase } from '../modules/extraction/optimization/OptimizationManager';

export const useOptimizedProcessing = (
  autoInitialize: boolean = true,
  config?: {
    autoAdvancePhases?: boolean;
    initialPhase?: OptimizationPhase;
  }
) => {
  // Referencias
  const controllerRef = useRef<OptimizationController | null>(null);
  
  // Estado
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [status, setStatus] = useState<OptimizationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Inicialización
  useEffect(() => {
    const initController = async () => {
      try {
        // Obtener controlador
        controllerRef.current = getOptimizationController({
          autoAdvancePhases: config?.autoAdvancePhases ?? true
        });
        
        // Establecer fase inicial si se especifica
        if (config?.initialPhase) {
          controllerRef.current.getStatus().phase !== config.initialPhase && 
            setPhase(config.initialPhase);
        }
        
        // Inicializar controlador
        if (autoInitialize) {
          const success = await controllerRef.current.initialize();
          setIsInitialized(success);
          
          if (!success) {
            setError("Error inicializando el procesamiento optimizado");
          } else {
            // Actualizar estado inicial
            setStatus(controllerRef.current.getStatus());
          }
        }
      } catch (err) {
        setError(`Error fatal: ${(err as Error).message}`);
        setIsInitialized(false);
      }
    };
    
    initController();
    
    // Actualizar estado periódicamente
    const intervalId = setInterval(() => {
      if (controllerRef.current && isInitialized) {
        setStatus(controllerRef.current.getStatus());
      }
    }, 2000);
    
    return () => {
      clearInterval(intervalId);
      
      // Limpiar recursos al desmontar
      if (controllerRef.current) {
        controllerRef.current.dispose();
      }
    };
  }, [autoInitialize, config?.autoAdvancePhases, config?.initialPhase]);
  
  /**
   * Inicializa manualmente el controlador
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!controllerRef.current) {
      controllerRef.current = getOptimizationController();
    }
    
    try {
      const success = await controllerRef.current.initialize();
      setIsInitialized(success);
      
      if (success) {
        setStatus(controllerRef.current.getStatus());
        setError(null);
      } else {
        setError("Error inicializando el controlador");
      }
      
      return success;
    } catch (err) {
      setError(`Error de inicialización: ${(err as Error).message}`);
      setIsInitialized(false);
      return false;
    }
  }, []);
  
  /**
   * Procesa una señal utilizando las optimizaciones activas
   */
  const processSignal = useCallback(async (signal: number | number[]): Promise<any> => {
    if (!controllerRef.current) {
      setError("Controlador no inicializado");
      return null;
    }
    
    if (!isInitialized) {
      const success = await initialize();
      if (!success) {
        return null;
      }
    }
    
    try {
      const result = await controllerRef.current.processSignal(signal);
      
      // Actualizar estado después de procesar
      setStatus(controllerRef.current.getStatus());
      
      return result;
    } catch (err) {
      setError(`Error procesando señal: ${(err as Error).message}`);
      return null;
    }
  }, [isInitialized, initialize]);
  
  /**
   * Avanza manualmente a la siguiente fase
   */
  const advanceToNextPhase = useCallback((): boolean => {
    if (!controllerRef.current || !isInitialized) {
      setError("No se puede avanzar de fase: controlador no inicializado");
      return false;
    }
    
    const success = controllerRef.current.advanceToNextPhase();
    
    if (success) {
      setStatus(controllerRef.current.getStatus());
    }
    
    return success;
  }, [isInitialized]);
  
  /**
   * Establece fase específica
   */
  const setPhase = useCallback((phase: OptimizationPhase): void => {
    if (!controllerRef.current) {
      controllerRef.current = getOptimizationController();
    }
    
    // Establecer fase en el gestor de optimizaciones
    controllerRef.current.getStatus().phase !== phase && 
      controllerRef.current.getOptimizationManager().activatePhase(phase);
      
    // Aplicar configuración para la fase
    controllerRef.current.applyOptimizedConfig();
    
    // Actualizar estado
    setStatus(controllerRef.current.getStatus());
  }, []);
  
  /**
   * Obtiene métricas detalladas
   */
  const getDetailedMetrics = useCallback(() => {
    if (!controllerRef.current || !isInitialized) {
      return { error: "Controlador no inicializado" };
    }
    
    return controllerRef.current.getDetailedMetrics();
  }, [isInitialized]);
  
  return {
    // Estado
    isInitialized,
    status,
    error,
    
    // Acciones
    initialize,
    processSignal,
    advanceToNextPhase,
    setPhase,
    getDetailedMetrics,
    
    // Acceso directo al controlador
    controller: controllerRef.current
  };
};
