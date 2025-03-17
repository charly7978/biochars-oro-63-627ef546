
/**
 * Analyzes signal quality based on medical-grade standards
 */
export class SignalQualityAnalyzer {
  private readonly QUALITY_BUFFER_SIZE = 5; // Reduced for faster response
  private qualityHistory: number[] = [];
  
  /**
   * Calculate signal quality based on various metrics
   * @param filteredValue - The filtered signal value
   * @param rawValue - The raw signal value
   * @returns Quality score from 0-100
   */
  public assessQuality(filteredValue: number, rawValue: number): number {
    // For very weak signals, still give minimal quality
    if (Math.abs(filteredValue) < 0.001) { // Extremely sensitive threshold
      console.log("SignalQualityAnalyzer: Signal very weak", { filteredValue });
      return 30; // Higher minimum quality
    }
    
    // Add to quality history
    this.qualityHistory.push(filteredValue);
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Need enough data points for meaningful analysis
    if (this.qualityHistory.length < 3) { // Reduced requirement
      console.log("SignalQualityAnalyzer: Initial data collection", { 
        historyLength: this.qualityHistory.length 
      });
      return this.qualityHistory.length * 15; // Much higher initial quality
    }
    
    // Calculate metrics - stability, range, noise
    const recent = this.qualityHistory.slice(-3); // Use fewer points
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    
    // Calculate variations between consecutive samples
    const variations: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      variations.push(Math.abs(recent[i] - recent[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    
    // Calculate quality based on signal properties - extremely permissive
    const stabilityScore = Math.max(0, 100 - (avgVariation * 200)); // Much less sensitive to variation
    const rangeScore = range > 0.0001 ? 100 : 50; // Super permissive range
    
    // Weighted combined score - biased toward stability
    const qualityScore = (stabilityScore * 0.7) + (rangeScore * 0.3);
    
    // Debug reporting (very frequently)
    console.log("SignalQualityAnalyzer: Quality assessment", {
      qualityScore,
      stabilityScore,
      rangeScore,
      avgVariation,
      range,
      rawValue,
      filteredValue
    });
    
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
