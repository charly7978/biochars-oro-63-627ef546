
/**
 * Ultra-simple algorithm for arrhythmia detection
 * Designed to minimize false positives
 */
export class ArrhythmiaProcessor {
  // Extremely conservative thresholds
  private readonly MIN_RR_INTERVALS = 20; // Need lots of data to detect
  private readonly MIN_INTERVAL_MS = 600; // 100 BPM maximum 
  private readonly MAX_INTERVAL_MS = 1200; // 50 BPM minimum
  private readonly MIN_VARIATION_PERCENT = 20; // Less extreme variation (was 70%)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 10000; // 10 seconds between arrhythmias (was 20s)
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 10000; // 10 seconds of calibration (was 20s)
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 5; // Lower threshold to make detection easier (was 15)

  /**
   * Process RR data for arrhythmia detection
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
      const percentComplete = Math.min(100, Math.round(((currentTime - this.startTime) / this.calibrationTime) * 100));
      return {
        arrhythmiaStatus: `CALIBRANDO... ${percentComplete}%`,
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
        ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
        : `NO ARRITMIAS|${this.arrhythmiaCount}`;
    
    // Additional information only if there's active arrhythmia
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: this.calculateRMSSD(this.rrIntervals.slice(-8)), 
          rrVariation: this.calculateRRVariation(this.rrIntervals.slice(-8))
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Arrhythmia detection algorithm with lowered thresholds
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Take latest intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only valid intervals (within physiological limits)
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // If not enough valid intervals, we can't analyze
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.8) {
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calculate average of valid intervals
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Get the last interval
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calculate percentage variation
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Detect premature beat with lower threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection with more details
      console.log("ArrhythmiaProcessor: Possible premature beat", {
        percentageVariation: variation,
        threshold: this.MIN_VARIATION_PERCENT,
        consecutive: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      this.consecutiveAbnormalBeats = 0;
    }
    
    // Check if arrhythmia is confirmed with lower threshold
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
        variation: variation,
        timestamp: currentTime
      });
    }
  }

  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      sumSquaredDiff += Math.pow(intervals[i] - intervals[i-1], 2);
    }
    
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }
  
  /**
   * Calculate RR interval variation
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const lastRR = intervals[intervals.length - 1];
    
    return Math.abs(lastRR - mean) / mean;
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
  
  /**
   * Get calibration progress percentage
   */
  public getCalibrationProgress(): number {
    if (!this.isCalibrating) return 100;
    
    const currentTime = Date.now();
    const elapsed = currentTime - this.startTime;
    return Math.min(100, Math.round((elapsed / this.calibrationTime) * 100));
  }
  
  /**
   * Check if calibration is complete
   */
  public isCalibrationComplete(): boolean {
    return !this.isCalibrating;
  }
}
