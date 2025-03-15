
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
  private readonly RMSSD_THRESHOLD = 20; // Ajustado a un valor más realista
  private readonly RR_VARIATION_THRESHOLD = 0.12; // Ajustado a un valor más realista
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000; // 1 segundo entre detecciones
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 20; // Límite razonable
  private readonly REQUIRED_RR_INTERVALS = 3; // Mínimo 3 intervalos para detección fiable
  
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;

  constructor() {
    console.log("ArrhythmiaProcessor: Inicializado con umbrales ajustados", {
      rmssdThreshold: this.RMSSD_THRESHOLD, 
      rrVariationThreshold: this.RR_VARIATION_THRESHOLD
    });
  }

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
    
    // Verificar que los intervalos estén en un rango fisiológico plausible
    const validIntervals = recentRR.filter(interval => interval >= 300 && interval <= 1500);
    
    if (validIntervals.length < this.REQUIRED_RR_INTERVALS) {
      console.log("ArrhythmiaProcessor: Intervalos insuficientes en rango válido", {
        total: recentRR.length,
        válidos: validIntervals.length
      });
      return {
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: this.lastArrhythmiaData
      };
    }
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < validIntervals.length; i++) {
      const diff = validIntervals[i] - validIntervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (validIntervals.length - 1));
    
    // Calcular variación RR
    const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    console.log("ArrhythmiaProcessor: Análisis completo", {
      rmssd,
      rrVariation,
      umbralRMSSD: this.RMSSD_THRESHOLD,
      umbralVariación: this.RR_VARIATION_THRESHOLD
    });
    
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
    } else if (hasArrhythmia) {
      console.log("Arritmia detectada pero no contabilizada:", {
        tiempoDesdeÚltima: timeSinceLastArrhythmia,
        contadorActual: this.arrhythmiaCounter,
        máximoPermitido: this.MAX_ARRHYTHMIAS_PER_SESSION
      });
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
    console.log("ArrhythmiaProcessor: reseteo completo");
  }
  
  /**
   * Obtiene el contador actual de arritmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
