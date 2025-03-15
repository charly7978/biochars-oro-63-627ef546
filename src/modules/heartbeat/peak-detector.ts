
export class PeakDetector {
  // Thresholds and detection parameters
  private readonly MIN_PEAK_THRESHOLD_FACTOR: number;
  private readonly STRONG_PEAK_THRESHOLD_FACTOR: number;
  private readonly PEAK_WINDOW_SIZE: number;
  private readonly MIN_TIME_BETWEEN_BEATS: number;
  private readonly MAX_TIME_BETWEEN_BEATS: number;
  
  // State
  private baselineThreshold: number = 1.0;
  private beatConfidence: number = 0.0;
  private lastBeatTime: number = 0;
  private shouldReduceTimeBetweenBeats: boolean = false;
  private adaptivePeakWindow: number;
  private signalStability: number = 0.5;
  private recentAmplitudes: number[] = [];
  private peakHistory: number[] = [];
  private beatIntervalHistory: number[] = [];
  
  // Enhanced stability tracking
  private consecutiveDetectionsCount: number = 0;
  private readonly MIN_CONSECUTIVE_FOR_CONFIDENCE: number = 2;
  private readonly MAX_CONSECUTIVE_BOOST: number = 6;
  
  constructor(
    peakWindow: number = 3,
    minPeakThreshold: number = 0.15,  // Higher minimum threshold
    strongPeakThreshold: number = 0.30, // Higher strong peak threshold
    dynamicThreshold: number = 0.7,
    minTimeBetweenBeats: number = 300, // Increased minimum time between beats
    maxTimeBetweenBeats: number = 1500
  ) {
    this.PEAK_WINDOW_SIZE = peakWindow;
    this.adaptivePeakWindow = peakWindow;
    this.MIN_PEAK_THRESHOLD_FACTOR = minPeakThreshold;
    this.STRONG_PEAK_THRESHOLD_FACTOR = strongPeakThreshold;
    this.MIN_TIME_BETWEEN_BEATS = minTimeBetweenBeats;
    this.MAX_TIME_BETWEEN_BEATS = maxTimeBetweenBeats;
    
    // Initialize amplitude buffer
    for (let i = 0; i < 10; i++) {
      this.recentAmplitudes.push(1.0);
    }
  }
  
  public detectBeat(
    now: number,
    value: number,
    quality: number,
    signalBuffer: number[],
    derivative: number,
    lastBeat: number
  ): boolean {
    // Skip if too soon after last beat - stricter timing check
    const timeSinceLastBeat = now - this.lastBeatTime;
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.9 : this.MIN_TIME_BETWEEN_BEATS;

    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }

    // Need enough samples for detection
    if (signalBuffer.length < this.adaptivePeakWindow + 2) {
      return false;
    }

    // Quality-based early rejection - avoid processing low quality signals
    if (quality < 40) {
      this.consecutiveDetectionsCount = 0;
      this.beatConfidence = 0;
      return false;
    }

    // Adjust peak window based on signal stability
    this.adaptivePeakWindow = Math.max(2, Math.min(5, Math.round(this.PEAK_WINDOW_SIZE * (1.1 - this.signalStability))));

    // Check for peak with adaptive window size
    const isPeak = this.isPeakValue(value, signalBuffer);
    
    // Enhanced validation for peaks
    if (isPeak) {
      // Calculate peak strength more robustly
      const peakStrength = Math.abs(value);
      this.peakHistory.push(peakStrength);
      if (this.peakHistory.length > 8) {
        this.peakHistory.shift();
      }
      
      this.recentAmplitudes.push(peakStrength);
      if (this.recentAmplitudes.length > 10) {
        this.recentAmplitudes.shift();
      }
      
      // Quality-adjusted threshold - stricter requirements
      const qualityFactor = Math.max(0.4, quality / 100);
      const avgAmplitude = this.recentAmplitudes.reduce((sum, val) => sum + val, 0) / this.recentAmplitudes.length;
      
      // Adaptive threshold based on both global threshold and recent peak history
      const avgPeakStrength = this.peakHistory.length > 0 ? 
        this.peakHistory.reduce((sum, val) => sum + val, 0) / this.peakHistory.length : 0;
      
      // More conservative threshold
      const adaptiveThreshold = this.baselineThreshold * this.MIN_PEAK_THRESHOLD_FACTOR;
      
      // Consider peak intensity relative to recent history
      const relativePeakStrength = avgPeakStrength > 0 ? peakStrength / avgPeakStrength : 1;
      
      // Apply threshold more conservatively
      const effectiveThreshold = relativePeakStrength < 0.7 ? 
        adaptiveThreshold * 1.2 : adaptiveThreshold;

      // Check if peak surpasses threshold and calculate confidence
      if (peakStrength > effectiveThreshold) {
        // More robust beat interval validation
        if (this.beatIntervalHistory.length > 2) {
          // Calculate average interval
          const avgInterval = this.beatIntervalHistory.reduce((sum, val) => sum + val, 0) / 
                             this.beatIntervalHistory.length;
          
          // Stricter rhythm check
          if (Math.abs(timeSinceLastBeat - avgInterval) > avgInterval * 0.6 && timeSinceLastBeat < avgInterval * 0.5) {
            // Likely a false positive, reject it
            return false;
          }
        }
        
        // More conservative confidence calculation
        this.beatConfidence = Math.min(0.90, 
          (peakStrength / (adaptiveThreshold * 1.2)) * qualityFactor * (this.signalStability + 0.5)
        );
        
        // Increase confidence with consecutive detections
        this.consecutiveDetectionsCount++;
        if (this.consecutiveDetectionsCount > this.MIN_CONSECUTIVE_FOR_CONFIDENCE) {
          const confBoost = Math.min(
            0.3, 
            0.1 * (this.consecutiveDetectionsCount - this.MIN_CONSECUTIVE_FOR_CONFIDENCE) / this.MAX_CONSECUTIVE_BOOST
          );
          this.beatConfidence = Math.min(0.95, this.beatConfidence + confBoost);
        }
        
        // Record interval for rhythm analysis
        if (this.lastBeatTime > 0) {
          this.beatIntervalHistory.push(timeSinceLastBeat);
          if (this.beatIntervalHistory.length > 5) {
            this.beatIntervalHistory.shift();
          }
        }
        
        this.lastBeatTime = now;
        
        // Update timing parameters
        if (timeSinceLastBeat < 500) {
          this.shouldReduceTimeBetweenBeats = true;
        } else if (timeSinceLastBeat > 1000) {
          this.shouldReduceTimeBetweenBeats = false;
        }
        
        return true;
      }
    } else {
      // Reset consecutive detections counter when not a peak
      this.consecutiveDetectionsCount = Math.max(0, this.consecutiveDetectionsCount - 1);
    }

    // More conservative derivative-based detection - only use in specific cases
    if (!isPeak && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS * 0.8) {
      // Only accept derivative-based detection with higher quality
      if (derivative > 0.3 && quality > 60) {
        this.beatConfidence = 0.4;
        this.lastBeatTime = now;
        return true;
      }
      
      // Very conservative for long gaps
      if (derivative > 0.25 && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS && quality > 70) {
        this.beatConfidence = 0.3;
        this.lastBeatTime = now;
        return true;
      }
    }

    return false;
  }
  
  private isPeakValue(value: number, buffer: number[]): boolean {
    const windowSize = this.adaptivePeakWindow;
    const midPoint = Math.floor(buffer.length / 2);
    
    // Higher minimum value requirement
    if (Math.abs(value) < 0.15) return false;
    
    // Check if current value is local maximum with stricter criteria
    let peakConfirmed = true;
    
    // Check values before current value
    for (let i = 1; i <= windowSize; i++) {
      if (midPoint - i >= 0 && buffer[midPoint - i] >= value - 0.02) {
        peakConfirmed = false;
        break;
      }
    }
    
    if (peakConfirmed) {
      // Check values after current value
      for (let i = 1; i <= windowSize; i++) {
        if (midPoint + i < buffer.length && buffer[midPoint + i] > value - 0.02) {
          peakConfirmed = false;
          break;
        }
      }
    }
    
    return peakConfirmed;
  }
  
  public updateAdaptiveThreshold(buffer: number[], now: number, debug: boolean = false): void {
    if (buffer.length < 25) return; // More samples required for stable threshold
    
    const recentValues = buffer.slice(-40); // More history for stability
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Update signal stability metric
    const sorted = [...recentValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    // More conservative stability metric (0-1 where 1 is most stable)
    this.signalStability = Math.min(1, Math.max(0, 1 - (iqr / (amplitude || 1))));
    
    // More gradual threshold adjustment
    const adaptationRate = 0.2 + (0.2 * this.signalStability);
    this.baselineThreshold = Math.max(
      0.5,  // Higher minimum threshold to reduce false positives
      this.baselineThreshold * (1 - adaptationRate) + amplitude * adaptationRate
    );
    
    if (debug) {
      console.log(`Peak detector: threshold=${this.baselineThreshold.toFixed(2)}, stability=${this.signalStability.toFixed(2)}, window=${this.adaptivePeakWindow}`);
    }
  }
  
  public setTimingParameters(interval: number): void {
    if (interval < 600) { // Stricter threshold
      this.shouldReduceTimeBetweenBeats = true;
    } else if (interval > 1000) {
      this.shouldReduceTimeBetweenBeats = false;
    }
  }
  
  public get confidence(): number {
    return this.beatConfidence;
  }
  
  public get stability(): number {
    return this.signalStability;
  }
  
  public reset(): void {
    this.lastBeatTime = 0;
    this.beatConfidence = 0;
    this.baselineThreshold = 1.0;
    this.shouldReduceTimeBetweenBeats = false;
    this.adaptivePeakWindow = this.PEAK_WINDOW_SIZE;
    this.signalStability = 0.5;
    this.recentAmplitudes = Array(10).fill(1.0);
    this.peakHistory = [];
    this.beatIntervalHistory = [];
    this.consecutiveDetectionsCount = 0;
  }
}
