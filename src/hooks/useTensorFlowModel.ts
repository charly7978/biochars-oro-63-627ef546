
import { useState, useEffect, useCallback } from 'react';
import { TensorFlowWorkerClient } from '../workers/tensorflow-worker-client';

// Cliente singleton para el worker
let workerClient: TensorFlowWorkerClient | null = null;

/**
 * Hook para utilizar modelos de TensorFlow.js en componentes React
 */
export function useTensorFlowModel(modelType: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionTime, setPredictionTime] = useState(0);
  const [confidence, setConfidence] = useState(0);
  
  // Inicializar el worker si no existe
  useEffect(() => {
    if (!workerClient) {
      workerClient = new TensorFlowWorkerClient();
    }
    
    // Cargar el modelo específico
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await workerClient!.loadModel(modelType);
        
        setIsReady(true);
        setConfidence(0.8); // Valor inicial de confianza
      } catch (err: any) {
        console.error(`Error cargando modelo ${modelType}:`, err);
        setError(err.message || 'Error desconocido');
        setIsReady(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadModel();
    
    // Limpiar al desmontar
    return () => {
      // No destruimos el cliente, solo si la aplicación se cierra completamente
    };
  }, [modelType]);
  
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
  
  return {
    predict,
    isLoading,
    isReady,
    error,
    predictionTime,
    confidence,
    modelType,
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
      workerClient = new TensorFlowWorkerClient();
    }
    
    // Cargar todos los modelos
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const modelStatusMap: Record<string, boolean> = {};
        
        // Cargar modelos en paralelo
        await Promise.all(
          modelTypes.map(async (modelType) => {
            try {
              await workerClient!.loadModel(modelType);
              modelStatusMap[modelType] = true;
            } catch (err) {
              console.error(`Error cargando modelo ${modelType}:`, err);
              modelStatusMap[modelType] = false;
              throw err; // Re-lanzar para manejo global
            }
          })
        );
        
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
  
  return {
    predict,
    isLoading,
    modelsReady,
    modelStatus,
    error
  };
}
