
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
  private readonly PATTERN_MATCH_THRESHOLD = 0.65;

  /**
   * Update pattern buffer with real data
   */
  public updatePatternBuffer(value: number): void {
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.3 ? 1 : 0;
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
  }
  
  /**
   * Detect arrhythmia patterns in real data
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH) return false;
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.3).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Combine features with weighted scoring
    const patternScore = (variationRatio * 0.7) + (anomalyRatio * 0.3);
    
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
}
