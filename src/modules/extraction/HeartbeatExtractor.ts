
/**
 * Extractor de latidos cardíacos
 * Se encarga de extraer picos/latidos de la señal PPG sin procesamiento complejo
 */

interface HeartbeatExtractionResult {
  isPeak: boolean;
  timestamp: number;
  rawPeakValue: number;
  intervals: number[];
  lastPeakTime: number | null;
}

export class HeartbeatExtractor {
  private lastPeakTime: number | null = null;
  private peakThreshold: number = 0.25;
  private minPeakDistance: number = 300; // ms (200 BPM máximo)
  private rrIntervals: number[] = [];
  private maxIntervals: number = 10;
  private buffer: number[] = [];
  private readonly bufferSize: number = 5;

  /**
   * Extrae información de latidos/picos de la señal PPG raw
   * Corresponde a la "pesca de peces" sin procesamiento complejo
   */
  public extract(value: number): HeartbeatExtractionResult {
    // Actualizar buffer de valores recientes
    this.buffer.push(value);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Si no tenemos suficientes muestras, no podemos detectar pico
    if (this.buffer.length < 3) {
      return {
        isPeak: false,
        timestamp: Date.now(),
        rawPeakValue: value,
        intervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime
      };
    }

    const now = Date.now();
    
    // Verificar si hay un pico basado en las muestras recientes
    // Un pico se define como un valor mayor que sus vecinos y sobre un umbral
    const isPotentialPeak = 
      this.buffer[1] > this.buffer[0] && 
      this.buffer[1] > this.buffer[2] && 
      this.buffer[1] > this.peakThreshold;
    
    // Verificar distancia temporal desde el último pico
    const hasMinPeakDistance = this.lastPeakTime === null || 
                               (now - this.lastPeakTime) > this.minPeakDistance;
    
    // Detectar pico válido
    const isPeak = isPotentialPeak && hasMinPeakDistance;
    
    // Si es un pico, actualizar información
    if (isPeak) {
      // Registrar intervalo RR si ya tuvimos un pico previo
      if (this.lastPeakTime !== null) {
        const interval = now - this.lastPeakTime;
        this.rrIntervals.push(interval);
        
        // Mantener solo los últimos N intervalos
        if (this.rrIntervals.length > this.maxIntervals) {
          this.rrIntervals.shift();
        }
      }
      
      this.lastPeakTime = now;
      
      console.log("HeartbeatExtractor: Pico extraído", {
        time: new Date(now).toISOString(),
        value: this.buffer[1],
        intervalCount: this.rrIntervals.length
      });
    }
    
    return {
      isPeak,
      timestamp: now,
      rawPeakValue: isPeak ? this.buffer[1] : value,
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }

  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.buffer = [];
  }

  /**
   * Configura parámetros del extractor
   */
  public configure(config: {
    peakThreshold?: number;
    minPeakDistance?: number;
    maxIntervals?: number;
  }): void {
    if (config.peakThreshold !== undefined) {
      this.peakThreshold = config.peakThreshold;
    }
    
    if (config.minPeakDistance !== undefined) {
      this.minPeakDistance = config.minPeakDistance;
    }
    
    if (config.maxIntervals !== undefined) {
      this.maxIntervals = config.maxIntervals;
    }
  }
}
