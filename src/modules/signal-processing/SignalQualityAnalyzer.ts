
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
    // If signal is too weak, return zero quality
    if (Math.abs(filteredValue) < 0.05) {
      return 0;
    }
    
    // Add to quality history
    this.qualityHistory.push(filteredValue);
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Need enough data points for meaningful analysis
    if (this.qualityHistory.length < 5) {
      return 20; // Minimal quality during initial data collection
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
    
    // Calculate quality based on signal properties
    const stabilityScore = Math.max(0, 100 - (avgVariation * 800));
    const rangeScore = range > 0.02 && range < 0.5 ? 100 : 50;
    
    // Combined score weighted by importance
    const qualityScore = (stabilityScore * 0.7) + (rangeScore * 0.3);
    
    return Math.min(100, Math.max(0, qualityScore));
  }
  
  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.qualityHistory = [];
  }
}
