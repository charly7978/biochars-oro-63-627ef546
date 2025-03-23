
/**
 * Ultra-simple algorithm for arrhythmia detection
 * Designed to minimize false positives
 */
export class ArrhythmiaProcessor {
  // Extremely conservative thresholds
  private readonly MIN_RR_INTERVALS = 20; // Need lots of data to detect
  private readonly MIN_INTERVAL_MS = 600; // 100 BPM maximum 
  private readonly MAX_INTERVAL_MS = 1200; // 50 BPM minimum
  private readonly MIN_VARIATION_PERCENT = 70; // Extreme variation (70%)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 20000; // 20 seconds between arrhythmias
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 20000; // 20 seconds of calibration
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 15; // Very high to avoid false positives

  /**
   * Process RR data for ultra-conservative arrhythmia detection
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; type: string; confidence: number; } | null;
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
          type: "Irregular Rhythm",  // Using standardized type
          confidence: 0.85  // Using standardized confidence value
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Ultra-conservative algorithm for arrhythmia detection
   * Designed to minimize false positives
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Take latest intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only valid intervals (within conservative physiological limits)
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
      this.consecutiveAbnormalBeats = 0;
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
