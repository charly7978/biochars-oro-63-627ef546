
/**
 * Calculates confidence levels for vital signs measurements
 */
export class ConfidenceCalculator {
  private confidenceThreshold: number;
  
  constructor(confidenceThreshold: number = 0.15) {
    this.confidenceThreshold = confidenceThreshold;
  }
  
  /**
   * Calculate overall confidence based on individual measurements
   */
  calculateOverallConfidence(glucoseConfidence: number, lipidsConfidence: number): number {
    // Optional: add more confidence values as needed
    return Math.min(0.8, (glucoseConfidence + lipidsConfidence) / 2);
  }
  
  /**
   * Check if confidence meets threshold
   */
  meetsThreshold(confidence: number): boolean {
    return confidence >= this.confidenceThreshold;
  }
  
  /**
   * Get the current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
  
  /**
   * Set a new confidence threshold
   */
  setConfidenceThreshold(newThreshold: number): void {
    this.confidenceThreshold = Math.max(0.05, Math.min(0.9, newThreshold));
  }
}
