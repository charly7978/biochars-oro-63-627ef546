
/**
 * Procesador de señal cardíaca
 */

import { ProcessedPPGSignal } from '../../modules/signal-processing/types';
import { OptimizedSignal } from '../../modules/signal-optimization/types';

interface HeartBeatResult {
  bpm: number;
  isPeak: boolean;
  confidence: number;
  rrData: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

/**
 * Clase para procesamiento de señal cardíaca
 */
export class HeartBeatSignalProcessor {
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 30;
  private peakTimes: number[] = [];
  private readonly MAX_PEAK_TIMES = 10;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 10;
  private lastBpm: number = 0;
  private readonly MIN_PEAK_THRESHOLD = 0.15;
  private readonly MIN_PEAK_DISTANCE_MS = 300; // Mínimo tiempo entre picos (200bpm)
  private readonly MAX_BPM = 220;
  private readonly MIN_BPM = 40;
  private lastProcessedTime: number = 0;

  constructor() {}

  /**
   * Procesa un valor y detecta picos cardíacos
   */
  public processSignal(
    value: number,
    timestamp: number = Date.now(),
    optimizedSignal?: OptimizedSignal
  ): HeartBeatResult {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Controlar frecuencia de procesamiento
    if (timestamp - this.lastProcessedTime < 30) {
      return {
        bpm: this.lastBpm,
        isPeak: false,
        confidence: 0.5,
        rrData: {
          intervals: [...this.rrIntervals],
          lastPeakTime: this.lastPeakTime
        }
      };
    }
    this.lastProcessedTime = timestamp;

    // Detectar pico
    const { isPeak, confidence } = this.detectPeak(value, timestamp, optimizedSignal);

    // Calcular BPM si es un pico
    if (isPeak) {
      this.peakTimes.push(timestamp);
      if (this.peakTimes.length > this.MAX_PEAK_TIMES) {
        this.peakTimes.shift();
      }

      // Calcular intervalo RR si hay pico anterior
      if (this.lastPeakTime !== null) {
        const rrInterval = timestamp - this.lastPeakTime;
        
        // Sólo añadir intervalos válidos
        if (rrInterval >= this.MIN_PEAK_DISTANCE_MS && rrInterval <= 60000 / this.MIN_BPM) {
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
            this.rrIntervals.shift();
          }
        }
      }

      this.lastPeakTime = timestamp;
    }

    // Calcular BPM a partir de los intervalos RR
    this.lastBpm = this.calculateBPM();

    return {
      bpm: this.lastBpm,
      isPeak,
      confidence,
      rrData: {
        intervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime
      }
    };
  }

  /**
   * Detecta si el valor actual representa un pico cardíaco
   */
  private detectPeak(
    value: number, 
    timestamp: number,
    optimizedSignal?: OptimizedSignal
  ): { isPeak: boolean, confidence: number } {
    if (this.buffer.length < 3) {
      return { isPeak: false, confidence: 0 };
    }

    // Verificar distancia temporal desde último pico
    if (this.lastPeakTime !== null && timestamp - this.lastPeakTime < this.MIN_PEAK_DISTANCE_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Usar valores del buffer para verificar si es un máximo local
    const recent = this.buffer.slice(-3);
    const isPotentialPeak = recent[1] > recent[0] && recent[1] > recent[2] && recent[1] > this.MIN_PEAK_THRESHOLD;
    
    if (!isPotentialPeak) {
      return { isPeak: false, confidence: 0 };
    }

    // Para picos confirmados, calcular confianza
    const prominence = Math.min(
      recent[1] - recent[0],
      recent[1] - recent[2]
    );
    
    // Ajustar confianza basada en la prominencia del pico
    let confidence = Math.min(1, prominence * 5);
    
    // Si hay señal optimizada, aumentar confianza
    if (optimizedSignal) {
      confidence = Math.min(1, confidence * 1.2);
    }

    return { isPeak: true, confidence };
  }

  /**
   * Calcula BPM a partir de intervalos RR
   */
  private calculateBPM(): number {
    if (this.rrIntervals.length < 2) {
      return 0;
    }

    // Filtrar intervalos anómalos
    const validIntervals = this.rrIntervals.filter(interval => 
      interval >= this.MIN_PEAK_DISTANCE_MS && 
      interval <= 60000 / this.MIN_BPM
    );

    if (validIntervals.length < 2) {
      return 0;
    }

    // Calcular promedio de intervalos
    const avgInterval = validIntervals.reduce((sum, interval) => sum + interval, 0) / validIntervals.length;
    
    // Convertir a BPM
    const bpm = Math.round(60000 / avgInterval);
    
    // Limitarlo a rango fisiológico
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, bpm));
  }

  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.buffer = [];
    this.peakTimes = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.lastBpm = 0;
    this.lastProcessedTime = 0;
  }
}
