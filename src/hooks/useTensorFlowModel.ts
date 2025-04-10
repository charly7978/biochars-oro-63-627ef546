
import { useState, useEffect, useCallback, useRef } from 'react';
import { TensorFlowWorkerClient } from '../workers/tensorflow-worker-client';

/**
 * Hook para utilizar modelos TensorFlow en componentes React
 * Gestiona carga, predicción y estado de modelos de manera declarativa
 */
export function useTensorFlowModel(modelType: string) {
  // Estado del modelo
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionTime, setPredictionTime] = useState<number>(0);
  
  // Cliente para comunicación con worker
  const clientRef = useRef<TensorFlowWorkerClient | null>(null);
  
  // Inicializar worker y cargar modelo
  useEffect(() => {
    // Crear cliente si no existe
    if (!clientRef.current) {
      clientRef.current = new TensorFlowWorkerClient();
    }
    
    // Función para cargar modelo
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Inicializar worker y cargar modelo
        await clientRef.current!.initialize();
        await clientRef.current!.loadModel(modelType);
        
        setIsReady(true);
      } catch (err: any) {
        setError(err.message || 'Error desconocido');
        console.error(`Error cargando modelo TensorFlow ${modelType}:`, err);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Cargar modelo
    loadModel();
    
    // Cleanup
    return () => {
      // No destruimos el cliente al desmontar para reutilizarlo
      // Solo se liberará cuando la aplicación se cierre
    };
  }, [modelType]);
  
  /**
   * Predecir utilizando el modelo
   */
  const predict = useCallback(async (input: number[]): Promise<number[]> => {
    if (!clientRef.current) {
      throw new Error('Cliente TensorFlow no inicializado');
    }
    
    if (!isReady) {
      throw new Error(`Modelo ${modelType} no está listo`);
    }
    
    try {
      // Medir tiempo de predicción
      const startTime = performance.now();
      
      // Ejecutar predicción
      const result = await clientRef.current.predict(modelType, input);
      
      // Actualizar tiempo de predicción
      const endTime = performance.now();
      setPredictionTime(endTime - startTime);
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      console.error(`Error prediciendo con modelo ${modelType}:`, err);
      throw err;
    }
  }, [modelType, isReady]);
  
  /**
   * Liberar recursos del modelo
   */
  const dispose = useCallback(async (): Promise<void> => {
    if (clientRef.current && isReady) {
      try {
        await clientRef.current.disposeModel(modelType);
        setIsReady(false);
      } catch (err: any) {
        console.error(`Error liberando modelo ${modelType}:`, err);
      }
    }
  }, [modelType, isReady]);
  
  return {
    predict,
    dispose,
    isLoading,
    isReady,
    error,
    predictionTime
  };
}

/**
 * Hook simplificado para usar múltiples modelos TensorFlow
 */
export function useTensorFlowModels(modelTypes: string[]) {
  // Estado de modelos
  const [modelsState, setModelsState] = useState<{
    isLoading: boolean;
    isReady: boolean;
    error: string | null;
  }>({
    isLoading: true,
    isReady: false,
    error: null
  });
  
  // Cliente para comunicación con worker
  const clientRef = useRef<TensorFlowWorkerClient | null>(null);
  
  // Inicializar worker y cargar modelos
  useEffect(() => {
    // Crear cliente si no existe
    if (!clientRef.current) {
      clientRef.current = new TensorFlowWorkerClient();
    }
    
    // Función para cargar modelos
    const loadModels = async () => {
      try {
        setModelsState({
          isLoading: true,
          isReady: false,
          error: null
        });
        
        // Inicializar worker
        await clientRef.current!.initialize();
        
        // Cargar todos los modelos en paralelo
        await Promise.all(
          modelTypes.map(modelType => clientRef.current!.loadModel(modelType))
        );
        
        setModelsState({
          isLoading: false,
          isReady: true,
          error: null
        });
      } catch (err: any) {
        setModelsState({
          isLoading: false,
          isReady: false,
          error: err.message || 'Error desconocido'
        });
        console.error('Error cargando modelos TensorFlow:', err);
      }
    };
    
    // Cargar modelos
    loadModels();
    
    // Cleanup
    return () => {
      // No destruimos el cliente al desmontar para reutilizarlo
    };
  }, [modelTypes.join(',')]);
  
  /**
   * Predecir utilizando un modelo específico
   */
  const predict = useCallback(async (modelType: string, input: number[]): Promise<number[]> => {
    if (!clientRef.current) {
      throw new Error('Cliente TensorFlow no inicializado');
    }
    
    if (!modelsState.isReady) {
      throw new Error('Los modelos no están listos');
    }
    
    try {
      // Ejecutar predicción
      return await clientRef.current.predict(modelType, input);
    } catch (err: any) {
      console.error(`Error prediciendo con modelo ${modelType}:`, err);
      throw err;
    }
  }, [modelsState.isReady]);
  
  return {
    ...modelsState,
    predict
  };
}
