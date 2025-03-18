
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Pattern detector for arrhythmia detection
 * USES ONLY REAL DATA - NO SIMULATION WHATSOEVER
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private anomalyScores: number[] = [];
  
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 5;
  private readonly PATTERN_MATCH_THRESHOLD = 0.90; // Drastically increased from 0.80
  private readonly SIGNAL_DECLINE_THRESHOLD = 0.4; // Increased from 0.3

  // Tracking time-based pattern consistency
  private lastUpdateTime: number = 0;
  private timeGapTooLarge: boolean = false;
  private readonly MAX_TIME_GAP_MS = 100; // Reduced from 200 - stricter timing

  // Physiological validation
  private consecutiveValidPatterns: number = 0;
  private readonly MIN_VALID_PATTERNS_REQUIRED = 6; // Require more consistent patterns
  private readonly MIN_SIGNAL_AMPLITUDE = 0.30; // Minimum amplitude for real signals
  
  /**
   * Update pattern buffer with real data
   */
  public updatePatternBuffer(value: number): void {
    const currentTime = Date.now();
    
    // Check for time gaps that would indicate finger removal
    if (this.lastUpdateTime > 0) {
      const timeDiff = currentTime - this.lastUpdateTime;
      this.timeGapTooLarge = timeDiff > this.MAX_TIME_GAP_MS;
      
      if (this.timeGapTooLarge) {
        console.log(`Large time gap detected: ${timeDiff}ms - likely indicates finger removal`);
        // Reset validation on large time gaps
        this.consecutiveValidPatterns = 0;
      }
    }
    this.lastUpdateTime = currentTime;
    
    // Detect sudden drops in signal that indicate finger removal
    const suddenDrop = this.patternBuffer.length > 0 && 
                      this.patternBuffer[this.patternBuffer.length - 1] > this.SIGNAL_DECLINE_THRESHOLD &&
                      value < this.SIGNAL_DECLINE_THRESHOLD * 0.3;
    
    if (suddenDrop) {
      console.log(`Sudden signal drop detected: ${this.patternBuffer[this.patternBuffer.length - 1]} -> ${value}`);
      // Reset buffer and validation on sudden drops
      this.resetPatternBuffer();
      return;
    }
    
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Only track real anomaly scores - no simulation
    const anomalyScore = this.calculateRealAnomalyScore(value);
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
  }
  
  /**
   * Calculate anomaly score based ONLY on real signal characteristics
   * No simulation whatsoever
   */
  private calculateRealAnomalyScore(value: number): number {
    // Stricter anomaly thresholds - only real extreme values count
    if (value > 0.7) return 1; // Only very strong signals count as anomalies
    if (value < 0.2) return 0; // Weak signals are not anomalies
    
    // Everything in the middle gets a graduated score
    return (value - 0.2) / 0.5;
  }
  
  /**
   * Reset pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
    this.timeGapTooLarge = false;
    this.lastUpdateTime = 0;
    this.consecutiveValidPatterns = 0;
  }
  
  /**
   * Detect arrhythmia patterns in real data ONLY
   * No simulation whatsoever
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH || this.timeGapTooLarge) {
      this.consecutiveValidPatterns = 0;
      return false;
    }
    
    // Check if there's enough variation in the signal to be a real finger
    const minVal = Math.min(...this.patternBuffer);
    const maxVal = Math.max(...this.patternBuffer);
    const signalRange = maxVal - minVal;
    
    // If the signal range is too small, it's likely not a real finger
    if (signalRange < this.MIN_SIGNAL_AMPLITUDE) {
      this.consecutiveValidPatterns = 0;
      return false;
    }
    
    // Analyze recent real data pattern - no simulation
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data only
    const significantVariations = recentPattern.filter(v => v > 0.7).length; // Drastically increased from 0.5
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data only
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0.7).length; // Increased from any positive
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Feature 3: Check for oscillation pattern (up-down-up) which is characteristic of heartbeats
    let oscillationCount = 0;
    for (let i = 1; i < recentPattern.length - 1; i++) {
      // Require stronger oscillations
      if ((recentPattern[i] > recentPattern[i-1] * 1.3 && recentPattern[i] > recentPattern[i+1] * 1.3) ||
          (recentPattern[i] < recentPattern[i-1] * 0.7 && recentPattern[i] < recentPattern[i+1] * 0.7)) {
        oscillationCount++;
      }
    }
    const oscillationRatio = oscillationCount / (recentPattern.length - 2);
    
    // Validate physiological timing between peaks
    let validTimingRatio = 0;
    if (oscillationCount >= 2) {
      const peakIndices: number[] = [];
      for (let i = 1; i < recentPattern.length - 1; i++) {
        if (recentPattern[i] > recentPattern[i-1] && recentPattern[i] > recentPattern[i+1]) {
          peakIndices.push(i);
        }
      }
      
      // Check if peak timing matches physiological heart rate (40-180 BPM)
      let validTiming = 0;
      for (let i = 1; i < peakIndices.length; i++) {
        const framesBetweenPeaks = peakIndices[i] - peakIndices[i-1];
        // Assuming typical frame rate of ~30fps
        const estimatedIntervalMs = framesBetweenPeaks * 33.3;
        if (estimatedIntervalMs >= 333 && estimatedIntervalMs <= 1500) {
          validTiming++;
        }
      }
      
      validTimingRatio = peakIndices.length > 1 ? 
                        validTiming / (peakIndices.length - 1) : 0;
    }
    
    // Combine features with weighted scoring, now including timing validation
    const patternScore = (variationRatio * 0.3) + 
                         (anomalyRatio * 0.2) + 
                         (oscillationRatio * 0.3) +
                         (validTimingRatio * 0.2);
    
    // Track consecutive valid patterns - real detection only
    if (patternScore > this.PATTERN_MATCH_THRESHOLD) {
      this.consecutiveValidPatterns++;
      console.log(`Valid pattern detected: ${patternScore.toFixed(2)}, consecutive: ${this.consecutiveValidPatterns}`);
    } else {
      this.consecutiveValidPatterns = 0;
    }
    
    // Only return true after seeing many consecutive valid patterns
    return patternScore > this.PATTERN_MATCH_THRESHOLD && 
           this.consecutiveValidPatterns >= this.MIN_VALID_PATTERNS_REQUIRED;
  }

  /**
   * Get the current pattern buffer
   */
  public getPatternBuffer(): number[] {
    return [...this.patternBuffer];
  }

  /**
   * Get the current anomaly scores
   */
  public getAnomalyScores(): number[] {
    return [...this.anomalyScores];
  }
  
  /**
   * Get if time gap is too large (indicator of finger removal)
   */
  public isTimeGapTooLarge(): boolean {
    return this.timeGapTooLarge;
  }
  
  /**
   * Get number of consecutive valid patterns detected
   */
  public getConsecutiveValidPatterns(): number {
    return this.consecutiveValidPatterns;
  }
}
