
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
    
    // Only accept physiologically plausible values
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Calculate average BPM
      const sum = this.bpmValues.reduce((a, b) => a + b, 0);
      const currentBpm = Math.round(sum / this.bpmValues.length);
      this.prevValidBpm = currentBpm;
      
      return currentBpm;
    }
    
    return null;
  }
  
  public calculateConfidence(quality: number): number {
    // Start with quality-based confidence
    let confidence = quality / 100;
    
    // Boost confidence if we have consistent BPM readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Low standard deviation means consistent readings (higher confidence)
      if (stdDev < 5) {
        confidence += 0.3;
      } else if (stdDev < 10) {
        confidence += 0.2;
      } else if (stdDev < 15) {
        confidence += 0.1;
      }
    }
    
    return confidence;
  }
  
  public get currentBPM(): number {
    return this.prevValidBpm || 75; // Default to 75 BPM if no history
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
  }
}
