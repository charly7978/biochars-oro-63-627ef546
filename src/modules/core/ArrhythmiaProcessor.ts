
/**
 * NOTA IMPORTANTE: Este es un módulo de procesamiento para detección de arritmias.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export class ArrhythmiaProcessor {
  private readonly RMSSD_THRESHOLD = 10; // Reducido dramáticamente para mayor sensibilidad
  private readonly RR_VARIATION_THRESHOLD = 0.05; // Reducido dramáticamente para mayor sensibilidad
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // Reducido a 1 segundo para detectar más arritmias
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 30; // Aumentado para permitir más detecciones
  private readonly REQUIRED_RR_INTERVALS = 3; // Reducido para detectar más rápido
  
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;

  /**
   * Procesa datos de intervalos RR para detectar arritmias
   */
  public processRRData(rrData?: RRData): ArrhythmiaResult {
    if (!rrData || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      return {
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: this.lastArrhythmiaData
      };
    }
    
    const currentTime = Date.now();
    const recentRR = rrData.intervals.slice(-this.REQUIRED_RR_INTERVALS);
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    // Calcular variación RR
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Detectar arritmia si RMSSD excede umbral y hay variación significativa
    const hasArrhythmia = rmssd > this.RMSSD_THRESHOLD && rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Evaluar si debe incrementar contador
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const shouldIncrementCounter = 
      hasArrhythmia &&
      (timeSinceLastArrhythmia > this.MIN_TIME_BETWEEN_ARRHYTHMIAS) &&
      (this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION);
    
    // Actualizar contador y tiempo si corresponde
    if (shouldIncrementCounter) {
      this.arrhythmiaCounter++;
      this.lastArrhythmiaTime = currentTime;
      this.lastArrhythmiaData = {
        timestamp: currentTime,
        rmssd,
        rrVariation
      };
      
      // Log adicional para diagnóstico
      console.log(`ARRITMIA DETECTADA [${this.arrhythmiaCounter}]: RMSSD=${rmssd.toFixed(2)}, RR_VAR=${rrVariation.toFixed(2)}`);
    }
    
    // Preparar estado de arritmia
    let arrhythmiaStatus = `SIN ARRITMIAS|${this.arrhythmiaCounter}`;
    if (hasArrhythmia) {
      arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCounter}`;
    }
    
    return {
      arrhythmiaStatus,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.arrhythmiaCounter = 0;
    this.lastArrhythmiaTime = 0;
    this.lastArrhythmiaData = null;
  }
  
  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
