
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook para procesamiento de señal PPG
 * VERSIÓN MEJORADA: Mayor sensibilidad para señales débiles
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { createPPGSignalProcessorAdapter } from '../modules/signal-processing/adapters/PPGSignalProcessorAdapter';
import { ProcessedPPGSignal } from '../modules/signal-processing/types';

/**
 * Hook para procesar señales PPG
 * Versión optimizada para señales más débiles
 */
export const useSignalProcessor = () => {
  // Crear procesador
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return createPPGSignalProcessorAdapter();
  });
  
  // Estado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastSignal, setLastSignal] = useState<ProcessedPPGSignal | null>(null);
  
  // Referencia para acceso en callbacks
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  
  // Contadores para diagnóstico
  const framesProcessed = useRef(0);
  const pixelSumAccumulator = useRef(0);
  const lastUpdateTime = useRef(Date.now());
  
  /**
   * Procesar un cuadro de imagen de la cámara
   * VERSIÓN MEJORADA: Mejor extracción de canal rojo para señales débiles
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessingRef.current) return;
    
    try {
      framesProcessed.current++;
      const now = Date.now();
      
      // Extraer canal rojo con un enfoque más sensible
      const data = imageData.data;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let count = 0;
      
      // Analizar solo el centro (40% central) para mayor precisión
      const centerWidth = Math.floor(imageData.width * 0.4);
      const centerHeight = Math.floor(imageData.height * 0.4);
      const startX = Math.floor((imageData.width - centerWidth) / 2);
      const startY = Math.floor((imageData.height - centerHeight) / 2);
      const endX = startX + centerWidth;
      const endY = startY + centerHeight;
      
      // Considerar menos píxeles para optimización
      const samplingStep = 4; // Analizar 1 de cada 4 píxeles
      
      for (let y = startY; y < endY; y += samplingStep) {
        for (let x = startX; x < endX; x += samplingStep) {
          const i = (y * imageData.width + x) * 4;
          redSum += data[i];         // Canal rojo
          greenSum += data[i + 1];   // Canal verde
          blueSum += data[i + 2];    // Canal azul
          count++;
        }
      }
      
      // Calcular promedio para cada canal
      const avgRed = redSum / count;
      const avgGreen = greenSum / count;
      const avgBlue = blueSum / count;
      
      // Normalizar a [0,1]
      const redNormalized = avgRed / 255;
      
      // Algoritmo mejorado: usar diferencia rojo-verde para reducir artefactos de iluminación
      // Red-Green parece captar mejor la señal PPG
      const redMinusGreen = (avgRed - avgGreen) / 255;
      
      // Usar también otros canales para diagnóstico
      const rgDiff = (avgRed - avgGreen) / 255;
      const rbDiff = (avgRed - avgBlue) / 255;
      
      // Valor compuesto: combinar técnicas para máxima sensibilidad
      // Usar mayor peso en el canal rojo para señales débiles
      const compositeValue = redNormalized * 0.7 + rgDiff * 0.3;
      
      // Acumular para análisis estadístico
      pixelSumAccumulator.current += redSum;
      
      // Registrar diagnóstico cada 30 frames para no saturar consola
      if (framesProcessed.current % 30 === 0) {
        const elapsed = now - lastUpdateTime.current;
        const fps = elapsed > 0 ? (30 / (elapsed / 1000)).toFixed(1) : "N/A";
        console.log("useSignalProcessor: Extracción de señal", {
          rojo: redNormalized.toFixed(4),
          rojoVerde: rgDiff.toFixed(4), 
          rojoAzul: rbDiff.toFixed(4),
          compuesto: compositeValue.toFixed(4),
          fps,
          frame: framesProcessed.current
        });
        lastUpdateTime.current = now;
      }
      
      // Procesar valor compuesto para mayor sensibilidad
      const result = processor.processSignal(compositeValue);
      setLastSignal(result);
      
      return result;
    } catch (error) {
      console.error("Error procesando frame:", error);
      return null;
    }
  }, [processor]);
  
  /**
   * Inicia el procesamiento
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    // Resetear estado
    framesProcessed.current = 0;
    pixelSumAccumulator.current = 0;
    lastUpdateTime.current = Date.now();
    
    setIsProcessing(true);
  }, []);
  
  /**
   * Detiene el procesamiento
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    setLastSignal(null);
  }, []);
  
  /**
   * Resetear procesador
   */
  const reset = useCallback(() => {
    processor.reset();
    
    framesProcessed.current = 0;
    pixelSumAccumulator.current = 0;
    
    console.log("useSignalProcessor: Procesador reseteado");
  }, [processor]);
  
  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      processor.reset();
    };
  }, [processor]);
  
  return {
    isProcessing,
    lastSignal,
    processFrame,
    startProcessing,
    stopProcessing,
    reset
  };
};
