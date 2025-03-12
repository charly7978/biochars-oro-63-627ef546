
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  // Enhanced stability tracking
  private readonly STABILITY_THRESHOLD = 10; // BPM variation threshold
  private readonly CONFIDENCE_BOOST_THRESHOLD = 5; // BPM stability threshold for confidence boost
  private previousValues: number[] = [];
  
  constructor(minBpm = 45, maxBpm = 180, bpmWindowSize = 8) { // Increased window size
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // More strict physiological range validation
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Track raw values for stability assessment
      this.previousValues.push(bpm);
      if (this.previousValues.length > 10) {
        this.previousValues.shift();
      }
      
      // Outlier rejection - if we have enough history
      if (this.bpmValues.length >= 3 && this.previousValues.length >= 5) {
        // Calculate average of existing values
        const avgBpm = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
        
        // Reject extreme outliers (more conservative)
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD * 2) {
          // Use previous valid BPM
          return this.prevValidBpm > 0 ? this.prevValidBpm : null;
        }
        
        // For less extreme outliers, dampen the impact
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD) {
          // Dampen the outlier by moving it closer to the average
          const dampingFactor = 0.6;
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
      
      // Calculate average BPM with more weight on recent values and outlier rejection
      let weightedSum = 0;
      let weightSum = 0;
      
      // Sort values for median calculation
      const sortedValues = [...this.bpmValues].sort((a, b) => a - b);
      const medianBpm = sortedValues[Math.floor(sortedValues.length / 2)];
      
      // Apply weights with preference for values close to the median
      for (let i = 0; i < this.bpmValues.length; i++) {
        // Base weight increases for more recent values
        const recencyWeight = i + 1;
        
        // Additional weight if close to median (more trustworthy)
        const medianCloseness = Math.max(0, 1 - Math.abs(this.bpmValues[i] - medianBpm) / 15);
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
    // Adjust confidence based on signal quality
    let confidence = (quality / 100) * 0.55; // Base confidence from signal quality
    
    // Boost confidence with consistent readings
    if (this.bpmValues.length >= 4) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Boost confidence based on stability
      if (stdDev < this.CONFIDENCE_BOOST_THRESHOLD) {
        confidence += 0.35; // Significant boost for very stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD) {
        confidence += 0.25; // Moderate boost for stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD * 1.5) {
        confidence += 0.15; // Small boost for somewhat stable readings
      }
      
      // Additional boost based on number of consistent readings
      confidence += 0.05 * Math.min(1, this.bpmValues.length / 6);
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
