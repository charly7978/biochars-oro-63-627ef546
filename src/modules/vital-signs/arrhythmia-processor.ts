
/**
 * Ultra-simple algorithm for arrhythmia detection
 * Designed to minimize false positives
 */
export class ArrhythmiaProcessor {
  // Extremely conservative thresholds but with private fields - MUCHO MÁS PERMISIVO AHORA
  private _minRRIntervals = 10; // Reducido de 15 a 10 - MÁS PERMISIVO
  private readonly MIN_INTERVAL_MS = 400; // Extremadamente permisivo (500 -> 400)
  private readonly MAX_INTERVAL_MS = 1600; // Extremadamente permisivo (1400 -> 1600)
  private readonly MIN_VARIATION_PERCENT = 35; // Extremadamente permisivo (50 -> 35)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 8000; // Muy permisivo (12000 -> 8000)
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 3000; // Reducido a 3 segundos (8000 -> 3000)
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 5; // Extremadamente permisivo (8 -> 5)

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
      
      // Set calibration period - REDUCIDO PARA CALIBRACIÓN INSTANTÁNEA
      if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
        this.isCalibrating = false;
        console.log("ArrhythmiaProcessor: Calibración completada", {
          elapsedTime: currentTime - this.startTime,
          threshold: this.calibrationTime
        });
      }
      
      // Durante calibración, indicar estado pero usar valores iniciales
      if (this.isCalibrating) {
        // CAMBIO: Permitir valores iniciales incluso en calibración
        return {
          arrhythmiaStatus: "CALIBRANDO...|0",
          lastArrhythmiaData: null
        };
      }
      
      // Update RR intervals if there's data
      if (rrData?.intervals && rrData.intervals.length > 0) {
        this.rrIntervals = rrData.intervals;
        this.lastPeakTime = rrData.lastPeakTime;
        
        // Only proceed if we have enough intervals - AHORA MÁS PERMISIVO
        if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
          this.detectArrhythmia(currentTime);
        }
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
        arrhythmiaStatus: "ERROR|0",
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
      
      if (config.calibrationTime !== undefined) {
        this.calibrationTime = config.calibrationTime;
        console.log("ArrhythmiaProcessor: Calibration time updated to", this.calibrationTime, "ms");
      }
      
      console.log("ArrhythmiaProcessor: Configuration updated");
    } catch (error) {
      console.error("ArrhythmiaProcessor: Error updating config", error);
    }
  }

  /**
   * Ultra-conservative algorithm for arrhythmia detection
   * Designed to minimize false positives
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    try {
      // Take latest intervals for analysis
      const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
      
      // Filter only valid intervals (within conservative physiological limits)
      const validIntervals = recentRR.filter(interval => 
        interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
      );
      
      // If not enough valid intervals, we can't analyze - MÁS PERMISIVO
      if (validIntervals.length < this.MIN_RR_INTERVALS * 0.5) { // Muy permisivo (0.6 -> 0.5)
        this.consecutiveAbnormalBeats = 0;
        return;
      }
      
      // Calculate average of valid intervals
      const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
      
      // Get the last interval
      const lastRR = validIntervals[validIntervals.length - 1];
      
      // Calculate percentage variation
      const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
      
      // Detect premature beat only if variation is extreme - MÁS PERMISIVO
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
      
      // Check if arrhythmia is confirmed - MÁS PERMISIVO
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
      this.isCalibrating = true;
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
