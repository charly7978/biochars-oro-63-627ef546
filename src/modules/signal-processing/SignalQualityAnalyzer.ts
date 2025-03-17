
/**
 * Analyzes signal quality based on medical-grade standards
 */
export class SignalQualityAnalyzer {
  private readonly QUALITY_BUFFER_SIZE = 20;
  private qualityHistory: number[] = [];
  
  /**
   * Calculate signal quality based on various metrics
   * @param filteredValue - The filtered signal value
   * @param rawValue - The raw signal value
   * @returns Quality score from 0-100
   */
  public assessQuality(filteredValue: number, rawValue: number): number {
    // For very weak signals, return minimal quality
    if (Math.abs(filteredValue) < 0.005) { // More sensitive threshold (was 0.01)
      console.log("SignalQualityAnalyzer: Signal very weak", { filteredValue });
      return 20; // Slightly increased minimum quality (was 15)
    }
    
    // Add to quality history
    this.qualityHistory.push(filteredValue);
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Need enough data points for meaningful analysis
    if (this.qualityHistory.length < 5) {
      console.log("SignalQualityAnalyzer: Initial data collection", { 
        historyLength: this.qualityHistory.length 
      });
      return this.qualityHistory.length * 10; // Higher initial quality (was 8)
    }
    
    // Calculate metrics - stability, range, noise
    const recent = this.qualityHistory.slice(-5);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    
    // Calculate variations between consecutive samples
    const variations: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      variations.push(Math.abs(recent[i] - recent[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    
    // Calculate quality based on signal properties - even less strict criteria
    const stabilityScore = Math.max(0, 100 - (avgVariation * 400)); // Less sensitive to variation (was 500)
    const rangeScore = range > 0.001 && range < 1.5 ? 100 : 50; // More permissive range (was 0.005-1.0)
    
    // Weighted combined score
    const qualityScore = (stabilityScore * 0.5) + (rangeScore * 0.5); // Even more balanced weights
    
    // Debug reporting (frequently)
    if (Math.random() < 0.25) { // Increased reporting frequency for debugging (was 0.1)
      console.log("SignalQualityAnalyzer: Quality assessment", {
        qualityScore,
        stabilityScore,
        rangeScore,
        avgVariation,
        range,
        rawValue,
        filteredValue
      });
    }
    
    return Math.min(100, Math.max(0, qualityScore));
  }
  
  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.qualityHistory = [];
    console.log("SignalQualityAnalyzer: Reset complete");
  }
}
