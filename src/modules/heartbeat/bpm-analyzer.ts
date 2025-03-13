export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  
  // Improved physiological parameters for better detection
  private readonly STABILITY_THRESHOLD = 4.5; // More permissive threshold
  private readonly CONFIDENCE_BOOST_THRESHOLD = 3.0; // More permissive stability
  private readonly OUTLIER_SENSITIVITY = 2.5; // Reduced to capture more beats
  private previousValues: number[] = [];
  
  constructor(minBpm = 40, maxBpm = 200, bpmWindowSize = 5) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    // Calculate BPM from RR interval with more permissive validation
    const bpm = 60000 / interval;
    
    // More permissive physiological range validation
    if (bpm >= this.MIN_BPM * 0.95 && bpm <= this.MAX_BPM * 1.05) {
      console.log(`BPM Analyzer: Processing valid beat interval: ${interval}ms (${bpm.toFixed(1)} BPM)`);
      
      // Track raw values for stability assessment with increased history
      this.previousValues.push(bpm);
      if (this.previousValues.length > 10) { // Increased for better stability trending
        this.previousValues.shift();
      }
      
      // Improved outlier handling with more permissive parameters
      if (this.bpmValues.length >= 2 && this.previousValues.length >= 2) {
        // Calculate average of existing values
        const avgBpm = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
        
        // More permissive outlier detection
        if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD * 2.5) {
          console.log(`BPM Analyzer: Handling extreme outlier BPM: ${bpm.toFixed(1)} vs avg ${avgBpm.toFixed(1)}`);
          
          // Instead of rejecting, use a weighted approach for extreme outliers
          const dampedBpm = avgBpm * 0.85 + bpm * 0.15;
          console.log(`BPM Analyzer: Dampened extreme outlier from ${bpm.toFixed(1)} to ${dampedBpm.toFixed(1)}`);
          this.bpmValues.push(dampedBpm);
        }
        // For less extreme outliers, use more aggressive dampening
        else if (Math.abs(bpm - avgBpm) > this.STABILITY_THRESHOLD) {
          // Calculate dampening factor based on deviation magnitude
          const deviation = Math.abs(bpm - avgBpm);
          const dampingFactor = Math.max(0.3, 0.55 - (deviation / 100));
          const dampedBpm = avgBpm + (bpm - avgBpm) * dampingFactor;
          console.log(`BPM Analyzer: Dampened BPM from ${bpm.toFixed(1)} to ${dampedBpm.toFixed(1)} (deviation: ${deviation.toFixed(1)})`);
          this.bpmValues.push(dampedBpm);
        } else {
          // Not an outlier, add to BPM history with slight smoothing
          const smoothedBpm = this.bpmValues.length > 0 ? 
                             this.bpmValues[this.bpmValues.length-1] * 0.4 + bpm * 0.6 : 
                             bpm;
          this.bpmValues.push(smoothedBpm);
          console.log(`BPM Analyzer: Added smoothed BPM: ${smoothedBpm.toFixed(1)}`);
        }
      } else {
        // Not enough history yet, just add to BPM history
        this.bpmValues.push(bpm);
        console.log(`BPM Analyzer: Added initial BPM value: ${bpm.toFixed(1)}`);
      }
      
      // Limit buffer size
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Improved BPM calculation with weighted recency approach
      let weightedSum = 0;
      let weightSum = 0;
      
      // Apply exponential weights with preference for recent values
      for (let i = 0; i < this.bpmValues.length; i++) {
        // Exponential weight for recency
        const recencyWeight = Math.pow(1.5, i);
        
        weightedSum += this.bpmValues[i] * recencyWeight;
        weightSum += recencyWeight;
      }
      
      const currentBpm = Math.round(weightedSum / weightSum);
      this.prevValidBpm = currentBpm;
      
      console.log(`BPM Analyzer: Calculated final BPM: ${currentBpm}`);
      return currentBpm;
    } else {
      // Log rejected intervals that are outside physiological range
      console.log(`BPM Analyzer: Rejected interval ${interval}ms (BPM: ${bpm.toFixed(1)}) - outside range ${this.MIN_BPM}-${this.MAX_BPM}`);
    }
    
    // Return previous valid BPM if we have one with more aggressive fallback
    if (this.prevValidBpm > 0) {
      console.log(`BPM Analyzer: Using previous valid BPM: ${this.prevValidBpm}`);
      return this.prevValidBpm;
    }
    
    // Use sensible default if nothing else is available
    console.log(`BPM Analyzer: No valid BPM yet, returning null`);
    return null;
  }
  
  public calculateConfidence(quality: number): number {
    // Improved confidence calculation
    let confidence = (quality / 100) * 0.6; // Higher base confidence from signal quality
    
    // More aggressive confidence boost with consistent readings
    if (this.bpmValues.length >= 3) {
      const avg = this.bpmValues.reduce((sum, val) => sum + val, 0) / this.bpmValues.length;
      
      // Calculate standard deviation
      const variance = this.bpmValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.bpmValues.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`BPM Analyzer: Confidence calc - StdDev: ${stdDev.toFixed(2)}, Values: ${this.bpmValues.length}, Quality: ${quality}`);
      
      // More aggressive confidence boosts based on stability
      if (stdDev < this.CONFIDENCE_BOOST_THRESHOLD) {
        confidence += 0.30; // Stronger boost for very stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD) {
        confidence += 0.20; // Moderate boost for stable readings
      } else if (stdDev < this.STABILITY_THRESHOLD * 1.5) {
        confidence += 0.15; // Small boost for somewhat stable readings
      }
      
      // Additional boost based on number of consistent readings
      confidence += 0.05 * Math.min(1, this.bpmValues.length / this.BPM_WINDOW_SIZE);
    }
    
    // Provide minimum confidence level to keep things moving
    const finalConfidence = Math.min(1.0, Math.max(0.3, confidence));
    console.log(`BPM Analyzer: Final confidence: ${finalConfidence.toFixed(2)}`);
    return finalConfidence;
  }
  
  public get currentBPM(): number | null {
    return this.prevValidBpm > 0 ? this.prevValidBpm : null;
  }
  
  public reset(): void {
    console.log(`BPM Analyzer: Reset - clearing ${this.bpmValues.length} BPM values`);
    this.bpmValues = [];
    this.prevValidBpm = 0;
    this.previousValues = [];
  }
}
