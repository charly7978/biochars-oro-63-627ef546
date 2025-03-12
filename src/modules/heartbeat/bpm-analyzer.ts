
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  constructor(minBpm = 30, maxBpm = 200, bpmWindowSize = 3) {  // More permissive BPM range and shorter window
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // More permissive physiological range
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Much stronger weight on recent values
      let weightedSum = 0;
      let weightSum = 0;
      
      // Apply weights: much higher weight on recent values
      for (let i = 0; i < this.bpmValues.length; i++) {
        const weight = Math.pow(2, i); // Exponential weights for better responsiveness
        weightedSum += this.bpmValues[i] * weight;
        weightSum += weight;
      }
      
      const currentBpm = Math.round(weightedSum / weightSum);
      this.prevValidBpm = currentBpm;
      
      return currentBpm;
    }
    
    return this.prevValidBpm > 0 ? this.prevValidBpm : 75;
  }
  
  public calculateConfidence(quality: number): number {
    // Much higher base confidence
    let confidence = (quality / 100) + 0.35;
    
    // Much higher boosts for consistent readings - only need 2 readings
    if (this.bpmValues.length >= 2) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Much higher boosts for consistency
      if (stdDev < 8) {
        confidence += 0.5;
      } else if (stdDev < 15) {
        confidence += 0.4;
      } else if (stdDev < 25) {
        confidence += 0.3;
      }
    }
    
    // Higher confidence just for having values
    if (this.bpmValues.length > 0) {
      confidence += 0.15 * Math.min(1, this.bpmValues.length / 2);
    }
    
    return Math.min(1.0, confidence);
  }
  
  public get currentBPM(): number {
    return this.prevValidBpm || 75;
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
  }
}
