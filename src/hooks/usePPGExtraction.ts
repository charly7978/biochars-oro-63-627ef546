
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para la extracción y procesamiento de datos PPG
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  CombinedExtractor, 
  CombinedExtractionResult,
  createCombinedExtractor 
} from '../modules/extraction/CombinedExtractor';

/**
 * Estado del procesamiento PPG
 */
interface ProcessingState {
  isProcessing: boolean;
  framesProcessed: number;
  startTime: number | null;
  lastUpdateTime: number;
}

/**
 * Hook para procesar y extraer datos de señales PPG
 */
export const usePPGExtraction = () => {
  // Extractores
  const [extractor] = useState(() => {
    console.log("usePPGExtraction: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return createCombinedExtractor();
  });
  
  // Estado de procesamiento
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    framesProcessed: 0,
    startTime: null,
    lastUpdateTime: Date.now()
  });
  
  // Resultados
  const [lastResult, setLastResult] = useState<CombinedExtractionResult | null>(null);
  const [heartRate, setHeartRate] = useState<number>(0);
  const [signalQuality, setSignalQuality] = useState<number>(0);
  const [fingerDetected, setFingerDetected] = useState<boolean>(false);
  
  // Referencias
  const processingStateRef = useRef(processingState);
  processingStateRef.current = processingState;
  
  /**
   * Procesa un valor PPG
   */
  const processValue = useCallback((value: number) => {
    if (!processingStateRef.current.isProcessing) return null;
    
    try {
      // Extraer datos combinados
      const result = extractor.processValue(value);
      
      // Actualizar estado
      setLastResult(result);
      setSignalQuality(result.quality);
      setFingerDetected(result.fingerDetected);
      
      // Actualizar ritmo cardíaco si hay confianza suficiente
      if (result.averageBPM !== null && result.confidence > 0.4) {
        setHeartRate(result.averageBPM);
      }
      
      // Actualizar contador de frames
      setProcessingState(prev => ({
        ...prev,
        framesProcessed: prev.framesProcessed + 1,
        lastUpdateTime: Date.now()
      }));
      
      return result;
    } catch (error) {
      console.error("Error procesando valor PPG:", error);
      return null;
    }
  }, [extractor]);
  
  /**
   * Procesa un frame de la cámara para extraer valor PPG
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!processingStateRef.current.isProcessing) return;
    
    try {
      // Extraer valor PPG del frame (promedio de canal rojo)
      const data = imageData.data;
      let sum = 0;
      const step = 4; // Para eficiencia, muestrear cada 4 píxeles
      
      for (let i = 0; i < data.length; i += 4 * step) {
        sum += data[i]; // Canal rojo
      }
      
      const totalPixels = data.length / (4 * step);
      const ppgValue = sum / totalPixels / 255; // Normalizar a [0,1]
      
      // Procesar el valor PPG
      processValue(ppgValue);
    } catch (error) {
      console.error("Error procesando frame:", error);
    }
  }, [processValue]);
  
  /**
   * Inicia el procesamiento
   */
  const startProcessing = useCallback(() => {
    console.log("usePPGExtraction: Iniciando procesamiento");
    
    setProcessingState({
      isProcessing: true,
      framesProcessed: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    });
    
    setHeartRate(0);
    setSignalQuality(0);
    setFingerDetected(false);
    setLastResult(null);
  }, []);
  
  /**
   * Detiene el procesamiento
   */
  const stopProcessing = useCallback(() => {
    console.log("usePPGExtraction: Deteniendo procesamiento");
    
    setProcessingState(prev => ({
      ...prev,
      isProcessing: false
    }));
  }, []);
  
  /**
   * Reinicia completamente el procesamiento
   */
  const reset = useCallback(() => {
    console.log("usePPGExtraction: Reiniciando procesamiento");
    
    extractor.reset();
    
    setProcessingState({
      isProcessing: false,
      framesProcessed: 0,
      startTime: null,
      lastUpdateTime: Date.now()
    });
    
    setHeartRate(0);
    setSignalQuality(0);
    setFingerDetected(false);
    setLastResult(null);
  }, [extractor]);
  
  return {
    // Estado
    isProcessing: processingState.isProcessing,
    framesProcessed: processingState.framesProcessed,
    
    // Resultados
    lastResult,
    heartRate,
    signalQuality,
    fingerDetected,
    
    // Acciones
    processValue,
    processFrame,
    startProcessing,
    stopProcessing,
    reset
  };
};
