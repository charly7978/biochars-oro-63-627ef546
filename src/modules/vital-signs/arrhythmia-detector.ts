
/**
 * Enhanced Arrhythmia Detector Module
 * Implements multiple algorithms for improved detection accuracy
 */
export class ArrhythmiaDetector {
  private readonly RMSSD_THRESHOLD = 8; // Reduced from 12 for better sensitivity
  private readonly RR_VARIATION_THRESHOLD = 0.08; // Reduced from 0.12 for better sensitivity
  private readonly MIN_TIME_BETWEEN_DETECTIONS = 800; // Reduced from 1500 to detect more frequently
  
  private lastArrhythmiaTime: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;
  
  constructor() {
    console.log("ArrhythmiaDetector: Initialized with enhanced sensitivity");
  }
  
  /**
   * Process RR intervals to detect arrhythmias with multiple algorithms
   */
  public processRRIntervals(intervals: number[]): {
    isArrhythmia: boolean;
    rmssd: number;
    rrVariation: number;
  } {
    // Need at least 3 intervals for analysis
    if (intervals.length < 3) {
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0 };
    }
    
    // Use the most recent intervals for analysis
    const recentIntervals = intervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let rmssd = this.calculateRMSSD(recentIntervals);
    
    // Calculate average RR interval with more weight to recent intervals
    let avgRR = 0;
    let weightSum = 0;
    for (let i = 0; i < recentIntervals.length; i++) {
      const weight = i + 1; // Higher weight to more recent values
      avgRR += recentIntervals[i] * weight;
      weightSum += weight;
    }
    avgRR = avgRR / weightSum;
    
    // Calculate variation from the last interval to the average
    const lastRR = recentIntervals[recentIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Check if enough time has passed since last detection
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastArrhythmiaTime;
    
    // Multi-criteria detection algorithm with higher sensitivity
    const isArrhythmiaRMSSD = rmssd > this.RMSSD_THRESHOLD;
    const isArrhythmiaVariation = rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Detection of severe tachycardia and bradycardia (more permissive thresholds)
    const isExtremeTachycardia = lastRR < 0.8 * avgRR; // 20% faster than average (was 30%)
    const isExtremeBradycardia = lastRR > 1.2 * avgRR; // 20% slower than average (was 30%)
    
    // Combined detection logic - More sensitive combined logic
    const isArrhythmia = 
      (isArrhythmiaRMSSD || isArrhythmiaVariation) || 
      isExtremeTachycardia || 
      isExtremeBradycardia;
    
    // Only record if enough time has passed since the last detection
    if (isArrhythmia && timeSinceLastDetection >= this.MIN_TIME_BETWEEN_DETECTIONS) {
      this.lastArrhythmiaTime = currentTime;
      this.lastArrhythmiaData = {
        timestamp: currentTime,
        rmssd,
        rrVariation
      };
      
      // Detailed diagnostic log
      console.log("ArrhythmiaDetector: Arrhythmia detected", {
        rmssd,
        rrVariation,
        isExtremeTachycardia,
        isExtremeBradycardia,
        avgRR,
        lastRR,
        recentIntervals
      });
    }
    
    return { isArrhythmia, rmssd, rrVariation };
  }
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
  }
  
  /**
   * Get information about the last detected arrhythmia
   */
  public getLastArrhythmiaData(): {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null {
    return this.lastArrhythmiaData;
  }
  
  /**
   * Reset the detector state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.lastArrhythmiaData = null;
  }
}
