/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Pattern detector for arrhythmia detection - enhanced for natural rhythm detection
 */
export class ArrhythmiaPatternDetector {
  private readonly BUFFER_SIZE = 100;
  private patternBuffer: Float32Array = new Float32Array(this.BUFFER_SIZE);
  private bufferHead: number = 0;
  private bufferCount: number = 0;
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
  public addPatternValue(value: number): void {
    this.patternBuffer[this.bufferHead] = value;
    this.bufferHead = (this.bufferHead + 1) % this.BUFFER_SIZE;
    if (this.bufferCount < this.BUFFER_SIZE) this.bufferCount++;
  }
  
  /**
   * Reset pattern buffer
   */
  public reset(): void {
    this.patternBuffer.fill(0);
    this.bufferHead = 0;
    this.bufferCount = 0;
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
    if (this.bufferCount < this.MIN_ANOMALY_PATTERN_LENGTH || this.timeGapTooLarge) {
      return false;
    }
    
    // Check if there's enough variation in the signal to be a real finger
    const minVal = Math.min(...this.getPatternBuffer());
    const maxVal = Math.max(...this.getPatternBuffer());
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
    const recentPattern = this.getPatternBuffer().slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
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
    const out = [];
    for (let i = 0; i < this.bufferCount; i++) {
      const idx = (this.bufferHead - this.bufferCount + i + this.BUFFER_SIZE) % this.BUFFER_SIZE;
      out.push(this.patternBuffer[idx]);
    }
    return out;
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
