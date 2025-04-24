
import { useState, useEffect, useCallback, useRef } from 'react';
import TensorFlowService from '../services/TensorFlowService';
import { toast } from 'sonner';

/**
 * Hook optimizado para utilizar TensorFlow con modelos de procesamiento PPG
 */
export function useTensorFlowProcessor(modelType: string, autoLoad: boolean = true) {
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionTime, setPredictionTime] = useState(0);
  const [confidence, setConfidence] = useState(0.8);
  const [predictionsCount, setPredictionsCount] = useState(0);
  
  // Referencia al último input para diagnóstico
  const lastInputRef = useRef<number[]>([]);
  const lastOutputRef = useRef<number[]>([]);
  const predictionsTimeRef = useRef<number[]>([]);
  
  // Inicializar el servicio TensorFlow
  useEffect(() => {
    const initModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Inicializar servicio
        await TensorFlowService.initialize();
        
        if (autoLoad) {
          // Cargar modelo específico
          await TensorFlowService.loadModel(modelType);
          setIsReady(true);
          setConfidence(0.8); // Valor inicial de confianza
        }
      } catch (err) {
        console.error(`Error inicializando modelo ${modelType}:`, err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setIsReady(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    initModel();
  }, [modelType, autoLoad]);
  
  /**
   * Carga el modelo manualmente
   */
  const loadModel = useCallback(async () => {
    if (isReady) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      await TensorFlowService.loadModel(modelType);
      
      setIsReady(true);
      setConfidence(0.8); // Valor inicial de confianza
    } catch (err) {
      console.error(`Error cargando modelo ${modelType}:`, err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsReady(false);
      toast.error(`Error cargando modelo ${modelType}`);
    } finally {
      setIsLoading(false);
    }
  }, [modelType, isReady]);
  
  /**
   * Realiza una predicción optimizada con el modelo cargado
   */
  const predict = useCallback(async (input: number[]): Promise<number[]> => {
    if (!isReady) {
      throw new Error(`Modelo ${modelType} no está listo`);
    }
    
    try {
      const startTime = performance.now();
      
      // Guardar input para diagnóstico
      lastInputRef.current = input.slice();
      
      // Realizar predicción
      const result = await TensorFlowService.predict(modelType, input);
      
      // Guardar output para diagnóstico
      lastOutputRef.current = result.slice();
      
      // Actualizar métricas
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      setPredictionTime(processingTime);
      
      // Registrar tiempo para análisis de rendimiento
      predictionsTimeRef.current.push(processingTime);
      if (predictionsTimeRef.current.length > 50) {
        predictionsTimeRef.current.shift();
      }
      
      setPredictionsCount(prev => prev + 1);
      
      // Ajustar confianza basada en tiempo y consistencia
      const timeConfidence = Math.max(0, 1 - (processingTime / 1000));
      let stabilityFactor = 0.9;
      
      if (predictionsTimeRef.current.length >= 3) {
        const recent = predictionsTimeRef.current.slice(-3);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
        const stability = Math.max(0, 1 - Math.sqrt(variance) / avg);
        stabilityFactor = 0.7 + (stability * 0.3);
      }
      
      setConfidence(prev => (prev * stabilityFactor) + (timeConfidence * (1 - stabilityFactor)));
      
      // Gestión automática de memoria cada 20 predicciones
      if (predictionsCount > 0 && predictionsCount % 20 === 0) {
        checkMemoryUsage();
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setConfidence(prev => Math.max(0, prev - 0.2)); // Reducir confianza en caso de error
      
      console.error(`Error en predicción con modelo ${modelType}:`, err, {
        inputLength: input.length,
        inputSample: input.slice(0, 5)
      });
      
      throw err;
    }
  }, [isReady, modelType, predictionsCount]);
  
  /**
   * Comprueba uso de memoria y realiza limpieza si es necesario
   */
  const checkMemoryUsage = useCallback(async () => {
    try {
      await TensorFlowService.cleanupMemory();
    } catch (err) {
      console.warn('Error comprobando/limpiando memoria:', err);
    }
  }, []);
  
  /**
   * Descarga y libera el modelo
   */
  const unloadModel = useCallback(async () => {
    try {
      await TensorFlowService.disposeModel(modelType);
      setIsReady(false);
      setConfidence(0.8);
      
      // Limpiar métricas
      predictionsTimeRef.current = [];
      lastInputRef.current = [];
      lastOutputRef.current = [];
      
      console.log(`Modelo ${modelType} descargado`);
    } catch (err) {
      console.error(`Error descargando modelo ${modelType}:`, err);
    }
  }, [modelType]);
  
  /**
   * Obtiene diagnóstico detallado para depuración
   */
  const getDiagnostics = useCallback(() => {
    return {
      modelType,
      isReady,
      predictionsCount,
      avgPredictionTime: predictionsTimeRef.current.length > 0 
        ? predictionsTimeRef.current.reduce((a, b) => a + b, 0) / predictionsTimeRef.current.length 
        : 0,
      lastInputSample: lastInputRef.current.slice(0, 10),
      lastOutputSample: lastOutputRef.current,
      confidence
    };
  }, [modelType, isReady, predictionsCount, confidence]);

  return {
    predict,
    loadModel,
    unloadModel,
    cleanupMemory: checkMemoryUsage,
    isLoading,
    isReady,
    error,
    predictionTime,
    confidence,
    modelType,
    getDiagnostics
  };
}
