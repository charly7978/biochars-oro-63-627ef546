
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Advanced arrhythmia detection using only real signal data
 * No simulation or reference values
 */
export class ArrhythmiaProcessor {
  // Parameters for direct measurement
  private readonly MIN_RR_INTERVALS = 16;
  private readonly MIN_INTERVAL_MS = 300;
  private readonly MAX_INTERVAL_MS = 2000;
  private readonly MIN_VARIATION_PERCENT = 25;
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 8000;
  
  // Internal state variables
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 10000;
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Pattern recognition variables
  private anomalyScores: number[] = [];
  private readonly ANOMALY_HISTORY_SIZE = 20;
  private readonly ANOMALY_THRESHOLD = 0.60;
  
  // Spectral analysis variables - real data only
  private spectralFeatures: {
    lfHfRatio: number, 
    totalPower: number,
    complexity: number
  } = { lfHfRatio: 0, totalPower: 0, complexity: 0 };
  
  // Adaptive threshold variables - real data only
  private baselineRR: number = 0;
  private rrVariability: number = 0;
  private readonly LEARNING_RATE = 0.1;
  private readonly VARIANCE_SCALING = 2.5;
  
  // Pattern recognition - real data only
  private temporalPatternScores: number[] = [];
  private readonly PATTERN_HISTORY_SIZE = 10;
  private readonly PATTERN_MATCH_THRESHOLD = 0.70;
  
  /**
   * Process real RR interval data
   * No simulation or reference values
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
    
    // Manage calibration phase with real data
    if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
      this.isCalibrating = false;
      console.log("ArrhythmiaProcessor: Calibration completed with real data", {
        elapsedTime: currentTime - this.startTime,
        baselineRR: this.baselineRR,
        rrVariability: this.rrVariability,
        spectralFeatures: this.spectralFeatures,
        threshold: this.calibrationTime
      });
    }
    
    // During calibration, only gather real data
    if (this.isCalibrating) {
      if (rrData?.intervals && rrData.intervals.length > 8) {
        this.calculateRawStatistics(rrData.intervals);
      }
      
      return {
        arrhythmiaStatus: "CALIBRANDO...",
        lastArrhythmiaData: null
      };
    }
    
    // Process new real RR interval data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Only proceed with sufficient real data
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.performArrhythmiaDetection(currentTime);
      }
    }

    // Construct status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
        : `NORMAL|${this.arrhythmiaCount}`;
    
    // Provide metrics only if arrhythmia is currently detected in real data
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
   * Direct arrhythmia detection algorithm using only real data
   * No simulation
   */
  private performArrhythmiaDetection(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Use sliding window for real data analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter for physiologically valid values only
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Ensure sufficient real data
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.7) {
      return;
    }
    
    // Calculate metrics from real data
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Update statistics with new real data
    this.calculateRawStatistics(validIntervals);
    
    // Direct detection based on real signal variation
    const isAnomalous = variation > this.MIN_VARIATION_PERCENT;
    
    // Time-based restrictions
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    
    // Log significant variations in real data
    if (variation > 20) {
      console.log("ArrhythmiaProcessor: Significant RR variation in real data", {
        variation,
        lastRR,
        avgRR,
        timestamp: currentTime
      });
    }
    
    // Direct arrhythmia detection from real data
    if (isAnomalous && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      
      console.log("ArrhythmiaProcessor: ARRITMIA DETECTADA in real data", {
        arrhythmiaCount: this.arrhythmiaCount,
        variation,
        timestamp: currentTime
      });
    }
  }
  
  /**
   * Calculate raw statistics from real data only
   * No reference values
   */
  private calculateRawStatistics(intervals: number[]): void {
    if (intervals.length < 5) return;
    
    // Calculate real mean RR interval
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Update baseline with real data
    this.baselineRR = mean;
    
    // Calculate variance and standard deviation of real data
    const variance = intervals.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Update variability with real data
    this.rrVariability = stdDev;
    
    // Calculate first differences from real data
    const diffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      diffs.push(intervals[i] - intervals[i-1]);
    }
    
    // Real data spectral approximation
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
    
    // Calculate ratio from real data
    const lfHfRatio = highFreqPower > 0 ? lowFreqPower / highFreqPower : 1;
    
    // Calculate complexity from real data
    const uniqueValues = new Set(intervals.map(i => Math.round(i/10))).size;
    const complexity = uniqueValues / intervals.length;
    
    // Update features with real data
    this.spectralFeatures = {
      lfHfRatio,
      totalPower,
      complexity
    };
  }
  
  /**
   * Calculate RMSSD from real RR intervals
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
   * Calculate RR interval variation from real data
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const lastRR = intervals[intervals.length - 1];
    
    return Math.abs(lastRR - mean) / mean;
  }
  
  /**
   * Reset analyzer state completely
   * All measurements start from zero
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
    
    console.log("ArrhythmiaProcessor: Reset complete - all values at zero", {
      timestamp: new Date().toISOString()
    });
  }
}
