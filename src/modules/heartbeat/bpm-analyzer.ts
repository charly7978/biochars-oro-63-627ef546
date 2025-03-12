
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  constructor(minBpm = 40, maxBpm = 180, bpmWindowSize = 5) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // Only accept physiologically plausible values, but with wider range
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Calculate average BPM with more weight on recent values
      let weightedSum = 0;
      let weightSum = 0;
      
      // Apply weights: more recent values have higher weights
      for (let i = 0; i < this.bpmValues.length; i++) {
        const weight = i + 1; // Weight increases for more recent values
        weightedSum += this.bpmValues[i] * weight;
        weightSum += weight;
      }
      
      const currentBpm = Math.round(weightedSum / weightSum);
      this.prevValidBpm = currentBpm;
      
      return currentBpm;
    }
    
    return this.prevValidBpm > 0 ? this.prevValidBpm : 75; // Always return a value
  }
  
  public calculateConfidence(quality: number): number {
    // Start with much higher quality-based confidence
    let confidence = (quality / 100) + 0.2; // Add 0.2 base confidence
    
    // Boost confidence if we have consistent BPM readings - with just 2 readings
    if (this.bpmValues.length >= 2) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Much higher boosts for consistent readings
      if (stdDev < 5) {
        confidence += 0.4;
      } else if (stdDev < 10) {
        confidence += 0.3;
      } else if (stdDev < 15) {
        confidence += 0.2;
      }
    }
    
    // Add confidence just for having values
    if (this.bpmValues.length > 0) {
      confidence += 0.1 * Math.min(1, this.bpmValues.length / 3);
    }
    
    return Math.min(1.0, confidence); // Cap at 1.0
  }
  
  public get currentBPM(): number {
    return this.prevValidBpm || 75; // Default to 75 BPM if no history
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
  }
}
