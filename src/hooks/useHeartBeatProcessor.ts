
/**
 * Hook para procesamiento de latidos cardíacos
 */

import { useState, useCallback, useRef } from 'react';
import { CircularBuffer } from '../utils/CircularBuffer';

// Umbral para detección de picos
const PEAK_THRESHOLD = 0.3;
// Tiempo mínimo entre picos (milisegundos)
const MIN_PEAK_DISTANCE = 300;

/**
 * Hook para procesar señales PPG y extraer información de latidos
 */
export const useHeartBeatProcessor = () => {
  // Buffer para valores de señal
  const signalBuffer = useRef<CircularBuffer<number>>(new CircularBuffer(100));
  // Timestamps de picos
  const peakTimes = useRef<number[]>([]);
  // Último tiempo registrado
  const lastTime = useRef<number>(Date.now());
  // Último valor de BPM calculado
  const [lastBPM, setLastBPM] = useState(0);
  // Intervalo RR promedio
  const [averageRR, setAverageRR] = useState(0);
  // Último pico detectado
  const lastPeakRef = useRef<number | null>(null);
  // Intervalos RR
  const rrIntervalsRef = useRef<number[]>([]);
  // Límite de BPM fisiológico
  const BPM_MAX = 220;
  const BPM_MIN = 40;
  
  /**
   * Procesa un valor de señal PPG para extraer información de latidos
   */
  const processSignal = useCallback((value: number) => {
    const currentTime = Date.now();
    
    // Añadir valor al buffer
    signalBuffer.current.push(value);
    
    // Calcular delta de tiempo desde última muestra
    const dt = currentTime - lastTime.current;
    lastTime.current = currentTime;
    
    // Detectar pico
    const isPeak = detectPeak(value, signalBuffer.current.toArray());
    let peakDetected = false;
    
    // Validar tiempo entre picos
    if (isPeak) {
      // Si es el primer pico o ha pasado suficiente tiempo desde el último
      if (lastPeakRef.current === null || 
          (currentTime - lastPeakRef.current) > MIN_PEAK_DISTANCE) {
        
        peakDetected = true;
        
        // Registrar tiempo de pico
        peakTimes.current.push(currentTime);
        
        // Mantener solo los últimos 10 picos
        if (peakTimes.current.length > 10) {
          peakTimes.current.shift();
        }
        
        // Registrar intervalo RR si hay pico previo
        if (lastPeakRef.current !== null) {
          const rrInterval = currentTime - lastPeakRef.current;
          rrIntervalsRef.current.push(rrInterval);
          
          // Mantener solo los últimos 8 intervalos
          if (rrIntervalsRef.current.length > 8) {
            rrIntervalsRef.current.shift();
          }
          
          // Actualizar promedio de intervalos RR
          const sum = rrIntervalsRef.current.reduce((acc, val) => acc + val, 0);
          setAverageRR(sum / rrIntervalsRef.current.length);
        }
        
        // Actualizar referencia de último pico
        lastPeakRef.current = currentTime;
      }
    }
    
    // Calcular BPM si hay suficientes picos
    if (peakTimes.current.length >= 2) {
      const bpm = calculateBPM(peakTimes.current);
      
      // Validar que el BPM esté en rango fisiológico
      if (bpm >= BPM_MIN && bpm <= BPM_MAX) {
        setLastBPM(bpm);
      }
    }
    
    // Preparar resultado
    return {
      bpm: lastBPM,
      isPeak: peakDetected,
      value: value,
      time: currentTime,
      rrData: {
        intervals: rrIntervalsRef.current,
        lastPeakTime: lastPeakRef.current
      }
    };
  }, []);
  
  /**
   * Resetea el procesador
   */
  const reset = useCallback(() => {
    signalBuffer.current.clear();
    peakTimes.current = [];
    lastTime.current = Date.now();
    lastPeakRef.current = null;
    rrIntervalsRef.current = [];
    setLastBPM(0);
    setAverageRR(0);
  }, []);
  
  return {
    processSignal,
    lastBPM,
    averageRR,
    reset
  };
};

/**
 * Detecta si hay un pico en la señal actual
 */
function detectPeak(value: number, buffer: number[]): boolean {
  if (buffer.length < 3) return false;
  
  // Posición actual es el último elemento del buffer
  const currentIndex = buffer.length - 1;
  
  // Verificar que el valor actual sea mayor que un umbral mínimo
  if (value < PEAK_THRESHOLD) return false;
  
  // Verificar que el valor actual sea mayor que los valores adyacentes
  return (value > buffer[currentIndex - 1] && 
          buffer[currentIndex - 1] > buffer[currentIndex - 2]);
}

/**
 * Calcula BPM a partir de tiempos de picos
 */
function calculateBPM(peakTimes: number[]): number {
  if (peakTimes.length < 2) return 0;
  
  // Calcular diferencias de tiempo entre picos consecutivos
  const intervals: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }
  
  // Calcular intervalo promedio (en ms)
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  
  // Convertir a BPM: 60000 ms/min / (intervalo promedio en ms)
  const bpm = 60000 / avgInterval;
  
  return Math.round(bpm);
}
