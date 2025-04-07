
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE
 */

import { useRef, useEffect, useCallback } from 'react';
import { CodeProtectionShield } from '../core/protection/CodeProtectionShield';

// Tipo para las respuestas del worker
interface WorkerResponse {
  type: string;
  result?: any;
  filtered?: number[];
  transformed?: number[];
  id?: string;
}

// Tipo para las llamadas pendientes
interface PendingCall {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
  type: string;
}

/**
 * Hook para gestionar procesamiento paralelo con WebWorkers
 * Implementa gestión avanzada de memoria y telemetría
 */
export const useParallelProcessing = () => {
  // Referencias a workers y estado
  const workerRef = useRef<Worker | null>(null);
  const pendingCallsRef = useRef<Map<string, PendingCall>>(new Map());
  const callIdCounterRef = useRef<number>(0);
  const protectionShield = useRef<CodeProtectionShield>(CodeProtectionShield.getInstance());
  
  // Métricas de rendimiento
  const performanceMetricsRef = useRef<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalProcessingTime: number;
    maxProcessingTime: number;
    minProcessingTime: number;
    callsByType: Record<string, number>;
  }>({
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalProcessingTime: 0,
    maxProcessingTime: 0,
    minProcessingTime: Infinity,
    callsByType: {}
  });

  // Inicializar el worker
  useEffect(() => {
    // Verificar soporte para WebWorkers
    if (typeof Worker === 'undefined') {
      console.warn('WebWorkers no están soportados en este navegador. Usando procesamiento en hilo principal.');
      return;
    }
    
    try {
      // Crear el worker
      workerRef.current = new Worker(new URL('../workers/signal-processor.worker.ts', import.meta.url), {
        type: 'module'
      });
      
      // Registrar intento de cambio
      protectionShield.current.logVerification({
        type: 'initialization',
        result: {
          success: true,
          message: 'Worker de procesamiento paralelo inicializado',
          details: {}
        },
        timestamp: Date.now(),
        context: {
          fileName: 'useParallelProcessing.ts',
          moduleName: 'hooks'
        }
      });
      
      // Configurar el manejador de mensajes
      workerRef.current.onmessage = handleWorkerMessage;
      
      // Inicializar el worker con búferes preasignados
      initializeWorker();
      
      console.log('Procesamiento paralelo: WebWorker inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar WebWorker:', error);
      protectionShield.current.logVerification({
        type: 'initialization',
        result: {
          success: false,
          message: `Error al inicializar WebWorker: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          details: { error }
        },
        timestamp: Date.now(),
        context: {
          fileName: 'useParallelProcessing.ts',
          moduleName: 'hooks'
        }
      });
    }
    
    // Limpieza al desmontar
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        console.log('Procesamiento paralelo: WebWorker terminado');
      }
    };
  }, []);

  // Inicializar el worker con configuración de búferes
  const initializeWorker = useCallback(() => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      type: 'init',
      data: {
        bufferSizes: {
          filter: 64,
          signal: 512,
          result: 512
        }
      }
    });
  }, []);

  // Manejar mensajes del worker
  const handleWorkerMessage = useCallback((e: MessageEvent<WorkerResponse>) => {
    const { type, result, filtered, transformed, id } = e.data;
    
    if (type === 'initialized') {
      console.log('Procesamiento paralelo: Worker inicializado con búferes preasignados');
      return;
    }
    
    if (type === 'reset-complete') {
      console.log('Procesamiento paralelo: Worker reseteado');
      return;
    }
    
    // Procesar respuestas con ID (para promesas pendientes)
    if (id && pendingCallsRef.current.has(id)) {
      const pendingCall = pendingCallsRef.current.get(id)!;
      const processingTime = Date.now() - pendingCall.timestamp;
      
      // Actualizar métricas de rendimiento
      updatePerformanceMetrics(pendingCall.type, processingTime, true);
      
      // Resolver la promesa pendiente con el resultado correspondiente
      switch (type) {
        case 'process-result':
          pendingCall.resolve(result);
          break;
        case 'filter-result':
          pendingCall.resolve(filtered);
          break;
        case 'wavelet-result':
          pendingCall.resolve(transformed);
          break;
        default:
          pendingCall.resolve(e.data);
      }
      
      // Eliminar la llamada pendiente
      pendingCallsRef.current.delete(id);
    }
  }, []);

  // Actualizar métricas de rendimiento
  const updatePerformanceMetrics = useCallback((callType: string, processingTime: number, success: boolean) => {
    const metrics = performanceMetricsRef.current;
    
    metrics.totalCalls++;
    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }
    
    metrics.totalProcessingTime += processingTime;
    metrics.maxProcessingTime = Math.max(metrics.maxProcessingTime, processingTime);
    metrics.minProcessingTime = Math.min(metrics.minProcessingTime, processingTime);
    
    // Actualizar contador por tipo
    metrics.callsByType[callType] = (metrics.callsByType[callType] || 0) + 1;
    
    // Log periódico de métricas (cada 100 llamadas)
    if (metrics.totalCalls % 100 === 0) {
      console.log('Métricas de rendimiento del procesamiento paralelo:', {
        totalCalls: metrics.totalCalls,
        successRate: (metrics.successfulCalls / metrics.totalCalls) * 100,
        avgProcessingTime: metrics.totalProcessingTime / metrics.totalCalls,
        maxProcessingTime: metrics.maxProcessingTime,
        minProcessingTime: metrics.minProcessingTime === Infinity ? 0 : metrics.minProcessingTime,
        callsByType: metrics.callsByType
      });
    }
  }, []);

  // Generar un ID único para cada llamada
  const generateCallId = useCallback(() => {
    return `call_${Date.now()}_${callIdCounterRef.current++}`;
  }, []);

  // Procesar señal en paralelo
  const processSignalParallel = useCallback((signal: number[], sampleRate: number = 30): Promise<any> => {
    if (!workerRef.current) {
      console.warn('Procesamiento paralelo: WebWorker no disponible, procesando en hilo principal');
      return Promise.resolve(null);
    }
    
    const callId = generateCallId();
    const callType = 'process-signal';
    
    return new Promise((resolve, reject) => {
      // Registrar la llamada pendiente
      pendingCallsRef.current.set(callId, {
        resolve,
        reject,
        timestamp: Date.now(),
        type: callType
      });
      
      // Enviar mensaje al worker
      workerRef.current!.postMessage({
        type: callType,
        data: {
          signal,
          sampleRate,
          id: callId
        }
      });
      
      // Configurar timeout por seguridad
      setTimeout(() => {
        if (pendingCallsRef.current.has(callId)) {
          const pendingCall = pendingCallsRef.current.get(callId)!;
          updatePerformanceMetrics(pendingCall.type, Date.now() - pendingCall.timestamp, false);
          pendingCallsRef.current.delete(callId);
          reject(new Error('Timeout al procesar señal en paralelo'));
        }
      }, 5000);
    });
  }, [generateCallId]);

  // Aplicar filtros en paralelo
  const applyFiltersParallel = useCallback((values: number[], config: any): Promise<number[]> => {
    if (!workerRef.current) {
      console.warn('Procesamiento paralelo: WebWorker no disponible, procesando en hilo principal');
      return Promise.resolve(values);
    }
    
    const callId = generateCallId();
    const callType = 'filter-data';
    
    return new Promise((resolve, reject) => {
      // Registrar la llamada pendiente
      pendingCallsRef.current.set(callId, {
        resolve,
        reject,
        timestamp: Date.now(),
        type: callType
      });
      
      // Enviar mensaje al worker
      workerRef.current!.postMessage({
        type: callType,
        data: {
          values,
          config,
          id: callId
        }
      });
      
      // Configurar timeout por seguridad
      setTimeout(() => {
        if (pendingCallsRef.current.has(callId)) {
          const pendingCall = pendingCallsRef.current.get(callId)!;
          updatePerformanceMetrics(pendingCall.type, Date.now() - pendingCall.timestamp, false);
          pendingCallsRef.current.delete(callId);
          reject(new Error('Timeout al aplicar filtros en paralelo'));
        }
      }, 5000);
    });
  }, [generateCallId]);

  // Aplicar transformada wavelet en paralelo
  const applyWaveletTransformParallel = useCallback((values: number[], level: number = 3): Promise<number[]> => {
    if (!workerRef.current) {
      console.warn('Procesamiento paralelo: WebWorker no disponible, procesando en hilo principal');
      return Promise.resolve(values);
    }
    
    const callId = generateCallId();
    const callType = 'wavelet-transform';
    
    return new Promise((resolve, reject) => {
      // Registrar la llamada pendiente
      pendingCallsRef.current.set(callId, {
        resolve,
        reject,
        timestamp: Date.now(),
        type: callType
      });
      
      // Enviar mensaje al worker
      workerRef.current!.postMessage({
        type: callType,
        data: {
          values,
          level,
          id: callId
        }
      });
      
      // Configurar timeout por seguridad
      setTimeout(() => {
        if (pendingCallsRef.current.has(callId)) {
          const pendingCall = pendingCallsRef.current.get(callId)!;
          updatePerformanceMetrics(pendingCall.type, Date.now() - pendingCall.timestamp, false);
          pendingCallsRef.current.delete(callId);
          reject(new Error('Timeout al aplicar transformada wavelet'));
        }
      }, 5000);
    });
  }, [generateCallId]);

  // Resetear el worker
  const resetWorker = useCallback(() => {
    if (!workerRef.current) return Promise.resolve();
    
    return new Promise<void>((resolve) => {
      workerRef.current!.postMessage({ type: 'reset' });
      
      // Reset completo esperando un tiempo corto
      setTimeout(() => {
        // Limpiar todas las llamadas pendientes
        pendingCallsRef.current.forEach((call) => {
          call.reject(new Error('Worker reseteado'));
        });
        pendingCallsRef.current.clear();
        resolve();
      }, 100);
    });
  }, []);

  // Obtener métricas de rendimiento actuales
  const getPerformanceMetrics = useCallback(() => {
    const metrics = performanceMetricsRef.current;
    
    return {
      totalCalls: metrics.totalCalls,
      successRate: metrics.totalCalls > 0 ? (metrics.successfulCalls / metrics.totalCalls) * 100 : 0,
      avgProcessingTime: metrics.totalCalls > 0 ? metrics.totalProcessingTime / metrics.totalCalls : 0,
      maxProcessingTime: metrics.maxProcessingTime,
      minProcessingTime: metrics.minProcessingTime === Infinity ? 0 : metrics.minProcessingTime,
      callsByType: { ...metrics.callsByType }
    };
  }, []);

  return {
    isWorkerAvailable: !!workerRef.current,
    processSignalParallel,
    applyFiltersParallel,
    applyWaveletTransformParallel,
    resetWorker,
    getPerformanceMetrics
  };
};
