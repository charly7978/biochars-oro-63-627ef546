
import { useEffect, useRef, useState } from 'react';
import { TensorFlowService } from '@/core/services/TensorFlowService';

/**
 * Hook para optimizar el rendimiento de la aplicación durante mediciones
 * - Gestiona la frecuencia de actualización
 * - Limita el uso de memoria
 * - Implementa throttling de operaciones costosas
 */
export function usePerformanceOptimizer(isActive: boolean) {
  const [optimizationLevel, setOptimizationLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const frameSkipCount = useRef(0);
  const lastOptimizationTime = useRef(Date.now());
  const memoryWarnings = useRef(0);
  const tensorFlowEnabled = useRef(true);

  // Obtener referencia al servicio TensorFlow
  useEffect(() => {
    const tfService = TensorFlowService.getInstance();
    tensorFlowEnabled.current = tfService.isTensorFlowEnabled();
  }, []);

  // Monitorear rendimiento y ajustar nivel de optimización automáticamente
  useEffect(() => {
    if (!isActive) return;

    // Función para verificar rendimiento
    const checkPerformance = () => {
      const now = Date.now();
      
      // Verificar memoria disponible (simulado, en navegadores modernos se podría usar performance.memory)
      if (window.performance && (window.performance as any).memory) {
        const memoryInfo = (window.performance as any).memory;
        const usedHeapPercentage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        
        if (usedHeapPercentage > 0.7) {
          memoryWarnings.current += 1;
          
          // Después de múltiples advertencias de memoria, aumentar nivel de optimización
          if (memoryWarnings.current > 3) {
            setOptimizationLevel('high');
            
            // Deshabilitar TensorFlow en caso de problemas graves de memoria
            if (usedHeapPercentage > 0.85 && tensorFlowEnabled.current) {
              const tfService = TensorFlowService.getInstance();
              tfService.disableTensorFlow();
              tensorFlowEnabled.current = false;
              console.log("Deshabilitando TensorFlow temporalmente para mejorar rendimiento");
            }
          }
        }
      }
      
      // Comprobar frecuencia de cuadros
      const timeDiff = now - lastOptimizationTime.current;
      if (timeDiff > 5000) { // Revisar cada 5 segundos
        lastOptimizationTime.current = now;
        
        // Reiniciar contadores
        memoryWarnings.current = Math.max(0, memoryWarnings.current - 1);
        
        // Ajustar nivel de optimización según condiciones
        if (frameSkipCount.current > 10) {
          setOptimizationLevel('high');
        } else if (frameSkipCount.current > 5) {
          setOptimizationLevel('medium');
        } else {
          setOptimizationLevel('low');
        }
        
        frameSkipCount.current = 0;
      }
    };

    const interval = setInterval(checkPerformance, 2000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Función para controlar la frecuencia de procesamiento de cuadros
  const shouldProcessFrame = (frameCount: number): boolean => {
    // Saltar cuadros según el nivel de optimización
    switch (optimizationLevel) {
      case 'high':
        return frameCount % 3 === 0; // Procesar 1 de cada 3 cuadros
      case 'medium':
        return frameCount % 2 === 0; // Procesar 1 de cada 2 cuadros
      case 'low':
      default:
        return true; // Procesar todos los cuadros
    }
  };

  // Función para limitar operaciones costosas con throttling
  const throttle = <T extends (...args: any[]) => any>(
    func: T, 
    limit: number
  ): ((...args: Parameters<T>) => ReturnType<T> | undefined) => {
    let lastRan = 0;
    let lastResult: ReturnType<T> | undefined;
    
    return (...args: Parameters<T>): ReturnType<T> | undefined => {
      const now = Date.now();
      
      if (now - lastRan >= limit) {
        lastRan = now;
        lastResult = func(...args);
        return lastResult;
      }
      
      frameSkipCount.current += 1;
      return lastResult;
    };
  };

  // Función para prevenir fugas de memoria
  const cleanupMemory = () => {
    // Forzar limpieza de memoria no utilizada
    if (window.gc) {
      try {
        window.gc();
      } catch (error) {
        console.log("No se pudo forzar la limpieza de memoria");
      }
    }
    
    // Reiniciar contadores
    memoryWarnings.current = 0;
    frameSkipCount.current = 0;
    
    // Restaurar TensorFlow si estaba deshabilitado
    if (!tensorFlowEnabled.current) {
      const tfService = TensorFlowService.getInstance();
      tfService.enableTensorFlow();
      tensorFlowEnabled.current = true;
      console.log("Rehabilitando TensorFlow");
    }
  };

  return {
    optimizationLevel,
    shouldProcessFrame,
    throttle,
    cleanupMemory
  };
}
