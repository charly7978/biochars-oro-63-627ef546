
/**
 * Signal quality analyzer for vital sign processing
 * Analyzes raw input signal for quality assessment
 */
export class SignalQualityAnalyzer {
  private qualityScore: number = 0;
  private lastValues: number[] = [];
  private readonly MAX_HISTORY = 30;
  
  /**
   * Analyze signal quality based on recent values
   */
  public analyzeQuality(
    currentValue: number,
    recentValues: number[] = []
  ): { score: number; isAcceptable: boolean } {
    // Update history
    this.updateHistory(currentValue);
    
    // Use provided values or internal history
    const valuesToAnalyze = recentValues.length > 0 ? recentValues : this.lastValues;
    
    if (valuesToAnalyze.length < 5) {
      return { score: 0, isAcceptable: false };
    }
    
    // Calculate basic statistics
    const min = Math.min(...valuesToAnalyze);
    const max = Math.max(...valuesToAnalyze);
    const range = max - min;
    const mean = valuesToAnalyze.reduce((sum, val) => sum + val, 0) / valuesToAnalyze.length;
    
    // Calculate variance and standard deviation
    let variance = 0;
    for (const val of valuesToAnalyze) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= valuesToAnalyze.length;
    const stdDev = Math.sqrt(variance);
    
    // Signal quality criteria
    let score = 0;
    
    // Amplitude check (range should be significant but not extreme)
    if (range > 0.05 && range < 5) {
      score += 40;
    } else if (range > 0 && range <= 0.05) {
      score += 10;
    }
    
    // Noise check (lower stdDev relative to range is better)
    const noiseRatio = range > 0 ? stdDev / range : 1;
    if (noiseRatio < 0.3) {
      score += 40;
    } else if (noiseRatio < 0.5) {
      score += 20;
    }
    
    // Check for consistent patterns
    let patternScore = this.checkForPatterns(valuesToAnalyze);
    score += patternScore;
    
    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));
    this.qualityScore = score;
    
    return {
      score,
      isAcceptable: score >= 30
    };
  }
  
  /**
   * Check signal for consistent patterns
   */
  private checkForPatterns(values: number[]): number {
    if (values.length < 10) return 0;
    
    // Detect consistent zero-crossings or direction changes
    let directionChanges = 0;
    for (let i = 2; i < values.length; i++) {
      const prevDiff = values[i-1] - values[i-2];
      const currDiff = values[i] - values[i-1];
      
      if ((prevDiff >= 0 && currDiff < 0) || (prevDiff < 0 && currDiff >= 0)) {
        directionChanges++;
      }
    }
    
    // For a good heart rate signal, expect around 1-2 direction changes per second
    // with a 30Hz sampling rate, that's about 1 change per 15-30 samples
    const directionChangeRate = directionChanges / (values.length - 2);
    
    if (directionChangeRate > 0.03 && directionChangeRate < 0.2) {
      return 20;
    } else if (directionChangeRate > 0.01 && directionChangeRate < 0.3) {
      return 10;
    }
    
    return 0;
  }
  
  /**
   * Update internal value history
   */
  private updateHistory(value: number): void {
    this.lastValues.push(value);
    if (this.lastValues.length > this.MAX_HISTORY) {
      this.lastValues.shift();
    }
  }
  
  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.qualityScore = 0;
    this.lastValues = [];
  }
  
  /**
   * Get current quality score
   */
  public getQualityScore(): number {
    return this.qualityScore;
  }
}
