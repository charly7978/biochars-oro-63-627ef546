
/**
 * Enhanced Arrhythmia Detector Module
 * Implements multiple algorithms for improved detection accuracy
 */
export class ArrhythmiaDetector {
  // Increase thresholds to reduce false positives
  private readonly RMSSD_THRESHOLD = 20; // Increased from 8 for less sensitivity
  private readonly RR_VARIATION_THRESHOLD = 0.18; // Increased from 0.08 for less sensitivity
  private readonly MIN_TIME_BETWEEN_DETECTIONS = 2000; // Increased from 800 to detect less frequently
  
  private lastArrhythmiaTime: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;
  
  constructor() {
    console.log("ArrhythmiaDetector: Initialized with balanced sensitivity");
  }
  
  /**
   * Process RR intervals to detect arrhythmias with multiple algorithms
   */
  public processRRIntervals(intervals: number[]): {
    isArrhythmia: boolean;
    rmssd: number;
    rrVariation: number;
  } {
    // Need at least 4 intervals for more reliable analysis
    if (intervals.length < 4) {
      return { isArrhythmia: false, rmssd: 0, rrVariation: 0 };
    }
    
    // Use the most recent intervals for analysis
    const recentIntervals = intervals.slice(-5);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let rmssd = this.calculateRMSSD(recentIntervals);
    
    // Calculate average RR interval with more weight to recent intervals
    // but limit influence of outliers
    let avgRR = 0;
    let weightSum = 0;
    
    // Sort intervals to identify and exclude outliers
    const sortedIntervals = [...recentIntervals].sort((a, b) => a - b);
    const validIntervals = sortedIntervals.slice(1, -1); // Remove highest and lowest
    
    for (let i = 0; i < validIntervals.length; i++) {
      const weight = i + 1; // Higher weight to more recent values
      avgRR += validIntervals[i] * weight;
      weightSum += weight;
    }
    
    // Fallback if we don't have enough intervals after filtering
    if (weightSum === 0) {
      avgRR = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    } else {
      avgRR = avgRR / weightSum;
    }
    
    // Calculate variation from the last interval to the average
    const lastRR = recentIntervals[recentIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Check if enough time has passed since last detection
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastArrhythmiaTime;
    
    // Multi-criteria detection algorithm with balanced sensitivity
    const isArrhythmiaRMSSD = rmssd > this.RMSSD_THRESHOLD;
    const isArrhythmiaVariation = rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Detection of severe tachycardia and bradycardia (less sensitive)
    const isExtremeTachycardia = lastRR < 0.65 * avgRR; // 35% faster (more extreme)
    const isExtremeBradycardia = lastRR > 1.45 * avgRR; // 45% slower (more extreme)
    
    // Combined detection logic - Less sensitive to reduce false positives
    // Require at least two conditions to be met for arrhythmia detection
    const isArrhythmia = 
      (isArrhythmiaRMSSD && isArrhythmiaVariation) || 
      (isExtremeTachycardia && (isArrhythmiaRMSSD || isArrhythmiaVariation)) || 
      (isExtremeBradycardia && (isArrhythmiaRMSSD || isArrhythmiaVariation));
    
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
    
    // Filter out physiologically impossible intervals
    const validIntervals = intervals.filter(interval => interval >= 300 && interval <= 2000);
    
    if (validIntervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < validIntervals.length; i++) {
      const diff = validIntervals[i] - validIntervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (validIntervals.length - 1));
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
    console.log("ArrhythmiaDetector: Reset complete");
  }
}
