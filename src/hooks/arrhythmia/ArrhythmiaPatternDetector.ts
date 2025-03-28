
/**
 * Specialized class for arrhythmia pattern detection using advanced algorithms
 */
export class ArrhythmiaPatternDetector {
  // Pattern recognition variables
  private patternBuffer: number[] = [];
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly MIN_PATTERN_LENGTH = 5;
  private readonly PATTERN_MATCH_THRESHOLD = 0.65;
  
  // Anomaly scoring
  private anomalyScores: number[] = [];
  private readonly ANOMALY_HISTORY_SIZE = 30;

  /**
   * Updates pattern buffer with new RR variation data
   */
  public updatePatternBuffer(variation: number): void {
    // Update pattern buffer
    this.patternBuffer.push(variation);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores
    const anomalyScore = variation > 0.3 ? 1 : 0;
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
  }
  
  /**
   * Detects arrhythmia patterns using temporal analysis
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_PATTERN_LENGTH) return false;
    
    // Analyze recent pattern for arrhythmia characteristics
    const recentPattern = this.patternBuffer.slice(-this.MIN_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in recent pattern
    const significantVariations = recentPattern.filter(v => v > 0.3).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in anomaly scores
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Combine features with weighted scoring
    const patternScore = (variationRatio * 0.7) + (anomalyRatio * 0.3);
    
    // Return true if pattern score exceeds threshold
    return patternScore > this.PATTERN_MATCH_THRESHOLD;
  }
  
  /**
   * Reset pattern buffer and anomaly scores
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
  }
}
