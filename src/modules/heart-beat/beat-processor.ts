
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Procesador de latidos cardíacos optimizado
 */
export class BeatProcessor {
  private readonly WINDOW_SIZE = 15;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly MIN_PEAK_TIME = 300; // ms
  
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private values: number[] = [];
  private lastValue: number = 0;
  private smoothBPM: number = 0;
  private bpmHistory: number[] = [];
  
  private readonly BPM_ALPHA = 0.2;
  
  constructor() {
    console.log("BeatProcessor: Initialized");
  }
  
  /**
   * Procesa un valor de señal filtrada para detectar latidos
   */
  public processBeat(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
  } {
    // Actualizar buffer de valores
    this.values.push(value);
    if (this.values.length > this.WINDOW_SIZE) {
      this.values.shift();
    }
    
    // Calcular derivada para detección de picos
    const derivative = value - this.lastValue;
    this.lastValue = value;
    
    // Detectar pico basado en cambio de pendiente
    const isPeak = this.detectPeak(value, derivative);
    
    // Actualizar BPM si se detecta un pico
    let confidence = 0.3;
    if (isPeak) {
      const now = Date.now();
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = now;
      
      if (this.previousPeakTime) {
        const interval = now - this.previousPeakTime;
        const instantBPM = 60000 / interval;
        
        if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
          this.rrIntervals.push(interval);
          if (this.rrIntervals.length > 12) {
            this.rrIntervals.shift();
          }
          
          // Actualizar historial de BPM
          this.bpmHistory.push(instantBPM);
          if (this.bpmHistory.length > 8) {
            this.bpmHistory.shift();
          }
          
          confidence = 0.8;
        }
      }
    }
    
    // Calcular BPM actual
    const currentBPM = this.calculateCurrentBPM();
    
    // Suavizar BPM para estabilidad
    if (this.smoothBPM === 0) {
      this.smoothBPM = currentBPM;
    } else if (currentBPM > 0) {
      this.smoothBPM = this.BPM_ALPHA * currentBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }
    
    return {
      bpm: Math.round(this.smoothBPM),
      confidence,
      isPeak
    };
  }
  
  /**
   * Detecta picos en la señal
   */
  private detectPeak(value: number, derivative: number): boolean {
    const now = Date.now();
    
    // Respetar tiempo mínimo entre picos
    if (this.lastPeakTime && now - this.lastPeakTime < this.MIN_PEAK_TIME) {
      return false;
    }
    
    // Detectar cambio de pendiente positiva a negativa
    return derivative < -0.02 && value > 0.1;
  }
  
  /**
   * Calcula el BPM actual basado en el historial
   */
  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Ordenar valores y recortar extremos
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
    
    // Calcular promedio de valores trimmed
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.values = [];
    this.lastValue = 0;
    this.smoothBPM = 0;
    this.bpmHistory = [];
  }
  
  /**
   * Obtiene los intervalos RR para análisis
   */
  public getRRIntervals(): number[] {
    return [...this.rrIntervals];
  }
  
  /**
   * Obtiene el tiempo del último pico detectado
   */
  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }
}
