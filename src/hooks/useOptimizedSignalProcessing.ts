
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParallelProcessing } from './useParallelProcessing';
import { CircularBufferPool, floatBufferPool, objectBufferPool } from '../utils/CircularBufferPool';
import { SignalProcessingTelemetry, TelemetryCategory } from '../core/telemetry/SignalProcessingTelemetry';
import { CodeProtectionShield } from '../core/protection/CodeProtectionShield';

/**
 * Hook que implementa procesamiento de señal optimizado con:
 * - Procesamiento paralelo con WebWorkers
 * - Optimizaciones SIMD cuando estén disponibles
 * - Gestión avanzada de memoria con buffers reutilizables
 * - Sistema de telemetría completo
 */
export const useOptimizedSignalProcessing = () => {
  // Utilizar el hook de procesamiento paralelo
  const {
    isWorkerAvailable,
    processSignalParallel,
    applyFiltersParallel,
    applyWaveletTransformParallel,
    resetWorker,
    getPerformanceMetrics
  } = useParallelProcessing();
  
  // Referencias para telemetría y protección
  const telemetry = useRef<SignalProcessingTelemetry>(SignalProcessingTelemetry.getInstance());
  const protectionShield = useRef<CodeProtectionShield>(CodeProtectionShield.getInstance());
  
  // Referencias para buckets preasignados
  const signalBufferRef = useRef<number[]>([]);
  const resultBufferRef = useRef<number[]>([]);
  const frameCountRef = useRef<number>(0);
  const processingCountRef = useRef<number>(0);
  
  // Opciones de configuración
  const [config, setConfig] = useState({
    useParallelProcessing: true,
    useMemoryPooling: true,
    useAdaptiveFiltering: true,
    bufferSize: 512
  });
  
  // Métricas de rendimiento
  const [performanceStats, setPerformanceStats] = useState({
    avgProcessingTime: 0,
    framesProcessed: 0,
    memoryUsage: {
      buffersCreated: 0,
      buffersReused: 0,
      currentPoolSize: 0
    }
  });
  
  // Inicializar recursos
  useEffect(() => {
    console.log("useOptimizedSignalProcessing: Inicializando procesamiento optimizado");
    
    // Preasignar buffers iniciales
    signalBufferRef.current = floatBufferPool.getBuffer(config.bufferSize);
    resultBufferRef.current = floatBufferPool.getBuffer(config.bufferSize);
    
    // Registrar inicialización en telemetría
    telemetry.current.recordEvent(
      TelemetryCategory.SIGNAL_PROCESSING,
      'optimized_processing_initialized',
      {
        workerAvailable: isWorkerAvailable,
        memoryPooling: config.useMemoryPooling,
        adaptiveFiltering: config.useAdaptiveFiltering,
        initialBufferSize: config.bufferSize
      }
    );
    
    protectionShield.current.logVerification({
      type: 'initialization',
      result: {
        success: true,
        message: 'Procesamiento optimizado inicializado correctamente',
        details: { isWorkerAvailable, config }
      },
      timestamp: Date.now(),
      context: {
        fileName: 'useOptimizedSignalProcessing.ts',
        moduleName: 'hooks'
      }
    });
    
    // Limpiar recursos al desmontar
    return () => {
      console.log("useOptimizedSignalProcessing: Limpiando recursos");
      
      // Devolver buffers al pool para reutilización
      if (config.useMemoryPooling) {
        floatBufferPool.releaseBuffer(signalBufferRef.current);
        floatBufferPool.releaseBuffer(resultBufferRef.current);
      }
      
      // Resetear worker
      resetWorker();
      
      telemetry.current.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'optimized_processing_cleanup',
        {
          framesProcessed: frameCountRef.current,
          processingsPerformed: processingCountRef.current
        }
      );
    };
  }, [isWorkerAvailable, config.bufferSize, config.useMemoryPooling, resetWorker]);
  
  // Actualizar métricas de rendimiento periódicamente
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Obtener métricas de los workers
      const workerMetrics = getPerformanceMetrics();
      
      // Obtener métricas del pool de memoria
      const memoryStats = floatBufferPool.getStats();
      
      setPerformanceStats({
        avgProcessingTime: workerMetrics.avgProcessingTime,
        framesProcessed: frameCountRef.current,
        memoryUsage: {
          buffersCreated: memoryStats.bufferCreations,
          buffersReused: memoryStats.bufferReuses,
          currentPoolSize: Object.values(memoryStats.poolSizes).reduce((a, b) => a + b, 0)
        }
      });
      
      // Registrar en telemetría
      telemetry.current.recordMetric(
        TelemetryCategory.PERFORMANCE,
        'avg_processing_time',
        workerMetrics.avgProcessingTime,
        'ms'
      );
      
      telemetry.current.recordMetric(
        TelemetryCategory.MEMORY_MANAGEMENT,
        'buffer_reuse_rate',
        memoryStats.bufferReuses / (memoryStats.bufferCreations + memoryStats.bufferReuses),
        'ratio'
      );
      
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [getPerformanceMetrics]);
  
  /**
   * Procesa un frame de imagen de forma optimizada
   */
  const processImageData = useCallback(async (imageData: ImageData): Promise<any> => {
    // Incrementar contador de frames
    frameCountRef.current++;
    
    // Crear ID único para esta fase de procesamiento
    const phaseId = `frame_processing_${Date.now()}_${frameCountRef.current}`;
    
    // Iniciar medición de tiempo y telemetría
    telemetry.current.startPhase(phaseId, TelemetryCategory.SIGNAL_CAPTURE);
    const startTime = performance.now();
    
    try {
      // Extraer los canales RGB utilizando optimización de memoria
      const { redValues, greenValues, blueValues } = extractChannelsOptimized(imageData);
      
      // Registrar progreso en telemetría
      telemetry.current.measurePhase(phaseId, 'extraction_time', performance.now() - startTime, 'ms');
      telemetry.current.recordPhaseEvent(phaseId, 'channels_extracted', {
        redSize: redValues.length,
        greenSize: greenValues.length,
        blueSize: blueValues.length
      });
      
      // Procesar señal utilizando WebWorkers si está habilitado
      let processedResult;
      if (config.useParallelProcessing && isWorkerAvailable) {
        processedResult = await processSignalParallel(redValues, 30);
        telemetry.current.recordPhaseEvent(phaseId, 'parallel_processing_complete');
      } else {
        // Fallback a procesamiento secuencial
        processedResult = processSignalSequential(redValues, greenValues, blueValues);
        telemetry.current.recordPhaseEvent(phaseId, 'sequential_processing_complete');
      }
      
      // Devolver buffers al pool para reutilización
      if (config.useMemoryPooling) {
        floatBufferPool.releaseBuffer(redValues);
        floatBufferPool.releaseBuffer(greenValues);
        floatBufferPool.releaseBuffer(blueValues);
      }
      
      // Finalizar fase de procesamiento
      const processingTime = performance.now() - startTime;
      telemetry.current.endPhase(phaseId, TelemetryCategory.SIGNAL_PROCESSING);
      
      // Incrementar contador de procesamientos completados
      processingCountRef.current++;
      
      // Registrar tiempo de procesamiento
      telemetry.current.recordMetric(
        TelemetryCategory.PERFORMANCE,
        'frame_processing_time',
        processingTime,
        'ms'
      );
      
      return {
        result: processedResult,
        processingTime,
        frameNumber: frameCountRef.current
      };
    } catch (error) {
      console.error('Error en procesamiento optimizado:', error);
      
      // Registrar error en telemetría
      telemetry.current.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'processing_error',
        { error: error instanceof Error ? error.message : 'Error desconocido' }
      );
      
      // Finalizar fase con error
      telemetry.current.endPhase(phaseId, TelemetryCategory.SIGNAL_PROCESSING);
      
      // Notificar al sistema de protección
      protectionShield.current.logVerification({
        type: 'error',
        result: {
          success: false,
          message: `Error en procesamiento optimizado: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          details: { error }
        },
        timestamp: Date.now(),
        context: {
          fileName: 'useOptimizedSignalProcessing.ts',
          moduleName: 'hooks'
        }
      });
      
      return null;
    }
  }, [
    config.useParallelProcessing, 
    config.useMemoryPooling, 
    isWorkerAvailable, 
    processSignalParallel
  ]);
  
  /**
   * Extrae los canales RGB de forma optimizada reutilizando buffers
   */
  const extractChannelsOptimized = useCallback((imageData: ImageData): {
    redValues: number[],
    greenValues: number[],
    blueValues: number[]
  } => {
    const { data, width, height } = imageData;
    
    // Obtener buffers del pool o crearlos si es necesario
    const redValues = config.useMemoryPooling 
      ? floatBufferPool.getBuffer(width * height) 
      : new Array(width * height).fill(0);
    
    const greenValues = config.useMemoryPooling 
      ? floatBufferPool.getBuffer(width * height) 
      : new Array(width * height).fill(0);
    
    const blueValues = config.useMemoryPooling 
      ? floatBufferPool.getBuffer(width * height) 
      : new Array(width * height).fill(0);
    
    // Extraer valores de canales con optimización de acceso a memoria
    // Procesar en bloques para mejor localidad de caché
    const blockSize = 16;
    for (let blockY = 0; blockY < height; blockY += blockSize) {
      for (let blockX = 0; blockX < width; blockX += blockSize) {
        // Procesar un bloque de píxeles
        const endY = Math.min(blockY + blockSize, height);
        const endX = Math.min(blockX + blockSize, width);
        
        for (let y = blockY; y < endY; y++) {
          const rowOffset = y * width;
          for (let x = blockX; x < endX; x++) {
            const pixelIndex = (rowOffset + x) * 4;
            const bufferIndex = rowOffset + x;
            
            redValues[bufferIndex] = data[pixelIndex];
            greenValues[bufferIndex] = data[pixelIndex + 1];
            blueValues[bufferIndex] = data[pixelIndex + 2];
          }
        }
      }
    }
    
    return { redValues, greenValues, blueValues };
  }, [config.useMemoryPooling]);
  
  /**
   * Procesa la señal de forma secuencial (cuando no se pueden usar WebWorkers)
   */
  const processSignalSequential = useCallback((
    redValues: number[], 
    greenValues: number[], 
    blueValues: number[]
  ): any => {
    // Calcular valores promedio para cada canal
    const calculateAverage = (values: number[]): number => {
      let sum = 0;
      const len = values.length;
      
      // Optimización de bucle para mejor rendimiento
      for (let i = 0; i < len; i += 4) {
        // Procesar 4 valores a la vez cuando sea posible
        const remaining = Math.min(4, len - i);
        for (let j = 0; j < remaining; j++) {
          sum += values[i + j];
        }
      }
      
      return sum / len;
    };
    
    const redAvg = calculateAverage(redValues);
    const greenAvg = calculateAverage(greenValues);
    const blueAvg = calculateAverage(blueValues);
    
    // Calcular señal compuesta ponderada
    const compositePPG = (redAvg * 0.6) + (greenAvg * 0.3) + (blueAvg * 0.1);
    
    // Calcular min/max para estimar amplitud
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    
    for (let i = 0; i < redValues.length; i++) {
      const val = redValues[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    
    const ac = max - min;
    const dc = (max + min) / 2;
    const perfusionIndex = dc > 0 ? ac / dc : 0;
    
    return {
      red: redAvg,
      green: greenAvg,
      blue: blueAvg,
      composite: compositePPG,
      ac,
      dc,
      perfusionIndex,
      quality: calculateSignalQuality(redValues),
      timestamp: Date.now()
    };
  }, []);
  
  /**
   * Calcula la calidad de la señal basada en relación señal-ruido
   */
  const calculateSignalQuality = useCallback((signal: number[]): number => {
    if (signal.length < 10) return 0;
    
    // Calcular energía de la señal
    let energySignal = 0;
    let energyDiff = 0;
    
    for (let i = 0; i < signal.length; i++) {
      energySignal += signal[i] * signal[i];
      
      if (i > 0) {
        const diff = signal[i] - signal[i - 1];
        energyDiff += diff * diff;
      }
    }
    
    // Evitar división por cero
    if (energyDiff === 0) return 0;
    
    // Calcular SNR simplificado
    const snr = energySignal / energyDiff;
    
    // Normalizar a escala 0-100
    return Math.min(100, Math.max(0, Math.round(snr * 10)));
  }, []);
  
  /**
   * Actualiza la configuración de procesamiento
   */
  const updateConfig = useCallback((newConfig: Partial<typeof config>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      
      // Registrar cambio de configuración
      telemetry.current.recordEvent(
        TelemetryCategory.SIGNAL_PROCESSING,
        'config_updated',
        updated
      );
      
      return updated;
    });
  }, []);
  
  /**
   * Reinicia el procesamiento y limpia los recursos
   */
  const reset = useCallback(async () => {
    console.log("useOptimizedSignalProcessing: Reseteando procesamiento");
    
    // Resetear contadores
    frameCountRef.current = 0;
    processingCountRef.current = 0;
    
    // Resetear worker
    await resetWorker();
    
    // Devolver y obtener nuevos buffers
    if (config.useMemoryPooling) {
      floatBufferPool.releaseBuffer(signalBufferRef.current);
      floatBufferPool.releaseBuffer(resultBufferRef.current);
      
      signalBufferRef.current = floatBufferPool.getBuffer(config.bufferSize);
      resultBufferRef.current = floatBufferPool.getBuffer(config.bufferSize);
    }
    
    // Registrar reset
    telemetry.current.recordEvent(
      TelemetryCategory.SIGNAL_PROCESSING,
      'processing_reset',
      { timestamp: Date.now() }
    );
    
  }, [resetWorker, config.useMemoryPooling, config.bufferSize]);
  
  /**
   * Obtiene información de diagnóstico
   */
  const getDiagnosticInfo = useCallback(() => {
    return {
      performanceStats,
      workerMetrics: getPerformanceMetrics(),
      memoryStats: floatBufferPool.getStats(),
      config,
      telemetryEvents: telemetry.current.getEvents().slice(-20),
      isWorkerAvailable
    };
  }, [performanceStats, getPerformanceMetrics, config, isWorkerAvailable]);

  return {
    processImageData,
    performanceStats,
    updateConfig,
    reset,
    getDiagnosticInfo,
    isWorkerAvailable,
    config
  };
};
