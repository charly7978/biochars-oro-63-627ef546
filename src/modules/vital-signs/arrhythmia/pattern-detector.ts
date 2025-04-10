
/**
 * Arrhythmia pattern detection module
 * Detects arrhythmia patterns in heart rate data
 */

/**
 * Detector for arrhythmia patterns based on RR interval analysis
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private readonly BUFFER_SIZE = 12; // Reducido de 20 a 12
  private readonly DETECTION_THRESHOLD = 0.08; // Reducido significativamente de 0.15 a 0.08
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
    if (this.patternBuffer.length < this.BUFFER_SIZE / 4) { // Reducido de buffer/3 a buffer/4
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
    
    // Pattern detected if at least 10% of values are significant (Reducido de 12% a 10%)
    // or if we have at least 1 consecutive significant variation (Reducido de 2 a 1)
    const patternDetected = 
      (significantVariations / this.patternBuffer.length > 0.10) || 
      (maxConsecutive >= 1);
    
    // Update consecutive pattern counter
    if (patternDetected) {
      this.consecutivePatterns++;
    } else {
      this.consecutivePatterns = Math.max(0, this.consecutivePatterns - 1);
    }
    
    // Need only 1 consecutive detected pattern
    return this.consecutivePatterns >= 1;
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
