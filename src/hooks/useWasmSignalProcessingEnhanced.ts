
/**
 * Hook mejorado para procesar señales utilizando WebAssembly y Workers
 * Integra optimizaciones SIMD, cuantización y multithreading
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getWasmProcessor } from '../modules/extraction/wasm/WasmProcessor';
import { createEnhancedSignalWorker } from '../modules/extraction/workers/EnhancedSignalWorker';
import { OptimizationPhase, OptimizationStatus, OptimizationSummary } from '../modules/extraction/types/processing';

interface WasmProcessingOptions {
  useWorker?: boolean;
  batchSize?: number;
  filterType?: 'kalman' | 'lowpass';
  minPeakDistance?: number;
  peakThreshold?: number;
  filterQ?: number;
  filterR?: number;
}

interface WasmProcessingResult {
  filteredValues: number[];
  peaks: number[];
  stats: {
    mean: number;
    variance: number;
    min: number;
    max: number;
  };
  processingTime: number;
}

/**
 * Hook para procesamiento de señales con WASM
 */
export function useWasmSignalProcessing(options: WasmProcessingOptions = {}) {
  // Opciones con valores por defecto
  const {
    useWorker = true,
    batchSize = 30,
    filterType = 'kalman',
    minPeakDistance = 5,
    peakThreshold = 0.5,
    filterQ = 0.01,
    filterR = 0.1
  } = options;
  
  // Estado
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<WasmProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizationPhase, setOptimizationPhase] = useState<OptimizationPhase>(OptimizationPhase.INITIALIZATION);
  const [optimizationStatus, setOptimizationStatus] = useState<Map<OptimizationPhase, OptimizationStatus>>(
    new Map([
      [OptimizationPhase.INITIALIZATION, { completed: false, progress: 0 }],
      [OptimizationPhase.WASM_COMPILATION, { completed: false, progress: 0 }],
      [OptimizationPhase.WORKER_SETUP, { completed: false, progress: 0 }],
      [OptimizationPhase.MODEL_LOADING, { completed: false, progress: 0 }],
      [OptimizationPhase.CACHE_SETUP, { completed: false, progress: 0 }],
      [OptimizationPhase.READY, { completed: false, progress: 0 }]
    ])
  );
  const [optimizing, setOptimizing] = useState<boolean>(false);
  
  // Referencias
  const wasmProcessor = useRef<any>(null);
  const worker = useRef<any>(null);
  const buffer = useRef<number[]>([]);
  const cacheRef = useRef<Map<string, any>>(new Map());
  const processingTimeRef = useRef<number[]>([]);
  
  /**
   * Actualiza una fase de optimización
   */
  const updatePhaseStatus = useCallback((phase: OptimizationPhase, status: Partial<OptimizationStatus>) => {
    setOptimizationStatus(prev => {
      const newStatus = new Map(prev);
      const currentStatus = newStatus.get(phase) || { completed: false, progress: 0 };
      newStatus.set(phase, { ...currentStatus, ...status });
      return newStatus;
    });
  }, []);
  
  /**
   * Avanza a la siguiente fase de optimización
   */
  const advanceToNextPhase = useCallback(() => {
    setOptimizationPhase(prev => {
      // Actualizar fase actual como completada
      updatePhaseStatus(prev, { completed: true, progress: 100 });
      
      // Determinar siguiente fase
      let nextPhase = prev;
      switch (prev) {
        case OptimizationPhase.INITIALIZATION:
          nextPhase = OptimizationPhase.WASM_COMPILATION;
          break;
        case OptimizationPhase.WASM_COMPILATION:
          nextPhase = OptimizationPhase.WORKER_SETUP;
          break;
        case OptimizationPhase.WORKER_SETUP:
          nextPhase = OptimizationPhase.MODEL_LOADING;
          break;
        case OptimizationPhase.MODEL_LOADING:
          nextPhase = OptimizationPhase.CACHE_SETUP;
          break;
        case OptimizationPhase.CACHE_SETUP:
          nextPhase = OptimizationPhase.READY;
          break;
        default:
          nextPhase = OptimizationPhase.READY;
      }
      
      return nextPhase;
    });
  }, [updatePhaseStatus]);
  
  /**
   * Obtiene métricas detalladas del procesamiento
   */
  const getDetailedMetrics = useCallback(() => {
    const times = processingTimeRef.current;
    const avgTime = times.length > 0 
      ? times.reduce((a, b) => a + b, 0) / times.length 
      : 0;
    
    return {
      processingTime: avgTime,
      memoryUsage: performance && 'memory' in performance ? (performance as any).memory.usedJSHeapSize : 0,
      cacheSize: cacheRef.current.size,
      cacheHitRate: calculateCacheHitRate(),
      bufferSize: buffer.current.length
    };
  }, []);
  
  /**
   * Calcula la tasa de aciertos de cache
   */
  const calculateCacheHitRate = useCallback(() => {
    const stats = cacheRef.current.get('__stats__') || { hits: 0, misses: 0 };
    const total = stats.hits + stats.misses;
    return total > 0 ? (stats.hits / total) * 100 : 0;
  }, []);
  
  /**
   * Obtiene un resumen del estado de optimización
   */
  const getOptimizationSummary = useCallback((): OptimizationSummary => {
    const allCompleted = Array.from(optimizationStatus.values())
      .every(status => status.completed);
    
    return {
      isFullyOptimized: allCompleted,
      wasmAvailable: isInitialized && !!wasmProcessor.current,
      webglAvailable: typeof window !== 'undefined' && 
        'WebGLRenderingContext' in window && !!document.createElement('canvas').getContext('webgl'),
      workerCount: useWorker && worker.current ? 1 : 0,
      modelLoaded: false, // Sin modelo ML por ahora
      averageProcessingTime: processingTimeRef.current.length > 0
        ? processingTimeRef.current.reduce((a, b) => a + b, 0) / processingTimeRef.current.length
        : 0
    };
  }, [isInitialized, optimizationStatus, useWorker]);
  
  /**
   * Inicializa los procesadores
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return true;
    
    try {
      setError(null);
      setOptimizing(true);
      setOptimizationPhase(OptimizationPhase.INITIALIZATION);
      updatePhaseStatus(OptimizationPhase.INITIALIZATION, { progress: 50 });
      
      // Inicializar caché
      cacheRef.current.clear();
      cacheRef.current.set('__stats__', { hits: 0, misses: 0 });
      
      // Crear procesador WASM
      wasmProcessor.current = getWasmProcessor();
      
      updatePhaseStatus(OptimizationPhase.INITIALIZATION, { progress: 100, completed: true });
      setOptimizationPhase(OptimizationPhase.WASM_COMPILATION);
      
      // Inicializar WASM
      updatePhaseStatus(OptimizationPhase.WASM_COMPILATION, { progress: 30 });
      const wasmSuccess = await wasmProcessor.current.initialize();
      if (!wasmSuccess) {
        throw new Error('Error inicializando WASM');
      }
      updatePhaseStatus(OptimizationPhase.WASM_COMPILATION, { progress: 100, completed: true });
      setOptimizationPhase(OptimizationPhase.WORKER_SETUP);
      
      if (useWorker) {
        // Inicializar worker
        updatePhaseStatus(OptimizationPhase.WORKER_SETUP, { progress: 20 });
        worker.current = createEnhancedSignalWorker('/assets/signal.worker.js', {
          useWasm: true,
          timeout: 10000
        });
        
        updatePhaseStatus(OptimizationPhase.WORKER_SETUP, { progress: 70 });
        const success = await worker.current.initialize();
        if (!success) {
          throw new Error('Error inicializando worker');
        }
      }
      
      updatePhaseStatus(OptimizationPhase.WORKER_SETUP, { progress: 100, completed: true });
      setOptimizationPhase(OptimizationPhase.MODEL_LOADING);
      
      // No tenemos modelo ML todavía
      updatePhaseStatus(OptimizationPhase.MODEL_LOADING, { progress: 100, completed: true });
      setOptimizationPhase(OptimizationPhase.CACHE_SETUP);
      
      // Configurar caché
      updatePhaseStatus(OptimizationPhase.CACHE_SETUP, { progress: 100, completed: true });
      setOptimizationPhase(OptimizationPhase.READY);
      updatePhaseStatus(OptimizationPhase.READY, { progress: 100, completed: true });
      
      setIsInitialized(true);
      setOptimizing(false);
      return true;
    } catch (error) {
      console.error('Error inicializando procesamiento WASM:', error);
      setError(error instanceof Error ? error.message : String(error));
      setIsInitialized(false);
      setOptimizing(false);
      return false;
    }
  }, [isInitialized, useWorker, updatePhaseStatus]);
  
  /**
   * Efecto para inicializar automáticamente
   */
  useEffect(() => {
    initialize();
    
    // Limpiar recursos al desmontar
    return () => {
      if (worker.current) {
        worker.current.dispose();
      }
    };
  }, [initialize]);
  
  /**
   * Procesa un único valor
   */
  const processValue = useCallback(async (value: number): Promise<number> => {
    if (!isInitialized) {
      await initialize();
    }
    
    try {
      setIsProcessing(true);
      
      // Añadir valor al buffer
      buffer.current.push(value);
      if (buffer.current.length > batchSize * 3) {
        buffer.current = buffer.current.slice(-batchSize * 3);
      }
      
      let filteredValue = value;
      const startTime = performance.now();
      
      // Verificar caché
      const cacheKey = `value_${Math.round(value * 1000) / 1000}`;
      if (cacheRef.current.has(cacheKey)) {
        const stats = cacheRef.current.get('__stats__') || { hits: 0, misses: 0 };
        stats.hits++;
        cacheRef.current.set('__stats__', stats);
        filteredValue = cacheRef.current.get(cacheKey);
      } else {
        // Actualizar stats de caché
        const stats = cacheRef.current.get('__stats__') || { hits: 0, misses: 0 };
        stats.misses++;
        cacheRef.current.set('__stats__', stats);
        
        // Procesar con worker o directamente
        if (useWorker && worker.current) {
          const result = await worker.current.processSignal(value);
          if (result.success && result.data.processed !== undefined) {
            filteredValue = result.data.processed;
          }
        } else if (wasmProcessor.current) {
          // Procesar con WASM directamente
          const filtered = wasmProcessor.current.applyKalmanFilter(
            [value], 
            filterQ, 
            filterR
          );
          filteredValue = filtered[0];
        }
        
        // Guardar en caché
        cacheRef.current.set(cacheKey, filteredValue);
        if (cacheRef.current.size > 1000) {
          // Eliminar entradas más antiguas excepto stats
          const keys = Array.from(cacheRef.current.keys())
            .filter(k => k !== '__stats__')
            .slice(0, 100);
          keys.forEach(k => cacheRef.current.delete(k));
        }
      }
      
      // Registrar tiempo de procesamiento
      const endTime = performance.now();
      processingTimeRef.current.push(endTime - startTime);
      if (processingTimeRef.current.length > 50) {
        processingTimeRef.current.shift();
      }
      
      return filteredValue;
    } catch (error) {
      console.error('Error procesando valor:', error);
      setError(error instanceof Error ? error.message : String(error));
      return value;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, initialize, useWorker, batchSize, filterQ, filterR]);
  
  /**
   * Procesa un lote de valores
   */
  const processBatch = useCallback(async (values: number[]): Promise<WasmProcessingResult> => {
    if (!isInitialized) {
      await initialize();
    }
    
    try {
      setIsProcessing(true);
      const startTime = performance.now();
      
      // Añadir valores al buffer
      buffer.current.push(...values);
      if (buffer.current.length > batchSize * 3) {
        buffer.current = buffer.current.slice(-batchSize * 3);
      }
      
      let filteredValues = [...values];
      let peaks: number[] = [];
      let stats = { mean: 0, variance: 0, min: 0, max: 0 };
      
      // Procesar con worker o directamente
      if (useWorker && worker.current) {
        // Filtrar valores
        const filterResult = await worker.current.applyFilter(
          values, 
          filterType
        );
        
        if (filterResult.success && filterResult.data.filtered) {
          filteredValues = filterResult.data.filtered;
        }
        
        // Detectar picos
        const peaksResult = await worker.current.detectPeaks(
          filteredValues, 
          {
            minDistance: minPeakDistance,
            threshold: peakThreshold
          }
        );
        
        if (peaksResult.success && peaksResult.data.peaks) {
          peaks = peaksResult.data.peaks;
        }
        
        // Calcular estadísticas
        const statsResult = await worker.current.calculateStats(filteredValues);
        if (statsResult.success && statsResult.data) {
          stats = statsResult.data;
        }
      } else if (wasmProcessor.current) {
        // Procesar con WASM directamente
        filteredValues = wasmProcessor.current.applyKalmanFilter(
          values, 
          filterQ, 
          filterR
        );
        
        peaks = wasmProcessor.current.findPeaks(
          filteredValues, 
          minPeakDistance, 
          peakThreshold
        );
        
        stats = wasmProcessor.current.calculateStats(filteredValues);
      }
      
      const result: WasmProcessingResult = {
        filteredValues,
        peaks,
        stats,
        processingTime: performance.now() - startTime
      };
      
      // Registrar tiempo de procesamiento
      processingTimeRef.current.push(result.processingTime);
      if (processingTimeRef.current.length > 50) {
        processingTimeRef.current.shift();
      }
      
      setLastResult(result);
      return result;
    } catch (error) {
      console.error('Error procesando lote:', error);
      setError(error instanceof Error ? error.message : String(error));
      
      return {
        filteredValues: values,
        peaks: [],
        stats: { mean: 0, variance: 0, min: 0, max: 0 },
        processingTime: 0
      };
    } finally {
      setIsProcessing(false);
    }
  }, [
    isInitialized, 
    initialize, 
    useWorker, 
    filterType, 
    batchSize, 
    minPeakDistance, 
    peakThreshold, 
    filterQ, 
    filterR
  ]);
  
  /**
   * Detecta picos en un array de valores
   */
  const detectPeaks = useCallback(async (values: number[]): Promise<number[]> => {
    if (!isInitialized) {
      await initialize();
    }
    
    try {
      if (useWorker && worker.current) {
        const result = await worker.current.detectPeaks(
          values, 
          {
            minDistance: minPeakDistance,
            threshold: peakThreshold
          }
        );
        
        if (result.success && result.data.peaks) {
          return result.data.peaks;
        }
      } else if (wasmProcessor.current) {
        return wasmProcessor.current.findPeaks(
          values, 
          minPeakDistance, 
          peakThreshold
        );
      }
      
      return [];
    } catch (error) {
      console.error('Error detectando picos:', error);
      setError(error instanceof Error ? error.message : String(error));
      return [];
    }
  }, [isInitialized, initialize, useWorker, minPeakDistance, peakThreshold]);
  
  /**
   * Procesa los valores acumulados en el buffer
   */
  const processBuffer = useCallback(async (): Promise<WasmProcessingResult> => {
    if (buffer.current.length === 0) {
      return {
        filteredValues: [],
        peaks: [],
        stats: { mean: 0, variance: 0, min: 0, max: 0 },
        processingTime: 0
      };
    }
    
    return processBatch([...buffer.current]);
  }, [processBatch]);
  
  /**
   * Reinicia el procesador
   */
  const reset = useCallback(() => {
    buffer.current = [];
    cacheRef.current.clear();
    cacheRef.current.set('__stats__', { hits: 0, misses: 0 });
    processingTimeRef.current = [];
    setLastResult(null);
    setError(null);
    
    // Reiniciar estados de optimización
    const newStatus = new Map<OptimizationPhase, OptimizationStatus>();
    for (const phase of Object.values(OptimizationPhase)) {
      newStatus.set(phase as OptimizationPhase, {
        completed: phase === OptimizationPhase.READY ? false : true,
        progress: phase === OptimizationPhase.READY ? 0 : 100
      });
    }
    setOptimizationStatus(newStatus);
    setOptimizationPhase(OptimizationPhase.READY);
  }, []);
  
  return {
    // Estado básico
    isInitialized,
    isProcessing,
    lastResult,
    error,
    
    // Estado de optimización
    isOptimizing: optimizing,
    currentPhase: optimizationPhase,
    phases: optimizationStatus,
    
    // Métodos básicos
    processValue,
    processBatch,
    detectPeaks,
    processBuffer,
    reset,
    
    // Métodos avanzados
    initialize,
    advanceToNextPhase,
    updatePhaseStatus,
    getDetailedMetrics,
    getOptimizationSummary,
    
    // Buffer
    bufferLength: buffer.current.length,
    bufferValues: [...buffer.current]
  };
}
