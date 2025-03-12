
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
    
    // Physiological range validation
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
    
    // Return previous valid BPM if we have one, helps maintain stability
    return this.prevValidBpm > 0 ? this.prevValidBpm : null;
  }
  
  public calculateConfidence(quality: number): number {
    // Adjust confidence based on signal quality
    let confidence = (quality / 100) * 0.65; // Increased base confidence
    
    // Boost confidence with consistent readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // More generous boosts for fingertip readings
      if (stdDev < 3) {
        confidence += 0.3; 
      } else if (stdDev < 5) {
        confidence += 0.25;
      } else if (stdDev < 10) {
        confidence += 0.2;
      }
    }
    
    // Boost confidence for consistent measurements
    if (this.bpmValues.length > 0) {
      confidence += 0.1 * Math.min(1, this.bpmValues.length / 3); // Increased boost
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
