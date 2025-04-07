
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para gestionar el procesamiento en segundo plano usando Web Workers
 */
import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Opciones para el hook de procesamiento con worker
 */
interface WorkerProcessorOptions {
  workerPath: string;
  autoInitialize?: boolean;
  initialConfig?: any;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
}

/**
 * Hook para usar un Web Worker para procesamiento en segundo plano
 */
export function useWorkerProcessor(options: WorkerProcessorOptions) {
  const { 
    workerPath, 
    autoInitialize = true,
    initialConfig = {},
    onMessage,
    onError
  } = options;
  
  // Referencias para el worker y callbacks
  const workerRef = useRef<Worker | null>(null);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  
  // Estado del worker
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Actualizar referencias de callbacks cuando cambien
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);
  
  // Crear el worker cuando se monte el componente
  useEffect(() => {
    // Verificar si los Workers son soportados
    if (typeof Worker === 'undefined') {
      setError('Web Workers no son soportados en este navegador');
      return;
    }
    
    try {
      // Crear el worker
      const worker = new Worker(workerPath, { type: 'module' });
      
      // Configurar manejadores de eventos
      worker.onmessage = (event) => {
        const { type, payload, error: workerError } = event.data;
        
        if (workerError) {
          setError(workerError);
          onErrorRef.current?.(workerError);
          return;
        }
        
        if (type === 'INITIALIZED') {
          setIsInitialized(true);
          setError(null);
        } else if (type === 'READY' && autoInitialize) {
          // Inicializar automáticamente si está configurado
          worker.postMessage({
            type: 'INITIALIZE',
            payload: initialConfig
          });
        }
        
        // Enviar todos los mensajes al callback
        onMessageRef.current?.(event.data);
      };
      
      worker.onerror = (event) => {
        const errorMessage = `Error en worker: ${event.message}`;
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
      };
      
      workerRef.current = worker;
      
      // Limpiar worker al desmontar
      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsInitialized(false);
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear worker';
      setError(errorMessage);
      onErrorRef.current?.(errorMessage);
    }
  }, [workerPath, autoInitialize, initialConfig]);
  
  /**
   * Inicializa el worker con configuración personalizada
   */
  const initialize = useCallback((config = {}) => {
    if (!workerRef.current) {
      setError('Worker no disponible');
      return;
    }
    
    workerRef.current.postMessage({
      type: 'INITIALIZE',
      payload: config
    });
    
    setIsProcessing(true);
  }, []);
  
  /**
   * Envía un valor para procesar al worker
   */
  const processValue = useCallback((value: number) => {
    if (!workerRef.current || !isInitialized) {
      return;
    }
    
    workerRef.current.postMessage({
      type: 'PROCESS_SIGNAL',
      payload: { value, timestamp: Date.now() }
    });
  }, [isInitialized]);
  
  /**
   * Reinicia el worker
   */
  const reset = useCallback(() => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      type: 'RESET',
      payload: null
    });
    
    setIsProcessing(false);
  }, []);
  
  /**
   * Configura el worker
   */
  const configure = useCallback((config = {}) => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      type: 'CONFIGURE',
      payload: config
    });
  }, []);
  
  /**
   * Detiene el procesamiento
   */
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
  }, []);
  
  /**
   * Comienza o reanuda el procesamiento
   */
  const startProcessing = useCallback(() => {
    if (!isInitialized) {
      initialize({});
    } else {
      setIsProcessing(true);
    }
  }, [isInitialized, initialize]);
  
  return {
    isInitialized,
    error,
    isProcessing,
    worker: workerRef.current,
    
    // Acciones
    initialize,
    processValue,
    reset,
    configure,
    startProcessing,
    stopProcessing
  };
}
