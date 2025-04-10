
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Pattern detector for arrhythmia detection - enhanced for natural rhythm detection
 */
export class ArrhythmiaPatternDetector {
  private patternBuffer: number[] = [];
  private anomalyScores: number[] = [];
  private peakTimestamps: number[] = [];
  
  private readonly PATTERN_BUFFER_SIZE = 20; // Increased for better pattern analysis
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 5;
  private readonly PATTERN_MATCH_THRESHOLD = 0.75;
  private readonly SIGNAL_DECLINE_THRESHOLD = 0.3;

  // Tracking time-based pattern consistency
  private lastUpdateTime: number = 0;
  private timeGapTooLarge: boolean = false;
  private readonly MAX_TIME_GAP_MS = 200;
  
  // Heart rhythm tracking for natural detection
  private heartRateIntervals: number[] = [];
  private readonly MAX_INTERVALS = 10;
  private lastHeartbeatTime: number = 0;

  /**
   * Update pattern buffer with real data
   */
  public updatePatternBuffer(value: number): void {
    const currentTime = Date.now();
    
    // Check for time gaps that would indicate finger removal
    if (this.lastUpdateTime > 0) {
      const timeDiff = currentTime - this.lastUpdateTime;
      this.timeGapTooLarge = timeDiff > this.MAX_TIME_GAP_MS;
      
      if (this.timeGapTooLarge) {
        console.log(`Large time gap detected: ${timeDiff}ms - likely indicates finger removal`);
      }
    }
    this.lastUpdateTime = currentTime;
    
    // Detect sudden drops in signal that indicate finger removal
    const suddenDrop = this.patternBuffer.length > 0 && 
                      this.patternBuffer[this.patternBuffer.length - 1] > this.SIGNAL_DECLINE_THRESHOLD &&
                      value < this.SIGNAL_DECLINE_THRESHOLD * 0.3;
    
    if (suddenDrop) {
      console.log(`Sudden signal drop detected: ${this.patternBuffer[this.patternBuffer.length - 1]} -> ${value}`);
      // Reset buffer on sudden drops to prevent false patterns
      this.resetPatternBuffer();
      return;
    }
    
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.4 ? 1 : 0;
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
    
    // Track peaks for natural rhythm detection
    if (this.patternBuffer.length >= 3) {
      const mid = this.patternBuffer.length - 2;
      const isPeak = this.patternBuffer[mid] > this.patternBuffer[mid-1] && 
                    this.patternBuffer[mid] > this.patternBuffer[mid+1] &&
                    this.patternBuffer[mid] > 0.15;
      
      if (isPeak) {
        // Found a potential heartbeat
        if (this.lastHeartbeatTime > 0) {
          const interval = currentTime - this.lastHeartbeatTime;
          
          // Only track physiologically plausible intervals (30-200 BPM)
          if (interval >= 300 && interval <= 2000) {
            this.heartRateIntervals.push(interval);
            if (this.heartRateIntervals.length > this.MAX_INTERVALS) {
              this.heartRateIntervals.shift();
            }
          }
        }
        
        this.lastHeartbeatTime = currentTime;
        this.peakTimestamps.push(currentTime);
        if (this.peakTimestamps.length > 10) {
          this.peakTimestamps.shift();
        }
      }
    }
  }
  
  /**
   * Reset pattern buffer
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
    this.timeGapTooLarge = false;
    this.lastUpdateTime = 0;
    this.heartRateIntervals = [];
    this.lastHeartbeatTime = 0;
    this.peakTimestamps = [];
  }
  
  /**
   * Detect arrhythmia patterns in real data with natural rhythm analysis
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH || this.timeGapTooLarge) {
      return false;
    }
    
    // Check if there's enough variation in the signal to be a real finger
    const minVal = Math.min(...this.patternBuffer);
    const maxVal = Math.max(...this.patternBuffer);
    const signalRange = maxVal - minVal;
    
    // If the signal range is too small, it's likely not a real finger
    if (signalRange < 0.05) {
      return false;
    }
    
    // Analyze rhythm consistency for natural heartbeat detection
    if (this.heartRateIntervals.length >= 3) {
      const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / this.heartRateIntervals.length;
      
      // Calculate rhythm consistency (natural heartbeats have consistent timing)
      let consistentIntervals = 0;
      for (let i = 0; i < this.heartRateIntervals.length; i++) {
        const deviation = Math.abs(this.heartRateIntervals[i] - avgInterval) / avgInterval;
        if (deviation < 0.25) { // Allow 25% deviation for natural variation
          consistentIntervals++;
        }
      }
      
      const consistencyRatio = consistentIntervals / this.heartRateIntervals.length;
      
      // If we have highly consistent intervals that match physiological heart rate
      if (consistencyRatio > 0.6 && avgInterval >= 400 && avgInterval <= 1500) {
        const estimatedBPM = Math.round(60000 / avgInterval);
        console.log(`Natural heart rhythm detected: ${estimatedBPM} BPM with ${Math.round(consistencyRatio*100)}% consistency`);
      }
    }
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.4).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Feature 3: Check for oscillation pattern (up-down-up) which is characteristic of heartbeats
    let oscillationCount = 0;
    for (let i = 1; i < recentPattern.length - 1; i++) {
      if ((recentPattern[i] > recentPattern[i-1] && recentPattern[i] > recentPattern[i+1]) ||
          (recentPattern[i] < recentPattern[i-1] && recentPattern[i] < recentPattern[i+1])) {
        oscillationCount++;
      }
    }
    const oscillationRatio = oscillationCount / (recentPattern.length - 2);
    
    // Feature 4: Peak timing consistency (natural heart beats have consistent timing)
    let timingScore = 0;
    if (this.peakTimestamps.length >= 3) {
      const intervals = [];
      for (let i = 1; i < this.peakTimestamps.length; i++) {
        intervals.push(this.peakTimestamps[i] - this.peakTimestamps[i-1]);
      }
      
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const intervalVariations = intervals.map(i => Math.abs(i - avgInterval) / avgInterval);
      const avgVariation = intervalVariations.reduce((sum, val) => sum + val, 0) / intervalVariations.length;
      
      // Convert to a 0-1 score (lower variation = higher score)
      timingScore = Math.max(0, 1 - (avgVariation * 2));
    }
    
    // Combine features with weighted scoring
    const patternScore = (variationRatio * 0.3) + (anomalyRatio * 0.15) + 
                        (oscillationRatio * 0.25) + (timingScore * 0.3);
    
    return patternScore > this.PATTERN_MATCH_THRESHOLD;
  }

  /**
   * Get the current pattern buffer
   */
  public getPatternBuffer(): number[] {
    return [...this.patternBuffer];
  }

  /**
   * Get the current anomaly scores
   */
  public getAnomalyScores(): number[] {
    return [...this.anomalyScores];
  }
  
  /**
   * Get if time gap is too large (indicator of finger removal)
   */
  public isTimeGapTooLarge(): boolean {
    return this.timeGapTooLarge;
  }
  
  /**
   * Get estimated heart rate from natural rhythm detection
   */
  public getEstimatedHeartRate(): number {
    if (this.heartRateIntervals.length < 3) return 0;
    
    // Calculate average interval
    const avgInterval = this.heartRateIntervals.reduce((sum, val) => sum + val, 0) / 
                        this.heartRateIntervals.length;
    
    // Convert to BPM
    return Math.round(60000 / avgInterval);
  }
}
