
/**
 * Dedicated analyzer for PPG signal quality metrics
 */
export class SignalQualityAnalyzer {
  private signalQuality: number = 0;
  private perfusionIndex: number = 0;
  private pressureArtifactLevel: number = 0;
  
  /**
   * Analyzes signal quality based on various metrics
   */
  public analyzeSignalQuality(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }
    
    // Calculate basic signal statistics
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Simple signal quality metric based on amplitude and consistency
    let qualityScore = Math.min(100, range * 50);
    
    // Apply smoothing to avoid rapid fluctuations
    this.signalQuality = this.signalQuality * 0.7 + qualityScore * 0.3;
    
    return this.signalQuality;
  }
  
  /**
   * Detects artifacts caused by pressure variations
   */
  public detectPressureArtifacts(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }
    
    // Simplified pressure artifact detection based on signal characteristics
    const recentValues = values.slice(-30);
    const diffValues = recentValues.slice(1).map((v, i) => Math.abs(v - recentValues[i]));
    const avgDiff = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
    
    // Calculate pressure artifact level (0-1)
    const rawArtifactLevel = Math.min(1, avgDiff * 5);
    
    // Apply smoothing
    this.pressureArtifactLevel = this.pressureArtifactLevel * 0.8 + rawArtifactLevel * 0.2;
    
    return this.pressureArtifactLevel;
  }
  
  /**
   * Updates perfusion index based on waveform characteristics
   */
  public updatePerfusionIndex(perfusion: number): void {
    this.perfusionIndex = perfusion;
  }
  
  /**
   * Getters for various quality metrics
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  public getPerfusionIndex(): number {
    return this.perfusionIndex;
  }
  
  public getPressureArtifactLevel(): number {
    return this.pressureArtifactLevel;
  }
  
  /**
   * Resets all quality metrics
   */
  public reset(): void {
    this.signalQuality = 0;
    this.perfusionIndex = 0;
    this.pressureArtifactLevel = 0;
  }
}
