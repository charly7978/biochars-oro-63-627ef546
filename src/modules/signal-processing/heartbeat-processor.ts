
/**
 * Procesador de latidos cardíacos
 * Implementa el procesamiento de picos para detectar latidos
 */

import { SignalProcessor, ProcessedPPGSignal, SignalProcessorConfig } from './types';

export class HeartbeatProcessor implements SignalProcessor {
  // Configuración del procesador
  private config: SignalProcessorConfig = {
    filterParams: {
      lowPassCutoff: 5, // Hz
      highPassCutoff: 0.5, // Hz
      smoothingFactor: 0.85
    },
    amplification: {
      gain: 3.5,
      adaptiveGain: true
    }
  };
  
  // Estado del procesador
  private lastValue: number = 0;
  private valueBuffer: number[] = [];
  private readonly bufferSize: number = 10;
  private lastPeakTime: number | null = null;
  private readonly minPeakDistance: number = 300; // ms (máximo 200 BPM)
  private readonly peakThreshold: number = 0.25;
  private rrIntervals: number[] = [];
  private readonly maxRRIntervals: number = 10;
  
  constructor() {
    console.log("HeartbeatProcessor: Instancia creada");
  }
  
  /**
   * Procesa un valor para detectar latidos
   */
  public processSignal(value: number, timestamp: number = Date.now()): ProcessedPPGSignal {
    // Actualizar buffer de valores
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this.bufferSize) {
      this.valueBuffer.shift();
    }
    
    // Aplicar filtro pasa-banda optimizado para detección de latidos
    const filteredValue = this.applyBandPassFilter(value);
    
    // Detectar pico
    const isPeak = this.detectPeak(filteredValue, timestamp);
    
    // Normalizar valor
    const normalizedValue = value - this.calculateBaseline();
    
    // Amplificar señal
    const amplifiedValue = this.amplifySignal(normalizedValue);
    
    // La calidad y detección de dedo se delegan al procesador PPG
    // Aquí nos enfocamos en la detección de picos
    
    const result: ProcessedPPGSignal = {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      quality: 0, // Se delega al procesador PPG
      fingerDetected: false, // Se delega al procesador PPG
      signalStrength: 0, // Se delega al procesador PPG
      metadata: {
        isPeak,
        rrIntervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime
      }
    };
    
    this.lastValue = value;
    
    return result;
  }
  
  /**
   * Aplica filtro pasa-banda optimizado para detección de latidos
   */
  private applyBandPassFilter(value: number): number {
    const alpha = this.config.filterParams?.smoothingFactor || 0.85;
    
    // Implementación simplificada de filtro pasa-banda
    // Primero aplicamos un filtro pasa-bajos para eliminar ruido de alta frecuencia
    const lowPassValue = alpha * this.lastValue + (1 - alpha) * value;
    
    // Luego removemos componentes de muy baja frecuencia (DC offset)
    const baseline = this.calculateBaseline();
    const highPassValue = lowPassValue - baseline;
    
    return highPassValue;
  }
  
  /**
   * Calcula la línea base (componente DC)
   */
  private calculateBaseline(): number {
    if (this.valueBuffer.length < 3) {
      return 0;
    }
    
    // Promedio simple para línea base
    return this.valueBuffer.reduce((sum, val) => sum + val, 0) / this.valueBuffer.length;
  }
  
  /**
   * Amplifica la señal para mejorar detección
   */
  private amplifySignal(value: number): number {
    const gain = this.config.amplification?.gain || 3.5;
    return value * gain;
  }
  
  /**
   * Detecta picos en la señal (latidos)
   */
  private detectPeak(value: number, timestamp: number): boolean {
    if (this.valueBuffer.length < 3) {
      return false;
    }
    
    // Verificar tiempo mínimo desde último pico
    if (this.lastPeakTime !== null && timestamp - this.lastPeakTime < this.minPeakDistance) {
      return false;
    }
    
    // Verificar condiciones de pico
    const recentValues = this.valueBuffer.slice(-3);
    const isPeak = recentValues[1] > recentValues[0] && 
                 recentValues[1] > recentValues[2] && 
                 recentValues[1] > this.peakThreshold;
    
    if (isPeak) {
      // Registrar intervalo RR si ya hubo un pico previo
      if (this.lastPeakTime !== null) {
        const rrInterval = timestamp - this.lastPeakTime;
        this.rrIntervals.push(rrInterval);
        
        if (this.rrIntervals.length > this.maxRRIntervals) {
          this.rrIntervals.shift();
        }
      }
      
      this.lastPeakTime = timestamp;
      
      console.log("HeartbeatProcessor: Pico detectado", {
        time: new Date(timestamp).toISOString(),
        value: recentValues[1],
        rrIntervals: this.rrIntervals.length
      });
    }
    
    return isPeak;
  }
  
  /**
   * Configura parámetros del procesador
   */
  public setConfig(config: SignalProcessorConfig): void {
    this.config = {
      ...this.config,
      ...config,
      filterParams: {
        ...this.config.filterParams,
        ...config.filterParams
      },
      amplification: {
        ...this.config.amplification,
        ...config.amplification
      }
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.lastValue = 0;
    this.valueBuffer = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
    
    console.log("HeartbeatProcessor: Reiniciado");
  }
}

/**
 * Crea una nueva instancia del procesador de latidos
 */
export function createHeartbeatProcessor(): SignalProcessor {
  return new HeartbeatProcessor();
}
