
/**
 * Arrhythmia pattern detection system
 * For detecting repeated patterns of arrhythmia events
 */

export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private readonly PATTERN_BUFFER_SIZE = 20;
  private readonly PATTERN_MATCH_THRESHOLD = 0.75;
  private readonly MIN_PATTERN_LENGTH = 5;

  /**
   * Update the pattern buffer with a new variability value
   * @param variabilityValue Normalized variability value (0-1)
   */
  public updatePatternBuffer(variabilityValue: number): void {
    this.patternBuffer.push(variabilityValue);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
  }

  /**
   * Detect whether the recent pattern is indicative of arrhythmia
   * @returns True if arrhythmia pattern is detected
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_PATTERN_LENGTH) {
      return false;
    }

    // Simple threshold approach
    const highVariabilityCount = this.patternBuffer.filter(v => v > 0.2).length;
    const highVarPercentage = highVariabilityCount / this.patternBuffer.length;

    // Check for alternating patterns (bigeminy-like)
    let alternatingCount = 0;
    for (let i = 1; i < this.patternBuffer.length; i++) {
      if ((this.patternBuffer[i] > 0.2 && this.patternBuffer[i-1] < 0.2) ||
          (this.patternBuffer[i] < 0.2 && this.patternBuffer[i-1] > 0.2)) {
        alternatingCount++;
      }
    }
    
    const alternatingPercentage = alternatingCount / (this.patternBuffer.length - 1);

    // Detect sustained high variability or strong alternating pattern
    return highVarPercentage > 0.4 || alternatingPercentage > 0.6;
  }

  /**
   * Reset the pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
  }

  /**
   * Get current pattern buffer for analysis
   */
  public getPatternBuffer(): number[] {
    return [...this.patternBuffer];
  }
}
