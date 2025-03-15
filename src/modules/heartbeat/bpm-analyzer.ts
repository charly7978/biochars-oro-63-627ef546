
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  constructor(minBpm = 45, maxBpm = 180, bpmWindowSize = 5) {  // More restrictive BPM range and longer window
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // More restrictive physiological range
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // More balanced weighting of recent values
      let weightedSum = 0;
      let weightSum = 0;
      
      // Apply weights: moderate weight on recent values
      for (let i = 0; i < this.bpmValues.length; i++) {
        const weight = Math.pow(1.5, i); // More balanced weights for stability
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
    // Moderate base confidence
    let confidence = (quality / 100) * 0.5;
    
    // Moderate boosts for consistent readings - require more readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // More moderate boosts for consistency
      if (stdDev < 5) {
        confidence += 0.3;
      } else if (stdDev < 10) {
        confidence += 0.2;
      } else if (stdDev < 20) {
        confidence += 0.1;
      }
    }
    
    // Lower confidence boost just for having values
    if (this.bpmValues.length > 0) {
      confidence += 0.05 * Math.min(1, this.bpmValues.length / 3);
    }
    
    return Math.min(0.95, confidence);
  }
  
  public get currentBPM(): number {
    return this.prevValidBpm || 75;
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
  }
}
