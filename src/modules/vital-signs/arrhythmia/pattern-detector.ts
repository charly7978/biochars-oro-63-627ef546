
/**
 * Arrhythmia pattern detection module
 * Detects arrhythmia patterns in heart rate data
 */

/**
 * Detector for arrhythmia patterns based on RR interval analysis
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private readonly BUFFER_SIZE = 20;
  private readonly DETECTION_THRESHOLD = 0.18;
  private consecutivePatterns = 0;
  
  /**
   * Update the pattern buffer with new normalized variation value
   * 
   * @param normalizedVariation New normalized variation (0-1)
   */
  public updatePatternBuffer(normalizedVariation: number): void {
    this.patternBuffer.push(normalizedVariation);
    
    if (this.patternBuffer.length > this.BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
  }
  
  /**
   * Detect arrhythmia patterns in the current buffer
   * 
   * @returns Boolean indicating if an arrhythmia pattern is detected
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.BUFFER_SIZE / 2) {
      return false;
    }
    
    // Count significant variations
    let significantVariations = 0;
    let consecutiveVariations = 0;
    let maxConsecutive = 0;
    
    for (const variation of this.patternBuffer) {
      if (variation > this.DETECTION_THRESHOLD) {
        significantVariations++;
        consecutiveVariations++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveVariations);
      } else {
        consecutiveVariations = 0;
      }
    }
    
    // Pattern detected if at least 15% of values are significant
    // or if we have at least 3 consecutive significant variations
    const patternDetected = 
      (significantVariations / this.patternBuffer.length > 0.15) ||
      (maxConsecutive >= 3);
    
    // Update consecutive pattern counter
    if (patternDetected) {
      this.consecutivePatterns++;
    } else {
      this.consecutivePatterns = Math.max(0, this.consecutivePatterns - 1);
    }
    
    // Need at least 2 consecutive detected patterns
    return this.consecutivePatterns >= 2;
  }
  
  /**
   * Reset the pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.consecutivePatterns = 0;
  }
  
  /**
   * Get the current pattern buffer
   */
  public getPatternBuffer(): number[] {
    return [...this.patternBuffer];
  }
  
  /**
   * Get the number of consecutive detected patterns
   */
  public getConsecutivePatterns(): number {
    return this.consecutivePatterns;
  }
}
