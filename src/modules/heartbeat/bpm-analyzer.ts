
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  constructor(minBpm = 45, maxBpm = 180, bpmWindowSize = 6) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // Stricter physiological range
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Calculate average BPM with more weight on recent values but some smoothing
      let weightedSum = 0;
      let weightSum = 0;
      
      // Apply weights: more recent values have higher weights, but not excessively
      for (let i = 0; i < this.bpmValues.length; i++) {
        const weight = i + 1; // Weight increases for more recent values
        weightedSum += this.bpmValues[i] * weight;
        weightSum += weight;
      }
      
      const currentBpm = Math.round(weightedSum / weightSum);
      this.prevValidBpm = currentBpm;
      
      return currentBpm;
    }
    
    // Be more conservative - only return previous valid BPM if we have one
    return this.prevValidBpm > 0 ? this.prevValidBpm : null;
  }
  
  public calculateConfidence(quality: number): number {
    // More conservative quality-based confidence
    let confidence = (quality / 100) * 0.6; // Lower confidence based on quality alone
    
    // Only boost confidence with consistent readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // More conservative boosts
      if (stdDev < 3) {
        confidence += 0.35; // Big boost for very consistent readings
      } else if (stdDev < 5) {
        confidence += 0.25;
      } else if (stdDev < 10) {
        confidence += 0.15;
      }
    }
    
    // Less confidence for limited BPM history
    if (this.bpmValues.length > 0) {
      confidence += 0.05 * Math.min(1, this.bpmValues.length / 4);
    }
    
    return Math.min(1.0, confidence);
  }
  
  public get currentBPM(): number | null {
    return this.prevValidBpm > 0 ? this.prevValidBpm : null; // Return null if no valid BPM
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
  }
}
