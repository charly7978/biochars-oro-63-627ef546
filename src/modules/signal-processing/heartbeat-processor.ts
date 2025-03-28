
/**
 * Procesador de latidos cardíacos
 */

import { SignalProcessor, SignalProcessorConfig } from './types';
import { ProcessedPPGSignal } from './types';

/**
 * Procesador especializado en detección y análisis de latidos cardíacos
 */
export class HeartbeatProcessor implements SignalProcessor {
  private isRunning: boolean = false;
  private peakThreshold: number = 0.5;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private valueBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly MIN_PEAK_INTERVAL_MS = 400; // Min tiempo entre picos (150 BPM máx)
  private config: SignalProcessorConfig = {
    mode: 'standard',
    filterWindowSize: 10,
    amplificationFactor: 1.5
  };
  
  /**
   * Configura el procesador de latidos
   */
  public configure(config: Partial<SignalProcessorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Ajustar parámetros internos según configuración
    if (config.mode === 'highSensitivity') {
      this.peakThreshold = 0.3;
    } else if (config.mode === 'lowNoise') {
      this.peakThreshold = 0.7;
    } else {
      this.peakThreshold = 0.5;
    }
    
    console.log("HeartbeatProcessor: Configurado con modo", this.config.mode);
  }
  
  /**
   * Inicializa el procesador
   */
  public async initialize(): Promise<void> {
    this.reset();
    console.log("HeartbeatProcessor: Inicializado");
    return Promise.resolve();
  }
  
  /**
   * Inicia el procesamiento
   */
  public start(): void {
    this.isRunning = true;
    console.log("HeartbeatProcessor: Iniciado");
  }
  
  /**
   * Detiene el procesamiento
   */
  public stop(): void {
    this.isRunning = false;
    console.log("HeartbeatProcessor: Detenido");
  }
  
  /**
   * Reinicia el estado interno
   */
  public reset(): void {
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.valueBuffer = [];
    console.log("HeartbeatProcessor: Reiniciado");
  }
  
  /**
   * Calibra el procesador
   */
  public async calibrate(): Promise<boolean> {
    // Simplemente reinicia para este procesador
    this.reset();
    return Promise.resolve(true);
  }
  
  /**
   * Procesa valor de señal para detectar latidos
   */
  public processSignal(signal: ProcessedPPGSignal): ProcessedPPGSignal {
    if (!this.isRunning || !signal.fingerDetected) {
      return signal;
    }
    
    // Agregar valor a buffer
    this.valueBuffer.push(signal.filteredValue);
    if (this.valueBuffer.length > this.MAX_BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
    
    // Detectar pico (latido)
    const isPeak = this.detectPeak(signal.filteredValue, signal.timestamp);
    
    // Crear copia enriquecida de la señal
    return {
      ...signal,
      isPeak,
      lastPeakTime: this.lastPeakTime,
      rrIntervals: [...this.rrIntervals],
      metadata: {
        ...signal.metadata,
        rrIntervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime
      }
    };
  }
  
  /**
   * Detecta picos en la señal
   */
  private detectPeak(value: number, timestamp: number): boolean {
    if (this.lastPeakTime === null || timestamp - this.lastPeakTime >= this.MIN_PEAK_INTERVAL_MS) {
      if (value > this.peakThreshold && this.valueBuffer.length > 3) {
        // Verificar que sea mayor que valores recientes
        const recentValues = this.valueBuffer.slice(-3);
        if (value > Math.max(...recentValues)) {
          // Calcular intervalo RR
          if (this.lastPeakTime !== null) {
            const rrInterval = timestamp - this.lastPeakTime;
            this.rrIntervals.push(rrInterval);
            
            // Mantener solo los últimos 8 intervalos
            if (this.rrIntervals.length > 8) {
              this.rrIntervals.shift();
            }
          }
          
          this.lastPeakTime = timestamp;
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Obtiene los intervalos RR actuales
   */
  public getRRIntervals(): number[] {
    return [...this.rrIntervals];
  }
  
  /**
   * Obtiene tiempo del último pico detectado
   */
  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }
}
