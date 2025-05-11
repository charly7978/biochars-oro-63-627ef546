
import { useState, useCallback, useRef } from 'react';
import { calculateSignalQuality } from '@/modules/heart-beat/signal-quality';

// Type definitions
export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  rrData?: {
    intervals: number[];
    timestamps: number[];
  };
}

export interface HeartBeatProcessor {
  processSignal: (signalValue: number) => HeartBeatResult;
  processVideoFrame: (imageData: ImageData | Uint8Array | Uint8ClampedArray, width: number, height: number) => Promise<HeartBeatResult>;
  reset: () => void;
  fullReset: () => void;
  signalQuality: number;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

export const useHeartBeatProcessor = (): HeartBeatProcessor => {
  const [signalQuality, setSignalQuality] = useState(0);
  const signalBuffer = useRef<number[]>([]);
  const peakBuffer = useRef<{ value: number; timestamp: number }[]>([]);
  const lastTimestamp = useRef<number>(Date.now());
  const isMonitoring = useRef<boolean>(false);
  
  const startMonitoring = useCallback(() => {
    isMonitoring.current = true;
    signalBuffer.current = [];
    peakBuffer.current = [];
    lastTimestamp.current = Date.now();
  }, []);

  const stopMonitoring = useCallback(() => {
    isMonitoring.current = false;
  }, []);
  
  /**
   * Procesa un valor de señal PPG
   */
  const processSignal = useCallback((signalValue: number): HeartBeatResult => {
    const currentTime = Date.now();
    const elapsed = currentTime - lastTimestamp.current;
    lastTimestamp.current = currentTime;
    
    // Añadir el valor al buffer
    signalBuffer.current.push(signalValue);
    
    // Mantener un buffer de tamaño razonable
    const MAX_BUFFER_SIZE = 300;
    if (signalBuffer.current.length > MAX_BUFFER_SIZE) {
      signalBuffer.current = signalBuffer.current.slice(-MAX_BUFFER_SIZE);
    }
    
    // Evaluar calidad de la señal
    const quality = calculateSignalQuality(signalBuffer.current);
    setSignalQuality(quality);
    
    // Detectar picos si hay suficientes datos
    if (signalBuffer.current.length >= 100) {
      const peaks = findPeaks(signalBuffer.current);
      
      // Registrar picos con timestamp
      peaks.forEach(peak => {
        // La posición del pico es relativa al buffer actual
        // Calculamos el timestamp aproximado
        const peakTime = currentTime - (peaks[peaks.length - 1] - peak) * (elapsed / 1);
        peakBuffer.current.push({ value: signalValue, timestamp: peakTime });
      });
      
      // Mantener un buffer de picos razonable
      const MAX_PEAKS = 30;
      if (peakBuffer.current.length > MAX_PEAKS) {
        peakBuffer.current = peakBuffer.current.slice(-MAX_PEAKS);
      }
    }
    
    // Calcular BPM si tenemos suficientes picos
    if (peakBuffer.current.length >= 3) {
      const timestamps = peakBuffer.current.map(p => p.timestamp);
      const bpm = calculateBPM(timestamps);
      const rrData = getRRData(timestamps);
      
      return {
        bpm,
        confidence: quality / 100,
        rrData
      };
    }
    
    return {
      bpm: 0,
      confidence: 0
    };
  }, []);

  // Helper functions that need to be implemented since they are missing from imports
  const findPeaks = (signal: number[]): number[] => {
    // Simple peak detection algorithm
    const peaks: number[] = [];
    const threshold = 0.5;
    
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  };

  const calculateBPM = (timestamps: number[]): number => {
    if (timestamps.length < 2) return 0;
    
    // Calculate average interval between peaks
    let totalInterval = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalInterval += timestamps[i] - timestamps[i - 1];
    }
    
    const avgInterval = totalInterval / (timestamps.length - 1);
    // Convert to BPM (60000 ms in a minute)
    return Math.round(60000 / avgInterval);
  };

  const getRRData = (timestamps: number[]): { intervals: number[], timestamps: number[] } => {
    if (timestamps.length < 2) {
      return { intervals: [], timestamps: [] };
    }
    
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    return { intervals, timestamps };
  };
  
  /**
   * Procesa un frame de video
   * En este caso, esta es una implementación de placeholder
   */
  const processVideoFrame = useCallback(async (
    imageData: ImageData | Uint8Array | Uint8ClampedArray, 
    width: number, 
    height: number
  ): Promise<HeartBeatResult> => {
    // Esta función debería implementarse para procesar frames de video real
    // Aquí es solo un placeholder que devuelve un resultado vacío
    console.warn("processVideoFrame no implementado completamente");
    return {
      bpm: 0,
      confidence: 0
    };
  }, []);
  
  /**
   * Reinicia los buffers y el estado
   */
  const reset = useCallback(() => {
    signalBuffer.current = [];
    peakBuffer.current = [];
    setSignalQuality(0);
  }, []);
  
  /**
   * Reinicio completo, incluyendo calibración y configuración
   */
  const fullReset = useCallback(() => {
    reset();
    // Aquí iría código adicional para reiniciar calibración, etc.
  }, [reset]);
  
  return {
    processSignal,
    processVideoFrame,
    reset,
    fullReset,
    signalQuality,
    startMonitoring,
    stopMonitoring
  };
};
