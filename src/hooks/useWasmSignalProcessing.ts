
/**
 * Hook para procesar señales utilizando WebAssembly y Workers
 * Proporciona aceleración real para el procesamiento de señales
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getWasmProcessor } from '../modules/extraction/wasm/WasmProcessor';
import { createEnhancedSignalWorker } from '../modules/extraction/workers/EnhancedSignalWorker';
import { WorkerProcessingResult } from '../modules/extraction/types/processing';

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
  
  // Referencias
  const wasmProcessor = useRef<any>(null);
  const worker = useRef<any>(null);
  const buffer = useRef<number[]>([]);
  
  /**
   * Inicializa los procesadores
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return true;
    
    try {
      setError(null);
      
      if (useWorker) {
        // Inicializar worker
        worker.current = createEnhancedSignalWorker('/assets/signal.worker.js', {
          useWasm: true,
          timeout: 10000
        });
        
        const success = await worker.current.initialize();
        if (!success) {
          throw new Error('Error inicializando worker');
        }
      } else {
        // Inicializar procesador WASM directamente
        wasmProcessor.current = getWasmProcessor();
        await wasmProcessor.current.initialize();
      }
      
      setIsInitialized(true);
      return true;
    } catch (error) {
      console.error('Error inicializando procesamiento WASM:', error);
      setError(error instanceof Error ? error.message : String(error));
      setIsInitialized(false);
      return false;
    }
  }, [isInitialized, useWorker]);
  
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
      
      // Procesar con worker o directamente
      if (useWorker && worker.current) {
        const result: WorkerProcessingResult = await worker.current.processSignal(value);
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
      }
      
      // Calcular estadísticas básicas
      if (filteredValues.length > 0) {
        const sum = filteredValues.reduce((a, b) => a + b, 0);
        const mean = sum / filteredValues.length;
        const variance = filteredValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / filteredValues.length;
        const min = Math.min(...filteredValues);
        const max = Math.max(...filteredValues);
        
        stats = { mean, variance, min, max };
      }
      
      const result: WasmProcessingResult = {
        filteredValues,
        peaks,
        stats,
        processingTime: performance.now() - startTime
      };
      
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
    setLastResult(null);
    setError(null);
  }, []);
  
  return {
    isInitialized,
    isProcessing,
    lastResult,
    error,
    
    // Métodos
    initialize,
    processValue,
    processBatch,
    detectPeaks,
    processBuffer,
    reset,
    
    // Buffer
    bufferLength: buffer.current.length,
    bufferValues: [...buffer.current]
  };
}
