
/**
 * Hook para gestión centralizada de las optimizaciones de procesamiento
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getOptimizationController } from '../modules/extraction/OptimizationController';
import { 
  OptimizationPhase, 
  OptimizationStatus, 
  OptimizationProgress, 
  PerformanceMetrics 
} from '../modules/extraction/types/processing';

/**
 * Hook que proporciona acceso a las optimizaciones de procesamiento
 */
export function useOptimizedProcessing() {
  const controllerRef = useRef(getOptimizationController());
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<OptimizationPhase | null>(null);
  const [phases, setPhases] = useState<Map<OptimizationPhase, OptimizationStatus>>(new Map());
  const [progress, setProgress] = useState<Map<OptimizationPhase, number>>(new Map());
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    processingTime: 0,
    memoryUsage: 0
  });
  
  // Procesar actualización de progreso
  const handleProgress = useCallback((progressData: OptimizationProgress) => {
    const { phase, status, progress: phaseProgress } = progressData;
    
    // Actualizar estado de la fase
    setPhases(prev => {
      const newPhases = new Map(prev);
      newPhases.set(phase, status);
      return newPhases;
    });
    
    // Actualizar progreso
    setProgress(prev => {
      const newProgress = new Map(prev);
      newProgress.set(phase, phaseProgress);
      return newProgress;
    });
    
    // Actualizar fase actual
    if (status === OptimizationStatus.IN_PROGRESS) {
      setCurrentPhase(phase);
    } else if (status === OptimizationStatus.COMPLETED && currentPhase === phase) {
      setCurrentPhase(null);
    }
    
    // Actualizar estado optimizando
    setIsOptimizing(status === OptimizationStatus.IN_PROGRESS);
  }, [currentPhase]);
  
  // Registrar callback al montar
  useEffect(() => {
    const manager = controllerRef.current.getOptimizationManager();
    manager.registerCallback(handleProgress);
    
    // Actualizar estado inicial
    Object.values(OptimizationPhase).forEach(phase => {
      setPhases(prev => {
        const newPhases = new Map(prev);
        newPhases.set(phase, manager.getPhaseStatus(phase));
        return newPhases;
      });
    });
    
    // Iniciar medición periódica de rendimiento
    const intervalId = setInterval(() => {
      setMetrics(manager.getPerformanceMetrics());
    }, 2000);
    
    return () => {
      manager.unregisterCallback(handleProgress);
      clearInterval(intervalId);
    };
  }, [handleProgress]);
  
  /**
   * Inicia una fase específica de optimización
   */
  const startPhase = useCallback(async (phase: OptimizationPhase): Promise<boolean> => {
    if (isOptimizing) {
      console.warn(`Ya hay una optimización en curso: ${currentPhase}`);
      return false;
    }
    
    try {
      setIsOptimizing(true);
      setCurrentPhase(phase);
      const result = await controllerRef.current.getOptimizationManager().startPhase(phase);
      return result;
    } catch (error) {
      console.error(`Error iniciando fase ${phase}:`, error);
      return false;
    } finally {
      setIsOptimizing(false);
      setCurrentPhase(null);
    }
  }, [isOptimizing, currentPhase]);
  
  /**
   * Inicia todas las fases de optimización en secuencia
   */
  const startAllPhases = useCallback(async (): Promise<boolean> => {
    if (isOptimizing) {
      console.warn('Ya hay optimizaciones en curso');
      return false;
    }
    
    try {
      setIsOptimizing(true);
      
      // Orden de ejecución de fases
      const phaseOrder: OptimizationPhase[] = [
        OptimizationPhase.MEMORY_OPTIMIZATION,
        OptimizationPhase.WORKER_OPTIMIZATION,
        OptimizationPhase.WASM_OPTIMIZATION,
        OptimizationPhase.MODEL_QUANTIZATION,
        OptimizationPhase.GPU_ACCELERATION,
        OptimizationPhase.CACHE_STRATEGY
      ];
      
      // Ejecutar fases en secuencia
      for (const phase of phaseOrder) {
        setCurrentPhase(phase);
        await controllerRef.current.getOptimizationManager().startPhase(phase);
      }
      
      return true;
    } catch (error) {
      console.error('Error ejecutando todas las fases:', error);
      return false;
    } finally {
      setIsOptimizing(false);
      setCurrentPhase(null);
    }
  }, [isOptimizing]);
  
  /**
   * Obtiene información sobre el estado general de las optimizaciones
   */
  const getOptimizationSummary = useCallback(() => {
    let completed = 0;
    let total = 0;
    let overallProgress = 0;
    
    phases.forEach((status, phase) => {
      total++;
      if (status === OptimizationStatus.COMPLETED) {
        completed++;
      }
      overallProgress += progress.get(phase) || 0;
    });
    
    overallProgress = total > 0 ? overallProgress / total : 0;
    
    return {
      completed,
      total,
      overallProgress,
      isOptimizing,
      currentPhase
    };
  }, [phases, progress, isOptimizing, currentPhase]);
  
  return {
    // Estado
    isOptimizing,
    currentPhase,
    phases,
    progress,
    metrics,
    
    // Acciones
    startPhase,
    startAllPhases,
    
    // Utilidades
    getOptimizationSummary
  };
}
