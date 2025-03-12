
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  // Optimized physiological parameters
  private readonly STABILITY_THRESHOLD = 4; // Tighter threshold for BPM variation
  private readonly CONFIDENCE_BOOST_THRESHOLD = 3; // More sensitive stability threshold
  private previousValues: number[] = [];
  
  constructor(minBpm = 40, maxBpm = 180, bpmWindowSize = 6) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // Strict physiological range validation
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Track raw values for stability assessment
      this.previousValues.push(bpm);
      if (this.previousValues.length > 10) {
        this.previousValues.shift();
      }
      
      // Enhanced outlier rejection with physiological basis
      if (this.bpmValues.length >= 3 && this.previousValues.length >= 4) {
        // Calculate average of existing values
        const avgBpm = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
        
        // Reject extreme outliers using physiological limits
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD * 2.5) {
          console.log(`BPM Analyzer: Rejected extreme outlier BPM: ${bpm} vs avg ${avgBpm}`);
          return this.prevValidBpm > 0 ? this.prevValidBpm : null;
        }
        
        // For less extreme outliers, use adaptive dampening
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD) {
          // Calculate dampening factor based on deviation magnitude
          const deviation = Math.abs(bpm - avgBpm);
          const dampingFactor = Math.max(0.15, 0.5 - (deviation / 120));
          const dampedBpm = avgBpm + (bpm - avgBpm) * dampingFactor;
          console.log(`BPM Analyzer: Dampened BPM from ${bpm} to ${dampedBpm} (deviation: ${deviation})`);
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
      
      // Physiologically optimized BPM calculation with weighted median approach
      let weightedSum = 0;
      let weightSum = 0;
      
      // Sort values for median calculation
      const sortedValues = [...this.bpmValues].sort((a, b) => a - b);
      const medianBpm = sortedValues[Math.floor(sortedValues.length / 2)];
      
      // Apply weights with stronger preference for median-like values
      for (let i = 0; i < this.bpmValues.length; i++) {
        // Base weight increases for more recent values
        const recencyWeight = i + 1;
        
        // Additional weight if close to median (physiologically more likely to be accurate)
        const medianCloseness = Math.max(0, 1 - Math.abs(this.bpmValues[i] - medianBpm) / 10);
        const weight = recencyWeight * (1 + medianCloseness);
        
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
    // Enhanced physiologically-based confidence calculation
    let confidence = (quality / 100) * 0.5; // Base confidence from signal quality
    
    // Advanced confidence boost with consistent readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Physiologically-relevant confidence boosts based on stability
      if (stdDev < this.CONFIDENCE_BOOST_THRESHOLD) {
        confidence += 0.3; // Strong boost for very stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD) {
        confidence += 0.2; // Moderate boost for stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD * 1.5) {
        confidence += 0.1; // Small boost for somewhat stable readings
      }
      
      // Additional boost based on number of consistent readings
      confidence += 0.05 * Math.min(1, this.bpmValues.length / this.BPM_WINDOW_SIZE);
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
