
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Pattern detector for arrhythmia detection
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private anomalyScores: number[] = [];
  
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 5;
  private readonly PATTERN_MATCH_THRESHOLD = 0.80; // Increased from 0.70
  private readonly SIGNAL_DECLINE_THRESHOLD = 0.3; // New threshold for detecting sudden signal declines

  // New: Tracking time-based pattern consistency
  private lastUpdateTime: number = 0;
  private timeGapTooLarge: boolean = false;
  private readonly MAX_TIME_GAP_MS = 200; // Maximum allowed time between updates

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
      }
    }
    this.lastUpdateTime = currentTime;
    
    // Detect sudden drops in signal that indicate finger removal
    const suddenDrop = this.patternBuffer.length > 0 && 
                      this.patternBuffer[this.patternBuffer.length - 1] > this.SIGNAL_DECLINE_THRESHOLD &&
                      value < this.SIGNAL_DECLINE_THRESHOLD * 0.3;
    
    if (suddenDrop) {
      console.log(`Sudden signal drop detected: ${this.patternBuffer[this.patternBuffer.length - 1]} -> ${value}`);
      // Reset buffer on sudden drops to prevent false patterns
      this.resetPatternBuffer();
      return;
    }
    
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.5 ? 1 : 0; // Increased threshold from 0.4
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
  }
  
  /**
   * Reset pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
    this.timeGapTooLarge = false;
    this.lastUpdateTime = 0;
  }
  
  /**
   * Detect arrhythmia patterns in real data
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH || this.timeGapTooLarge) {
      return false;
    }
    
    // New: Check if there's enough variation in the signal to be a real finger
    const minVal = Math.min(...this.patternBuffer);
    const maxVal = Math.max(...this.patternBuffer);
    const signalRange = maxVal - minVal;
    
    // If the signal range is too small, it's likely not a real finger
    if (signalRange < 0.1) {
      return false;
    }
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.5).length; // Increased from 0.4
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Feature 3: Check for oscillation pattern (up-down-up) which is characteristic of heartbeats
    let oscillationCount = 0;
    for (let i = 1; i < recentPattern.length - 1; i++) {
      if ((recentPattern[i] > recentPattern[i-1] && recentPattern[i] > recentPattern[i+1]) ||
          (recentPattern[i] < recentPattern[i-1] && recentPattern[i] < recentPattern[i+1])) {
        oscillationCount++;
      }
    }
    const oscillationRatio = oscillationCount / (recentPattern.length - 2);
    
    // Combine features with weighted scoring, now including oscillation pattern
    const patternScore = (variationRatio * 0.5) + (anomalyRatio * 0.2) + (oscillationRatio * 0.3);
    
    // Return true if pattern score exceeds threshold
    return patternScore > this.PATTERN_MATCH_THRESHOLD;
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
}
