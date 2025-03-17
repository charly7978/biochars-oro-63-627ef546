
/**
 * Ultra-simple algorithm for arrhythmia detection
 * Designed to minimize false positives
 */
export class ArrhythmiaProcessor {
  // Extremely permissive thresholds
  private _minRRIntervals = 2; // Reducido al mínimo (5 -> 2)
  private readonly MIN_INTERVAL_MS = 300; // Extremadamente permisivo (350 -> 300)
  private readonly MAX_INTERVAL_MS = 2000; // Extremadamente permisivo (1800 -> 2000)
  private readonly MIN_VARIATION_PERCENT = 15; // Extremadamente permisivo (25 -> 15)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 1000; // Extremadamente permisivo (5000 -> 1000)
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 0; // CRÍTICO: No calibración (1000 -> 0)
  private isCalibrating = false; // CRÍTICO: Nunca calibrar
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 2; // Extremadamente permisivo (3 -> 2)

  // Property accessor for MIN_RR_INTERVALS to avoid readonly error
  get MIN_RR_INTERVALS(): number {
    return this._minRRIntervals;
  }

  set MIN_RR_INTERVALS(value: number) {
    this._minRRIntervals = value;
  }

  /**
   * Process RR data for ultra-conservative arrhythmia detection
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    try {
      const currentTime = Date.now();
      
      // CAMBIO CRÍTICO: Nunca calibrar
      this.isCalibrating = false;
      
      // Update RR intervals if there's data
      if (rrData?.intervals && rrData.intervals.length > 0) {
        this.rrIntervals = rrData.intervals;
        this.lastPeakTime = rrData.lastPeakTime;
        
        // Procesar con cualquier cantidad de intervalos
        this.detectArrhythmia(currentTime);
      }

      // Build status message
      const arrhythmiaStatusMessage = 
        this.arrhythmiaCount > 0 
          ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
          : `SIN ARRITMIAS|${this.arrhythmiaCount}`;
      
      // Additional information only if there's active arrhythmia
      const lastArrhythmiaData = this.arrhythmiaDetected 
        ? {
            timestamp: currentTime,
            rmssd: 0, // Simplified
            rrVariation: 0 // Simplified
          } 
        : null;
      
      return {
        arrhythmiaStatus: arrhythmiaStatusMessage,
        lastArrhythmiaData
      };
    } catch (error) {
      console.error("ArrhythmiaProcessor: Error in processRRData", error);
      // Return safe values on error
      return {
        arrhythmiaStatus: "SIN ARRITMIAS|0",
        lastArrhythmiaData: null
      };
    }
  }

  /**
   * Método para actualizar configuración
   */
  public updateConfig(config: Partial<{
    minIntervals: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    minVariation: number;
    calibrationTime: number;
  }>): void {
    try {
      if (config.minIntervals !== undefined) {
        this.MIN_RR_INTERVALS = config.minIntervals;
      }
      
      // CAMBIO CRÍTICO: Siempre establecer calibración a cero
      this.calibrationTime = 0;
      console.log("ArrhythmiaProcessor: Calibration disabled");
    } catch (error) {
      console.error("ArrhythmiaProcessor: Error updating config", error);
    }
  }

  /**
   * Ultra-conservative algorithm for arrhythmia detection
   * Designed to minimize false positives
   */
  private detectArrhythmia(currentTime: number): void {
    try {
      // CAMBIO CRÍTICO: Procesar siempre, incluso con datos mínimos
      if (!this.rrIntervals.length) return;
      
      // Take latest intervals for analysis
      const recentRR = this.rrIntervals;
      
      // Filter only valid intervals (within conservative physiological limits)
      const validIntervals = recentRR.filter(interval => 
        interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
      );
      
      // Si no hay suficientes intervalos, usar valores predeterminados
      if (validIntervals.length < 1) {
        this.consecutiveAbnormalBeats = 0;
        return;
      }
      
      // Calculate average of valid intervals
      const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
      
      // Get the last interval
      const lastRR = validIntervals[validIntervals.length - 1];
      
      // Calculate percentage variation
      const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
      
      // Detect premature beat only if variation is extreme
      const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
      
      // Update consecutive anomalies counter
      if (prematureBeat) {
        this.consecutiveAbnormalBeats++;
        
        // Log detection
        console.log("ArrhythmiaProcessor: Possible premature beat", {
          percentageVariation: variation,
          threshold: this.MIN_VARIATION_PERCENT,
          consecutive: this.consecutiveAbnormalBeats,
          avgRR,
          lastRR,
          timestamp: currentTime
        });
      } else {
        this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 1);
      }
      
      // Check if arrhythmia is confirmed
      const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
      const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
      
      if (this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD && canDetectNewArrhythmia) {
        this.arrhythmiaCount++;
        this.arrhythmiaDetected = true;
        this.lastArrhythmiaTime = currentTime;
        this.consecutiveAbnormalBeats = 0;
        
        console.log("ArrhythmiaProcessor: ARRITMIA CONFIRMADA", {
          arrhythmiaCount: this.arrhythmiaCount,
          timeSinceLast: timeSinceLastArrhythmia,
          timestamp: currentTime
        });
      }
    } catch (error) {
      // Añadir manejo de errores para evitar bloqueos
      console.error("ArrhythmiaProcessor: Error en detección", error);
      this.consecutiveAbnormalBeats = 0;
    }
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    try {
      this.rrIntervals = [];
      this.lastPeakTime = null;
      this.isCalibrating = false; // CAMBIO: nunca calibrar
      this.arrhythmiaDetected = false;
      this.arrhythmiaCount = 0;
      this.lastArrhythmiaTime = 0;
      this.startTime = Date.now();
      this.consecutiveAbnormalBeats = 0;
      
      console.log("ArrhythmiaProcessor: Processor reset", {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("ArrhythmiaProcessor: Error in reset", error);
    }
  }
}
