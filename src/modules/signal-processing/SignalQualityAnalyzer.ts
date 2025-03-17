
/**
 * Analyzes signal quality based on medical-grade standards
 */
export class SignalQualityAnalyzer {
  private readonly QUALITY_BUFFER_SIZE = 25; // Increased buffer size
  private qualityHistory: number[] = [];
  private valueHistory: number[] = [];
  
  /**
   * Calculate signal quality based on various metrics
   * @param filteredValue - The filtered signal value
   * @param rawValue - The raw signal value
   * @returns Quality score from 0-100
   */
  public assessQuality(filteredValue: number, rawValue: number): number {
    // If signal is too weak, return low quality but not zero
    // to improve detection in challenging lighting conditions
    if (Math.abs(filteredValue) < 0.02) {
      return 15; // Return a minimal quality instead of 0
    }
    
    // Update history buffers
    this.qualityHistory.push(filteredValue);
    this.valueHistory.push(rawValue);
    
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
    
    if (this.valueHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.valueHistory.shift();
    }
    
    // Need enough data points for meaningful analysis
    if (this.qualityHistory.length < 5) {
      return 25; // Slightly increased minimal quality during initial data collection
    }
    
    // Calculate metrics with more forgiving thresholds
    const recent = this.qualityHistory.slice(-7); // Look at more recent values
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    
    // Calculate variations between consecutive samples
    const variations: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      variations.push(Math.abs(recent[i] - recent[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    
    // Calculate raw value stability
    const rawRecent = this.valueHistory.slice(-7);
    const rawStdDev = this.calculateStandardDeviation(rawRecent);
    const rawMean = rawRecent.reduce((sum, v) => sum + v, 0) / rawRecent.length;
    const rawCV = rawStdDev / rawMean; // Coefficient of variation
    
    // More forgiving scores for various metrics
    const stabilityScore = Math.max(0, 100 - (avgVariation * 600)); // Less penalization
    const rangeScore = range > 0.01 ? 80 : 40; // More forgiving range requirement
    const rawStabilityScore = rawCV < 0.1 ? 90 : 
                            rawCV < 0.2 ? 70 : 
                            rawCV < 0.3 ? 50 : 30;
    
    // Detect trending patterns (heart pulse creates specific patterns)
    const patternScore = this.detectPatterns(recent);
    
    // Combined score with adjusted weights
    const qualityScore = (stabilityScore * 0.5) + 
                        (rangeScore * 0.2) + 
                        (rawStabilityScore * 0.15) +
                        (patternScore * 0.15);
    
    // Occasionally log detailed quality info for debugging
    if (Math.random() < 0.05) {
      console.log("SignalQualityAnalyzer: Quality details", {
        filteredValue,
        rawValue,
        range,
        avgVariation,
        rawCV,
        stabilityScore,
        rangeScore,
        rawStabilityScore,
        patternScore,
        qualityScore: Math.min(100, Math.max(0, qualityScore))
      });
    }
    
    return Math.min(100, Math.max(0, qualityScore));
  }
  
  /**
   * Detect if there are patterns in the signal typical of PPG waveforms
   */
  private detectPatterns(values: number[]): number {
    if (values.length < 5) return 0;
    
    // Detect rising and falling patterns
    let risingCount = 0;
    let fallingCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) {
        risingCount++;
      } else if (values[i] < values[i-1]) {
        fallingCount++;
      }
    }
    
    // A good PPG signal should have both rising and falling sections
    const hasRising = risingCount >= 2;
    const hasFalling = fallingCount >= 2;
    
    if (hasRising && hasFalling) {
      // Calculate the alternating pattern factor
      const alterations = this.countAlternations(values);
      const alterationScore = Math.min(100, alterations * 25);
      
      return alterationScore;
    }
    
    return 0;
  }
  
  /**
   * Count how many times the signal changes direction (alternates)
   */
  private countAlternations(values: number[]): number {
    if (values.length < 3) return 0;
    
    let alternations = 0;
    let isRising = values[1] > values[0];
    
    for (let i = 2; i < values.length; i++) {
      const currentlyRising = values[i] > values[i-1];
      
      if (currentlyRising !== isRising) {
        alternations++;
        isRising = currentlyRising;
      }
    }
    
    return alternations;
  }
  
  /**
   * Calculate standard deviation of values
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.qualityHistory = [];
    this.valueHistory = [];
  }
}
