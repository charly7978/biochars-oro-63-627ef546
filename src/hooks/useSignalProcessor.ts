
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para el procesamiento de señales PPG reales
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  // Create processor instance
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia de procesador REAL", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new SignalProcessor();
  });
  
  // Basic state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  // Set up processor callbacks
  useEffect(() => {
    // Signal callback for REAL data
    const onSignalReady = (signal: ProcessedSignal) => {
      console.log("useSignalProcessor: Señal real procesada:", {
        rawValue: signal.rawValue.toFixed(2),
        filteredValue: signal.filteredValue.toFixed(2),
        quality: signal.quality.toFixed(2),
        fingerDetected: signal.fingerDetected,
        timestamp: new Date().toISOString()
      });
      
      // Pass through without modifications - using real data
      setLastSignal(signal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Update signal statistics
      setSignalStats(prev => {
        return {
          minValue: Math.min(prev.minValue, signal.filteredValue),
          maxValue: Math.max(prev.maxValue, signal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
      });
    };

    // Error callback
    const onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento REAL:", error);
      setError(error);
    };

    // Add custom properties to processor for callbacks
    processor.onSignalReady = onSignalReady;
    processor.onError = onError;

    // Initialize processor - we need to call this for compatibility
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup
    return () => {
      // Stop processing if needed
      if (isProcessing) {
        processor.stop();
      }
    };
  }, [processor, isProcessing]);

  /**
   * Start processing real signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento de señales REALES");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    processor.reset(); // Reset processor first
    processor.start(); // Call start method
  }, [processor]);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento de señales REALES");
    
    setIsProcessing(false);
    processor.stop(); // Call stop method
  }, [processor]);

  /**
   * Process a frame from camera (REAL data)
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        // Log frame data occasionally
        if (framesProcessed % 30 === 0) {
          console.log("useSignalProcessor: Procesando frame REAL de cámara", {
            width: imageData.width,
            height: imageData.height,
            frameNumber: framesProcessed
          });
        }
        
        // Process the frame with REAL data
        processor.applySMAFilter(imageData.data[0]); // Use red channel data
        const processedValue = processor.getPPGValues().slice(-1)[0] || 0;
        
        // Create processed signal with REAL data
        const signal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: imageData.data[0],
          filteredValue: processedValue,
          quality: calculateSignalQuality(processor.getPPGValues()),
          fingerDetected: isFingerDetected(imageData),
          roi: null
        };
        
        // Set the processed signal
        setLastSignal(signal);
        setFramesProcessed(prev => prev + 1);
        
        return signal;
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame REAL:", err);
        return null;
      }
    }
    return null;
  }, [isProcessing, processor, framesProcessed]);

  // Helper function to detect finger presence based on image data
  const isFingerDetected = (imageData: ImageData): boolean => {
    // Sample the center of the image
    const centerOffset = ((imageData.height / 2) * imageData.width + (imageData.width / 2)) * 4;
    const r = imageData.data[centerOffset];
    const g = imageData.data[centerOffset + 1];
    const b = imageData.data[centerOffset + 2];
    
    // Check if red channel is dominant (finger typically appears more red)
    const isDominantRed = r > g + 20 && r > b + 20;
    
    // Check if average brightness is within range for finger
    const brightness = (r + g + b) / 3;
    const isBrightnessInRange = brightness > 50 && brightness < 200;
    
    return isDominantRed && isBrightnessInRange;
  };

  // Calculate signal quality based on REAL data
  const calculateSignalQuality = (values: number[]): number => {
    if (values.length < 10) return 0;
    
    // Calculate metrics from real signal data
    const recentValues = values.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calculate average and standard deviation
    const sum = recentValues.reduce((a, b) => a + b, 0);
    const avg = sum / recentValues.length;
    
    let varianceSum = 0;
    for (const value of recentValues) {
      varianceSum += Math.pow(value - avg, 2);
    }
    const stdDev = Math.sqrt(varianceSum / recentValues.length);
    
    // Calculate quality based on range and stability
    const rangeQuality = Math.min(100, range * 1000);
    const stabilityQuality = Math.max(0, 100 - (stdDev / avg) * 1000);
    
    // Combined quality score
    return Math.min(100, (rangeQuality * 0.4) + (stabilityQuality * 0.6));
  };

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
