
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
  
  // Stability tracking with balanced values
  private consecutiveDetectionsCount: number = 0;
  private readonly MIN_CONSECUTIVE_FOR_CONFIDENCE: number = 2;
  private readonly MAX_CONSECUTIVE_BOOST: number = 4;
  
  constructor(
    peakWindow: number = 3,
    minPeakThreshold: number = 0.3,     // Balanced threshold
    strongPeakThreshold: number = 0.45,  // Balanced threshold
    dynamicThreshold: number = 0.7,
    minTimeBetweenBeats: number = 350,   // Balanced
    maxTimeBetweenBeats: number = 1400
  ) {
    this.PEAK_WINDOW_SIZE = peakWindow;
    this.adaptivePeakWindow = peakWindow;
    this.MIN_PEAK_THRESHOLD_FACTOR = minPeakThreshold;
    this.STRONG_PEAK_THRESHOLD_FACTOR = strongPeakThreshold;
    this.MIN_TIME_BETWEEN_BEATS = minTimeBetweenBeats;
    this.MAX_TIME_BETWEEN_BEATS = maxTimeBetweenBeats;
    
    // Initialize amplitude buffer
    for (let i = 0; i < 8; i++) {
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
    // Skip if too soon after last beat
    const timeSinceLastBeat = now - this.lastBeatTime;
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.92 : this.MIN_TIME_BETWEEN_BEATS;

    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }

    // Need enough samples for detection
    if (signalBuffer.length < this.adaptivePeakWindow + 2) {
      return false;
    }

    // Balanced quality threshold
    if (quality < 45) {
      this.consecutiveDetectionsCount = Math.max(0, this.consecutiveDetectionsCount - 1);
      return false;
    }

    // Adjust peak window based on signal stability - balanced approach
    this.adaptivePeakWindow = Math.max(2, Math.min(4, Math.round(this.PEAK_WINDOW_SIZE * (1.0 - this.signalStability * 0.3))));

    // Check for peak with adaptive window size
    const isPeak = this.isPeakValue(value, signalBuffer);
    
    // Standard validation for peaks
    if (isPeak) {
      // Calculate peak strength
      const peakStrength = Math.abs(value);
      this.peakHistory.push(peakStrength);
      if (this.peakHistory.length > 7) {
        this.peakHistory.shift();
      }
      
      this.recentAmplitudes.push(peakStrength);
      if (this.recentAmplitudes.length > 8) {
        this.recentAmplitudes.shift();
      }
      
      // Balanced quality-adjusted threshold
      const qualityFactor = Math.max(0.65, quality / 100);
      const avgAmplitude = this.recentAmplitudes.reduce((sum, val) => sum + val, 0) / this.recentAmplitudes.length;
      
      // Calculate adaptive threshold
      const avgPeakStrength = this.peakHistory.length > 0 ? 
        this.peakHistory.reduce((sum, val) => sum + val, 0) / this.peakHistory.length : 0;
      
      // Balanced threshold
      const adaptiveThreshold = this.baselineThreshold * this.MIN_PEAK_THRESHOLD_FACTOR * 1.05;
      
      // Consider relative peak strength
      const relativePeakStrength = avgPeakStrength > 0 ? peakStrength / avgPeakStrength : 1;
      
      // Apply threshold with balanced criteria
      const effectiveThreshold = relativePeakStrength < 0.7 ? 
        adaptiveThreshold * 1.15 : adaptiveThreshold;

      // Check if peak surpasses threshold
      if (peakStrength > effectiveThreshold) {
        // Beat interval validation with balanced criteria
        if (this.beatIntervalHistory.length > 2) {
          // Calculate average interval
          const avgInterval = this.beatIntervalHistory.reduce((sum, val) => sum + val, 0) / 
                             this.beatIntervalHistory.length;
          
          // Prevent premature beats with balanced threshold
          if (timeSinceLastBeat < avgInterval * 0.6) {
            return false;
          }
        }
        
        // Balanced confidence calculation
        this.beatConfidence = Math.min(0.85, 
          (peakStrength / (adaptiveThreshold * 1.1)) * qualityFactor * (this.signalStability + 0.55)
        );
        
        // Balanced confidence boost with consecutive detections
        this.consecutiveDetectionsCount++;
        if (this.consecutiveDetectionsCount > this.MIN_CONSECUTIVE_FOR_CONFIDENCE) {
          const confBoost = Math.min(
            0.12, 
            0.04 * (this.consecutiveDetectionsCount - this.MIN_CONSECUTIVE_FOR_CONFIDENCE) / this.MAX_CONSECUTIVE_BOOST
          );
          this.beatConfidence = Math.min(0.92, this.beatConfidence + confBoost);
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
        if (timeSinceLastBeat < 650) {  // Balanced threshold for high heart rates
          this.shouldReduceTimeBetweenBeats = true;
        } else if (timeSinceLastBeat > 950) {
          this.shouldReduceTimeBetweenBeats = false;
        }
        
        return true;
      }
    } else {
      // Gradual decrease in consecutive detections
      this.consecutiveDetectionsCount = Math.max(0, this.consecutiveDetectionsCount - 0.5);
    }

    // Balanced derivative-based fallback detection
    if (!isPeak && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS * 0.75) {
      // Use with high-quality signals
      if (derivative > 0.35 && quality > 65) {
        this.beatConfidence = 0.4;  // Balanced confidence for derivative detection
        this.lastBeatTime = now;
        return true;
      }
      
      // Last resort for very long gaps with strict conditions
      if (derivative > 0.4 && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS && quality > 75) {
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
    
    // Balanced minimum value requirement
    if (Math.abs(value) < 0.2) return false;
    
    // Check if current value is local maximum
    let peakConfirmed = true;
    
    // Check values before current value
    for (let i = 1; i <= windowSize; i++) {
      if (midPoint - i >= 0 && buffer[midPoint - i] >= value) {
        peakConfirmed = false;
        break;
      }
    }
    
    if (peakConfirmed) {
      // Check values after current value
      for (let i = 1; i <= windowSize; i++) {
        if (midPoint + i < buffer.length && buffer[midPoint + i] >= value) {
          peakConfirmed = false;
          break;
        }
      }
    }
    
    return peakConfirmed;
  }
  
  public updateAdaptiveThreshold(buffer: number[], now: number, debug: boolean = false): void {
    if (buffer.length < 15) return;
    
    const recentValues = buffer.slice(-25);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Update signal stability metric with balanced approach
    const sorted = [...recentValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    // Balanced stability metric (0-1 where 1 is most stable)
    this.signalStability = Math.min(1, Math.max(0, 1 - (iqr / (amplitude || 1))));
    
    // Balanced threshold adjustment rate
    const adaptationRate = 0.15 + (0.1 * this.signalStability);
    this.baselineThreshold = Math.max(
      0.4,  // Balanced minimum threshold
      this.baselineThreshold * (1 - adaptationRate) + amplitude * adaptationRate
    );
    
    if (debug) {
      console.log(`Peak detector: threshold=${this.baselineThreshold.toFixed(2)}, stability=${this.signalStability.toFixed(2)}, window=${this.adaptivePeakWindow}`);
    }
  }
  
  public setTimingParameters(interval: number): void {
    if (interval < 650) {  // Balanced threshold
      this.shouldReduceTimeBetweenBeats = true;
    } else if (interval > 950) {
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
    this.recentAmplitudes = Array(8).fill(1.0);
    this.peakHistory = [];
    this.beatIntervalHistory = [];
    this.consecutiveDetectionsCount = 0;
  }
}
