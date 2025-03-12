
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  // Balanced stability tracking
  private readonly STABILITY_THRESHOLD = 7; // Balanced BPM variation threshold
  private readonly CONFIDENCE_BOOST_THRESHOLD = 4; // Balanced stability threshold
  private previousValues: number[] = [];
  
  constructor(minBpm = 45, maxBpm = 180, bpmWindowSize = 5) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // Standard physiological range validation
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Track raw values for stability assessment
      this.previousValues.push(bpm);
      if (this.previousValues.length > 10) {
        this.previousValues.shift();
      }
      
      // Outlier rejection with balanced sensitivity
      if (this.bpmValues.length >= 3 && this.previousValues.length >= 4) {
        // Calculate average of existing values
        const avgBpm = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
        
        // Reject extreme outliers
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD * 1.8) {
          return this.prevValidBpm > 0 ? this.prevValidBpm : null;
        }
        
        // For less extreme outliers, dampen the impact
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD) {
          // Moderate dampening factor
          const dampingFactor = 0.4;
          const dampedBpm = avgBpm + (bpm - avgBpm) * dampingFactor;
          this.bpmValues.push(dampedBpm);
        } else {
          // Not an outlier, add to BPM history
          this.bpmValues.push(bpm);
        }
      } else {
        // Not enough history yet, just add to BPM history
        this.bpmValues.push(bpm);
      }
      
      // Limit buffer size
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Calculate average BPM with balanced weighting
      let weightedSum = 0;
      let weightSum = 0;
      
      // Sort values for median calculation
      const sortedValues = [...this.bpmValues].sort((a, b) => a - b);
      const medianBpm = sortedValues[Math.floor(sortedValues.length / 2)];
      
      // Apply weights with moderate preference for median-like values
      for (let i = 0; i < this.bpmValues.length; i++) {
        // Base weight increases for more recent values
        const recencyWeight = i + 1;
        
        // Additional weight if close to median
        const medianCloseness = Math.max(0, 1 - Math.abs(this.bpmValues[i] - medianBpm) / 10);
        const weight = recencyWeight * (1 + medianCloseness * 0.5);
        
        weightedSum += this.bpmValues[i] * weight;
        weightSum += weight;
      }
      
      const currentBpm = Math.round(weightedSum / weightSum);
      this.prevValidBpm = currentBpm;
      
      return currentBpm;
    }
    
    // Return previous valid BPM if we have one
    return this.prevValidBpm > 0 ? this.prevValidBpm : null;
  }
  
  public calculateConfidence(quality: number): number {
    // Balanced confidence calculation
    let confidence = (quality / 100) * 0.5; // Base confidence from signal quality
    
    // Moderate confidence boost with consistent readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Balanced confidence boosts based on stability
      if (stdDev < this.CONFIDENCE_BOOST_THRESHOLD) {
        confidence += 0.25; // Moderate boost for very stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD) {
        confidence += 0.15; // Small boost for stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD * 1.5) {
        confidence += 0.1; // Minimal boost for somewhat stable readings
      }
      
      // Additional boost based on number of consistent readings
      confidence += 0.05 * Math.min(1, this.bpmValues.length / 5);
    }
    
    return Math.min(1.0, confidence);
  }
  
  public get currentBPM(): number | null {
    return this.prevValidBpm > 0 ? this.prevValidBpm : null;
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
    this.previousValues = [];
  }
}
