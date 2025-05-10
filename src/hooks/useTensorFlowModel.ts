import { useState, useEffect, useCallback, useRef } from 'react';
import { TensorFlowWorkerClient } from '../workers/tensorflow-worker-client';
import { detectOptimalConfig } from '../core/neural/tensorflow/TensorFlowConfig';
import { toast } from 'sonner';

// Cliente singleton para el worker
let workerClient: TensorFlowWorkerClient | null = null;

/**
 * Hook para utilizar modelos de TensorFlow.js en componentes React
 */
export function useTensorFlowModel(modelType: string, autoLoad: boolean = true) {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionTime, setPredictionTime] = useState(0);
  const [confidence, setConfidence] = useState(0.8);
  const [memoryInfo, setMemoryInfo] = useState<any>(null);
  const [predictionsCount, setPredictionsCount] = useState(0);
  
  // Inicializar el worker si no existe
  useEffect(() => {
    // SI EL MODELO ES VITAL-SIGNS-PPG, NO HACER NADA CON EL WORKER
    if (modelType === 'vital-signs-ppg') {
      console.warn(`[useTensorFlowModel] Worker y carga deshabilitados para ${modelType}`);
      setIsLoading(false);
      setIsReady(false); // Asegurarse de que no se considere listo
      setError('Carga deshabilitada para este modelo');
      return; // Salir temprano
    }

    const initWorker = async () => {
      try {
        if (!workerClient) {
          const optimalConfig = detectOptimalConfig();
          workerClient = new TensorFlowWorkerClient(optimalConfig);
        }
        
        if (autoLoad) {
          await loadModel();
        }
      } catch (error) {
        console.error('Error inicializando TensorFlow Worker:', error);
        setError(error instanceof Error ? error.message : 'Error desconocido');
      }
    };
    
    initWorker();
    
    // Limpiar al desmontar
    return () => {
      // No destruimos el cliente, solo si la aplicación se cierra completamente
    };
  }, [modelType, autoLoad]);
  
  // Cargar modelo
  const loadModel = useCallback(async () => {
    if (!workerClient) {
      throw new Error('TensorFlow Worker no inicializado');
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await workerClient.loadModel(modelType);
      
      setIsReady(true);
      setConfidence(0.8); // Valor inicial de confianza
      
      // Obtener información de memoria después de cargar
      const memory = await workerClient.getMemoryInfo();
      setMemoryInfo(memory);
    } catch (err: any) {
      console.error(`Error cargando modelo ${modelType}:`, err);
      setError(err.message || 'Error desconocido');
      setIsReady(false);
      toast.error(`Error cargando modelo ${modelType}`);
    } finally {
      setIsLoading(false);
    }
  }, [modelType]);
  
  // Limpiar memoria
  const cleanupMemory = useCallback(async () => {
    if (!workerClient) return;
    
    try {
      await workerClient.cleanupMemory();
      const memory = await workerClient.getMemoryInfo();
      setMemoryInfo(memory);
      console.log('Memoria limpiada:', memory);
    } catch (err) {
      console.error('Error limpiando memoria:', err);
    }
  }, []);
  
  // Función para predicción periódica
  useEffect(() => {
    // Cada 20 predicciones, limpiar memoria si supera un umbral
    if (predictionsCount > 0 && predictionsCount % 20 === 0 && memoryInfo) {
      if (memoryInfo.numBytes > 50 * 1024 * 1024) { // 50MB
        cleanupMemory();
      }
    }
  }, [predictionsCount, memoryInfo, cleanupMemory]);
  
  /**
   * Realiza una predicción con el modelo cargado
   */
  const predict = useCallback(async (input: number[]): Promise<number[]> => {
    if (!workerClient) {
      throw new Error('TensorFlow Worker no inicializado');
    }
    
    if (!isReady) {
      throw new Error(`Modelo ${modelType} no está listo`);
    }
    
    try {
      const startTime = performance.now();
      
      // Realizar predicción
      const result = await workerClient.predict(modelType, input);
      
      // Actualizar métricas
      const endTime = performance.now();
      setPredictionTime(endTime - startTime);
      setPredictionsCount(prev => prev + 1);
      
      // Ajustar confianza basada en tiempo y errores previos
      // En producción, esto se basaría en métricas más sofisticadas
      const timeConfidence = Math.max(0, 1 - ((endTime - startTime) / 1000));
      setConfidence(prev => (prev * 0.7) + (timeConfidence * 0.3));
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      setConfidence(prev => Math.max(0, prev - 0.2)); // Reducir confianza en caso de error
      throw err;
    }
  }, [isReady, modelType]);
  
  /**
   * Descarga y libera el modelo
   */
  const unloadModel = useCallback(async () => {
    if (!workerClient) return;
    
    try {
      await workerClient.disposeModel(modelType);
      setIsReady(false);
      console.log(`Modelo ${modelType} descargado`);
    } catch (err) {
      console.error(`Error descargando modelo ${modelType}:`, err);
    }
  }, [modelType]);
  
  return {
    predict,
    loadModel,
    unloadModel,
    cleanupMemory,
    isLoading,
    isReady,
    error,
    predictionTime,
    confidence,
    modelType,
    memoryInfo,
    predictionsCount
  };
}

/**
 * Hook para usar múltiples modelos TensorFlow simultáneamente
 */
export function useMultipleTensorFlowModels(modelTypes: string[]) {
  const [modelsReady, setModelsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Inicializar cliente
  useEffect(() => {
    if (!workerClient) {
      const optimalConfig = detectOptimalConfig();
      workerClient = new TensorFlowWorkerClient(optimalConfig);
    }
    
    // Cargar todos los modelos
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const modelStatusMap: Record<string, boolean> = {};
        
        // Cargar modelos en secuencia para evitar sobrecarga
        for (const modelType of modelTypes) {
          try {
            await workerClient!.loadModel(modelType);
            modelStatusMap[modelType] = true;
          } catch (err) {
            console.error(`Error cargando modelo ${modelType}:`, err);
            modelStatusMap[modelType] = false;
            // No lanzamos el error para intentar cargar los demás modelos
          }
        }
        
        setModelStatus(modelStatusMap);
        setModelsReady(Object.values(modelStatusMap).every(Boolean));
      } catch (err: any) {
        setError(err.message || 'Error cargando uno o más modelos');
        setModelsReady(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadModels();
    
    // Limpiar al desmontar
    return () => {
      // No destruir cliente, es compartido
    };
  }, [modelTypes]);
  
  /**
   * Predice utilizando un modelo específico
   */
  const predict = useCallback(async (modelType: string, input: number[]): Promise<number[]> => {
    if (!workerClient) {
      throw new Error('TensorFlow Worker no inicializado');
    }
    
    if (!modelStatus[modelType]) {
      throw new Error(`Modelo ${modelType} no está listo`);
    }
    
    try {
      return await workerClient.predict(modelType, input);
    } catch (err: any) {
      console.error(`Error en predicción con modelo ${modelType}:`, err);
      throw err;
    }
  }, [modelStatus]);
  
  /**
   * Recarga todos los modelos
   */
  const reloadAllModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Descargar todos los modelos primero
      for (const modelType of modelTypes) {
        if (modelStatus[modelType]) {
          await workerClient?.disposeModel(modelType);
        }
      }
      
      // Limpiar memoria
      await workerClient?.cleanupMemory();
      
      // Volver a cargar todos los modelos
      const newModelStatus: Record<string, boolean> = {};
      
      for (const modelType of modelTypes) {
        try {
          await workerClient!.loadModel(modelType);
          newModelStatus[modelType] = true;
        } catch (err) {
          console.error(`Error recargando modelo ${modelType}:`, err);
          newModelStatus[modelType] = false;
        }
      }
      
      setModelStatus(newModelStatus);
      setModelsReady(Object.values(newModelStatus).every(Boolean));
    } catch (err: any) {
      setError(err.message || 'Error recargando modelos');
    } finally {
      setIsLoading(false);
    }
  }, [modelTypes, modelStatus]);
  
  /**
   * Limpia la memoria y recursos
   */
  const cleanup = useCallback(async () => {
    if (!workerClient) return;
    
    try {
      await workerClient.cleanupMemory();
      console.log('Memoria limpiada');
    } catch (err) {
      console.error('Error limpiando memoria:', err);
    }
  }, []);
  
  return {
    predict,
    reloadAllModels,
    cleanup,
    isLoading,
    modelsReady,
    modelStatus,
    error
  };
}
