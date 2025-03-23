
/**
 * Advanced arrhythmia detection algorithm using raw signal processing techniques
 * without simulation or reference values
 */
export class ArrhythmiaProcessor {
  // Parameters with wider physiological ranges
  private readonly MIN_RR_INTERVALS = 16; // Reduced from 24 for faster initial response
  private readonly MIN_INTERVAL_MS = 300; // 200 BPM upper limit (was 400)
  private readonly MAX_INTERVAL_MS = 2000; // 30 BPM lower limit (was 1500)
  private readonly MIN_VARIATION_PERCENT = 25; // More sensitive threshold (was 30)
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 8000; // 8 seconds between detections
  
  // Internal state variables
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 10000; // 10 seconds of learning phase (was 15000)
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Pattern recognition variables
  private anomalyScores: number[] = [];
  private readonly ANOMALY_HISTORY_SIZE = 20; // Reduced from 30
  private readonly ANOMALY_THRESHOLD = 0.60; // Lower threshold for earlier detection
  
  // Spectral analysis variables - removed fixed reference values
  private spectralFeatures: {
    lfHfRatio: number, 
    totalPower: number,
    complexity: number
  } = { lfHfRatio: 0, totalPower: 0, complexity: 0 };
  
  // Adaptive threshold variables - removed fixed baselines
  private baselineRR: number = 0;
  private rrVariability: number = 0;
  private readonly LEARNING_RATE = 0.1; // Faster adaptation (was 0.05)
  private readonly VARIANCE_SCALING = 2.5; // Less strict Z-score threshold (was 3.0)
  
  // Pattern recognition - removed fixed templates
  private temporalPatternScores: number[] = [];
  private readonly PATTERN_HISTORY_SIZE = 10; // Shorter history (was 15)
  private readonly PATTERN_MATCH_THRESHOLD = 0.70; // Lower threshold (was 0.75)
  
  /**
   * Process RR interval data using direct detection algorithms
   * without reference or simulation values
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { 
      timestamp: number; 
      rmssd: number; 
      rrVariation: number;
      spectralFeatures?: {
        lfHfRatio: number,
        totalPower: number,
        complexity: number
      }
    } | null;
  } {
    const currentTime = Date.now();
    
    // Manage calibration phase with adaptive learning
    if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
      this.isCalibrating = false;
      console.log("ArrhythmiaProcessor: Calibration completed", {
        elapsedTime: currentTime - this.startTime,
        baselineRR: this.baselineRR,
        rrVariability: this.rrVariability,
        spectralFeatures: this.spectralFeatures,
        threshold: this.calibrationTime
      });
    }
    
    // During calibration, only gather raw data
    if (this.isCalibrating) {
      // Start from zero, only collect raw data
      if (rrData?.intervals && rrData.intervals.length > 8) {
        // Only store raw statistics without processing
        this.calculateRawStatistics(rrData.intervals);
      }
      
      return {
        arrhythmiaStatus: "CALIBRANDO...",
        lastArrhythmiaData: null
      };
    }
    
    // Process new RR interval data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Only proceed if we have sufficient data
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.performArrhythmiaDetection(currentTime);
      }
    }

    // Construct status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
        : `NORMAL|${this.arrhythmiaCount}`;
    
    // Provide metrics only if arrhythmia is currently detected
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: this.calculateRMSSD(this.rrIntervals.slice(-8)),
          rrVariation: this.calculateRRVariation(this.rrIntervals.slice(-8)),
          spectralFeatures: this.spectralFeatures
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Direct arrhythmia detection algorithm without simulation
   */
  private performArrhythmiaDetection(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Use sliding window for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter for physiologically plausible values
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Ensure sufficient data
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.7) { // Reduced required proportion
      return;
    }
    
    // Calculate metrics directly from measurements
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Update statistics with new data
    this.calculateRawStatistics(validIntervals);
    
    // Direct detection based on signal variation
    const isAnomalous = variation > this.MIN_VARIATION_PERCENT;
    
    // Time-based restrictions
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    
    // Log significant variations
    if (variation > 20) {
      console.log("ArrhythmiaProcessor: Significant RR variation", {
        variation,
        lastRR,
        avgRR,
        timestamp: currentTime
      });
    }
    
    // Direct arrhythmia detection
    if (isAnomalous && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      
      console.log("ArrhythmiaProcessor: ARRITMIA DETECTADA", {
        arrhythmiaCount: this.arrhythmiaCount,
        variation,
        timestamp: currentTime
      });
    }
  }
  
  /**
   * Calculate raw statistics without reference values
   */
  private calculateRawStatistics(intervals: number[]): void {
    if (intervals.length < 5) return;
    
    // Calculate mean RR interval
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Update baseline
    this.baselineRR = mean;
    
    // Calculate variance and standard deviation
    const variance = intervals.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Update variability
    this.rrVariability = stdDev;
    
    // Calculate first differences
    const diffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      diffs.push(intervals[i] - intervals[i-1]);
    }
    
    // Simple spectral approximation
    let lowFreqPower = 0;
    let highFreqPower = 0;
    let totalPower = 0;
    
    for (let i = 0; i < diffs.length; i++) {
      const power = Math.pow(diffs[i], 2);
      totalPower += power;
      
      if (i < diffs.length / 2) {
        lowFreqPower += power;
      } else {
        highFreqPower += power;
      }
    }
    
    // Calculate ratio
    const lfHfRatio = highFreqPower > 0 ? lowFreqPower / highFreqPower : 1;
    
    // Calculate complexity
    const uniqueValues = new Set(intervals.map(i => Math.round(i/10))).size;
    const complexity = uniqueValues / intervals.length;
    
    // Update features
    this.spectralFeatures = {
      lfHfRatio,
      totalPower,
      complexity
    };
  }
  
  /**
   * Calculate RMSSD directly from RR intervals
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
   * Reset analyzer state completely
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isCalibrating = true;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.startTime = Date.now();
    this.baselineRR = 0;
    this.rrVariability = 0;
    this.anomalyScores = [];
    this.temporalPatternScores = [];
    this.spectralFeatures = { 
      lfHfRatio: 0, 
      totalPower: 0, 
      complexity: 0 
    };
    
    console.log("ArrhythmiaProcessor: Reset complete", {
      timestamp: new Date().toISOString()
    });
  }
}
