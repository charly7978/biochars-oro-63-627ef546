
export class BPMAnalyzer {
  private readonly MIN_BPM: number;
  private readonly MAX_BPM: number;
  private readonly BPM_WINDOW_SIZE: number;
  
  private bpmValues: number[] = [];
  private prevValidBpm = 0;
  private lastBpmUpdateTime = 0;
  private bpmUpdateThrottle = 500; // ms
  
  constructor(minBpm = 40, maxBpm = 180, bpmWindowSize = 5) {
    this.MIN_BPM = minBpm;
    this.MAX_BPM = maxBpm;
    this.BPM_WINDOW_SIZE = bpmWindowSize;
  }
  
  public addBeatInterval(interval: number): number | null {
    const now = Date.now();
    
    // Calculate BPM from RR interval
    const bpm = 60000 / interval;
    
    // Only accept physiologically plausible values
    if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
      // Add to BPM history
      this.bpmValues.push(bpm);
      if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
        this.bpmValues.shift();
      }
      
      // Calculate average BPM with outlier filtering
      if (this.bpmValues.length >= 3) {
        // Sort values to find median
        const sortedValues = [...this.bpmValues].sort((a, b) => a - b);
        const median = sortedValues[Math.floor(sortedValues.length / 2)];
        
        // Filter out values that are too far from median (possible artifacts)
        const filteredValues = this.bpmValues.filter(val => 
          Math.abs(val - median) < Math.max(10, median * 0.15)
        );
        
        if (filteredValues.length > 0) {
          const sum = filteredValues.reduce((a, b) => a + b, 0);
          const currentBpm = Math.round(sum / filteredValues.length);
          
          // Only update if significant time has passed or significant change
          if (now - this.lastBpmUpdateTime > this.bpmUpdateThrottle || 
              Math.abs(currentBpm - this.prevValidBpm) > 5) {
            this.prevValidBpm = currentBpm;
            this.lastBpmUpdateTime = now;
            console.log(`BPM updated to ${currentBpm} from ${filteredValues.length} readings`);
          }
          
          return this.prevValidBpm;
        }
      } else if (this.bpmValues.length > 0) {
        // Simple average if we don't have enough data for outlier filtering
        const sum = this.bpmValues.reduce((a, b) => a + b, 0);
        const currentBpm = Math.round(sum / this.bpmValues.length);
        this.prevValidBpm = currentBpm;
        return currentBpm;
      }
      
      return this.prevValidBpm;
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
    
    return Math.min(1.0, confidence); // Cap at 1.0
  }
  
  public get currentBPM(): number {
    return this.prevValidBpm || 75; // Default to 75 BPM if no history
  }
  
  public reset(): void {
    this.bpmValues = [];
    this.prevValidBpm = 0;
    this.lastBpmUpdateTime = 0;
  }
}
