
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
  
  constructor(
    peakWindow: number = 4,
    minPeakThreshold: number = 0.15,
    strongPeakThreshold: number = 0.4,
    dynamicThreshold: number = 0.8,
    minTimeBetweenBeats: number = 250,
    maxTimeBetweenBeats: number = 1500
  ) {
    this.PEAK_WINDOW_SIZE = peakWindow;
    this.MIN_PEAK_THRESHOLD_FACTOR = minPeakThreshold;
    this.STRONG_PEAK_THRESHOLD_FACTOR = strongPeakThreshold;
    this.MIN_TIME_BETWEEN_BEATS = minTimeBetweenBeats;
    this.MAX_TIME_BETWEEN_BEATS = maxTimeBetweenBeats;
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
      this.MIN_TIME_BETWEEN_BEATS * 0.8 : this.MIN_TIME_BETWEEN_BEATS;

    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }

    // Need enough samples for detection
    if (signalBuffer.length < this.PEAK_WINDOW_SIZE * 2) {
      return false;
    }

    // Check for peak
    const isPeak = this.isPeakValue(value, signalBuffer);
    
    // Stronger validation for peaks based on signal quality
    if (isPeak) {
      const peakStrength = Math.abs(value);
      const qualityFactor = quality / 100;
      const threshold = this.baselineThreshold * 
        (qualityFactor > 0.6 ? this.MIN_PEAK_THRESHOLD_FACTOR : this.STRONG_PEAK_THRESHOLD_FACTOR);

      if (peakStrength > threshold) {
        this.beatConfidence = Math.min(1.0, (peakStrength / threshold) * qualityFactor);
        this.lastBeatTime = now;
        
        // Update timing parameters
        if (timeSinceLastBeat < 400) {
          this.shouldReduceTimeBetweenBeats = true;
        } else if (timeSinceLastBeat > 1000) {
          this.shouldReduceTimeBetweenBeats = false;
        }
        
        return true;
      }
    }

    // Consider derivative-based detection for missed beats
    if (!isPeak && derivative > 0.3 && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS) {
      this.beatConfidence = 0.3;
      this.lastBeatTime = now;
      return true;
    }

    return false;
  }
  
  private isPeakValue(value: number, buffer: number[]): boolean {
    const windowSize = this.PEAK_WINDOW_SIZE;
    const midPoint = Math.floor(buffer.length / 2);
    
    // Check if current value is local maximum
    for (let i = 1; i <= windowSize; i++) {
      // Check before current value
      if (midPoint - i >= 0 && buffer[midPoint - i] >= value) {
        return false;
      }
      // Check after current value
      if (midPoint + i < buffer.length && buffer[midPoint + i] > value) {
        return false;
      }
    }
    
    return true;
  }
  
  public updateAdaptiveThreshold(buffer: number[], now: number, debug: boolean = false): void {
    if (buffer.length < 30) return; // Need enough samples
    
    const recentValues = buffer.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // More reactive threshold adjustment
    this.baselineThreshold = Math.max(
      0.5,
      this.baselineThreshold * 0.7 + amplitude * 0.3
    );
    
    if (debug) {
      console.log(`Peak detector threshold updated: ${this.baselineThreshold.toFixed(2)}`);
    }
  }
  
  public setTimingParameters(interval: number): void {
    if (interval < 400) {
      this.shouldReduceTimeBetweenBeats = true;
    } else if (interval > 1000) {
      this.shouldReduceTimeBetweenBeats = false;
    }
  }
  
  public get confidence(): number {
    return this.beatConfidence;
  }
  
  public reset(): void {
    this.lastBeatTime = 0;
    this.beatConfidence = 0;
    this.baselineThreshold = 1.0;
    this.shouldReduceTimeBetweenBeats = false;
  }
}
