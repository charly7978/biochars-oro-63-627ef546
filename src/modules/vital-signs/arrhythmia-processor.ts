
/**
 * Ultra-simple algorithm for arrhythmia detection
 * Designed to minimize false positives
 */
export class ArrhythmiaProcessor {
  // Extremely conservative thresholds
  private MIN_RR_INTERVALS = 15; // Changed from readonly to private to allow updates
  private readonly MIN_INTERVAL_MS = 500; // 120 BPM maximum (más permisivo)
  private readonly MAX_INTERVAL_MS = 1400; // 42 BPM minimum (más permisivo)
  private readonly MIN_VARIATION_PERCENT = 60; // Reduced from 70% to 60% (más permisivo)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 15000; // 15 seconds between arrhythmias
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 8000; // 8 seconds of calibration (ajustado)
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 10; // Reduced from 15 (más permisivo)

  /**
   * Process RR data for ultra-conservative arrhythmia detection
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();
    
    // Set calibration period
    if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
      this.isCalibrating = false;
      console.log("ArrhythmiaProcessor: Calibration completed", {
        elapsedTime: currentTime - this.startTime,
        threshold: this.calibrationTime
      });
    }
    
    // During calibration, just report status
    if (this.isCalibrating) {
      return {
        arrhythmiaStatus: "CALIBRATING...",
        lastArrhythmiaData: null
      };
    }
    
    // Update RR intervals if there's data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Only proceed if we have enough intervals
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
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
  }

  /**
   * Método para actualizar configuración
   * Fixed to properly handle configuration updates without readonly property error
   */
  public updateConfig(config: Partial<{
    minIntervals: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    minVariation: number;
    calibrationTime: number;
  }>): void {
    if (config.minIntervals !== undefined) {
      this.MIN_RR_INTERVALS = config.minIntervals;
    }
    
    if (config.calibrationTime !== undefined) {
      this.calibrationTime = config.calibrationTime;
      console.log("ArrhythmiaProcessor: Calibration time updated to", this.calibrationTime, "ms");
    }
    
    // Otras configuraciones que pueden ser actualizadas
    // pero manteniendo variables privadas readonly como valores por defecto
    console.log("ArrhythmiaProcessor: Configuration updated");
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
      
      // If not enough valid intervals, we can't analyze
      if (validIntervals.length < this.MIN_RR_INTERVALS * 0.7) { // Reduced requirement
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
        
        console.log("ArrhythmiaProcessor: ARRHYTHMIA CONFIRMED", {
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
  }
}
