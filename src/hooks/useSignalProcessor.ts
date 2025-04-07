/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGProcessor } from '../core/signal/PPGProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { MovementCompensator } from '../core/signal/artifacts/MovementCompensator';

/**
 * Hook mejorado para el procesamiento de señales PPG reales
 * Incluye capacidades de ROI dinámico, análisis multicanal y compensación de movimiento
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia con capacidades avanzadas", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9),
      features: ["ROI dinámico", "Análisis multicanal", "Reducción de artefactos"]
    });
    
    return new PPGProcessor();
  });
  
  // Movimiento compensator
  const movementCompensatorRef = useRef(new MovementCompensator());
  
  // Basic state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  
  // Estadísticas mejoradas para cada canal
  const [signalStats, setSignalStats] = useState({
    // Canal rojo
    red: {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    },
    // Canal verde
    green: {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    },
    // Canal azul
    blue: {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    },
    // Señal compuesta
    composite: {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    }
  });

  // Variables para control de acceso a acelerómetro
  const hasMotionPermission = useRef<boolean>(false);
  const accelDataRef = useRef<{x: number, y: number, z: number} | null>(null);

  // Intentar obtener acceso al acelerómetro si está disponible
  useEffect(() => {
    const requestMotionPermission = async () => {
      try {
        // Verificar si DeviceMotionEvent está disponible
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          
          if (permission === 'granted') {
            console.log("useSignalProcessor: Permiso de movimiento concedido");
            hasMotionPermission.current = true;
            
            // Añadir listener de movimiento
            window.addEventListener('devicemotion', handleMotionEvent);
          } else {
            console.warn("useSignalProcessor: Permiso de movimiento denegado");
          }
        } else if (typeof DeviceMotionEvent !== 'undefined') {
          // En dispositivos sin requestPermission (e.g., Android)
          hasMotionPermission.current = true;
          window.addEventListener('devicemotion', handleMotionEvent);
          console.log("useSignalProcessor: Eventos de movimiento disponibles sin permiso explícito");
        } else {
          console.warn("useSignalProcessor: DeviceMotionEvent no disponible");
        }
      } catch (error) {
        console.error("useSignalProcessor: Error solicitando permiso de movimiento:", error);
      }
    };
    
    const handleMotionEvent = (event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity) {
        accelDataRef.current = {
          x: event.accelerationIncludingGravity.x || 0,
          y: event.accelerationIncludingGravity.y || 0,
          z: event.accelerationIncludingGravity.z || 0
        };
      }
    };
    
    // Solo solicitar permiso en dispositivos móviles
    if (('ontouchstart' in window) || 
        (navigator.maxTouchPoints > 0)) {
      requestMotionPermission();
    }
    
    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
    };
  }, []);

  // Set up processor callbacks and cleanup
  useEffect(() => {
    // Signal callback con mejora multicanal
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const finalSignal = { ...signal };
      
      // Aplicar compensación de movimiento si hay datos disponibles
      if (accelDataRef.current && signal.fingerDetected) {
        // Calcular magnitud total de aceleración
        const accel = accelDataRef.current;
        const accelMagnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
        
        // Compensar movimiento
        const movementResult = movementCompensatorRef.current.processSignal(
          signal.filteredValue, 
          accelMagnitude
        );
        
        // Actualizar señal con datos de movimiento
        finalSignal.filteredValue = movementResult.correctedValue;
        finalSignal.movementData = {
          detected: movementResult.movementDetected,
          intensity: movementResult.movementIntensity,
          isReliable: movementResult.isReliable
        };
        
        // Si el movimiento es demasiado intenso, reducir la calidad de la señal
        if (movementResult.movementDetected && movementResult.movementIntensity > 0.5) {
          finalSignal.quality = Math.max(0, finalSignal.quality * 
            (1 - (movementResult.movementIntensity - 0.5) * 2));
        }
      } else if (signal.fingerDetected) {
        // Sin datos de acelerómetro, usar solo la señal para detectar movimiento
        const movementResult = movementCompensatorRef.current.processSignal(
          signal.filteredValue
        );
        
        finalSignal.movementData = {
          detected: movementResult.movementDetected,
          intensity: movementResult.movementIntensity,
          isReliable: movementResult.isReliable
        };
        
        // Solo aplicar corrección de señal si el movimiento es moderado
        if (movementResult.movementDetected && movementResult.movementIntensity < 0.7) {
          finalSignal.filteredValue = movementResult.correctedValue;
        }
      }
      
      // Actualizar estado
      setLastSignal(finalSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas por canal si hay datos multicanal
      if (signal.channelData) {
        setSignalStats(prev => {
          const updateStats = (
            channelStats: {minValue: number, maxValue: number, avgValue: number, totalValues: number},
            newValue: number
          ) => {
            return {
              minValue: Math.min(channelStats.minValue, newValue),
              maxValue: Math.max(channelStats.maxValue, newValue),
              avgValue: (channelStats.avgValue * channelStats.totalValues + newValue) / (channelStats.totalValues + 1),
              totalValues: channelStats.totalValues + 1
            };
          };
          
          return {
            red: updateStats(prev.red, signal.channelData.red),
            green: updateStats(prev.green, signal.channelData.green),
            blue: updateStats(prev.blue, signal.channelData.blue),
            composite: updateStats(prev.composite, signal.channelData.composite)
          };
        });
      }
    };

    // Error callback
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento avanzado:", error);
      setError(error);
    };

    // Initialize processor
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización avanzada:", error);
    });

    // Cleanup
    return () => {
      processor.stop();
    };
  }, [processor]);

  /**
   * Start processing signals with capacidades avanzadas
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento con capacidades avanzadas", {
      hasMotionSensors: hasMotionPermission.current
    });
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      red: { minValue: Infinity, maxValue: -Infinity, avgValue: 0, totalValues: 0 },
      green: { minValue: Infinity, maxValue: -Infinity, avgValue: 0, totalValues: 0 },
      blue: { minValue: Infinity, maxValue: -Infinity, avgValue: 0, totalValues: 0 },
      composite: { minValue: Infinity, maxValue: -Infinity, avgValue: 0, totalValues: 0 }
    });
    
    // Reiniciar compensador de movimiento
    movementCompensatorRef.current.resetHistory();
    
    processor.start();
  }, [processor]);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento avanzado");
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Process a frame from camera with análisis multicanal
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame con capacidades avanzadas:", err);
      }
    }
  }, [isProcessing, processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    hasMotionSensors: hasMotionPermission.current
  };
};
