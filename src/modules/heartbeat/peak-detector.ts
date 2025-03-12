
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
  
  constructor(
    peakWindow: number = 4,
    minPeakThreshold: number = 0.12, // Reduced from 0.15 for better sensitivity
    strongPeakThreshold: number = 0.3, // Reduced from 0.4 for better sensitivity
    dynamicThreshold: number = 0.8,
    minTimeBetweenBeats: number = 220, // Reduced from 250 for more responsive detection
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
    // Skip if too soon after last beat
    const timeSinceLastBeat = now - this.lastBeatTime;
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.8 : this.MIN_TIME_BETWEEN_BEATS;

    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }

    // Need enough samples for detection
    if (signalBuffer.length < this.adaptivePeakWindow * 2) {
      return false;
    }

    // Adjust peak window based on signal stability
    this.adaptivePeakWindow = Math.max(2, Math.min(6, Math.round(this.PEAK_WINDOW_SIZE * (1 + (1 - this.signalStability)))));

    // Check for peak with adaptive window size
    const isPeak = this.isPeakValue(value, signalBuffer);
    
    // Enhanced validation for peaks
    if (isPeak) {
      // Calculate peak strength more robustly
      const peakStrength = Math.abs(value);
      this.recentAmplitudes.push(peakStrength);
      if (this.recentAmplitudes.length > 10) {
        this.recentAmplitudes.shift();
      }
      
      // Get quality-adjusted threshold
      const qualityFactor = Math.max(0.3, quality / 100);
      const avgAmplitude = this.recentAmplitudes.reduce((sum, val) => sum + val, 0) / this.recentAmplitudes.length;
      const adaptiveThreshold = this.baselineThreshold * 
        (qualityFactor > 0.6 ? this.MIN_PEAK_THRESHOLD_FACTOR : this.STRONG_PEAK_THRESHOLD_FACTOR);
      
      // More sensitive threshold for higher quality signals
      const effectiveThreshold = adaptiveThreshold * (1 - (qualityFactor * 0.3));

      if (peakStrength > effectiveThreshold) {
        // Calculate more nuanced confidence based on peak strength and signal quality
        this.beatConfidence = Math.min(1.0, 
          (peakStrength / (adaptiveThreshold * 1.2)) * qualityFactor * (this.signalStability + 0.5)
        );
        
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
    if (!isPeak && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS * 0.7) {
      // Only consider derivative-based detection when quality is decent
      if (derivative > 0.25 && quality > 40) {
        this.beatConfidence = 0.3;
        this.lastBeatTime = now;
        return true;
      }
      
      // Secondary derivative check for very long gaps
      if (derivative > 0.15 && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS && quality > 30) {
        this.beatConfidence = 0.2;
        this.lastBeatTime = now;
        return true;
      }
    }

    return false;
  }
  
  private isPeakValue(value: number, buffer: number[]): boolean {
    const windowSize = this.adaptivePeakWindow;
    const midPoint = Math.floor(buffer.length / 2);
    
    // Skip if value is too small to be a meaningful peak
    if (Math.abs(value) < 0.1) return false;
    
    // Check if current value is local maximum with hysteresis
    let peakConfirmed = true;
    
    // Check before current value with slight hysteresis
    for (let i = 1; i <= windowSize; i++) {
      if (midPoint - i >= 0 && buffer[midPoint - i] >= value - 0.05) {
        peakConfirmed = false;
        break;
      }
    }
    
    if (peakConfirmed) {
      // Check after current value with hysteresis
      for (let i = 1; i <= windowSize; i++) {
        if (midPoint + i < buffer.length && buffer[midPoint + i] > value - 0.05) {
          peakConfirmed = false;
          break;
        }
      }
    }
    
    return peakConfirmed;
  }
  
  public updateAdaptiveThreshold(buffer: number[], now: number, debug: boolean = false): void {
    if (buffer.length < 30) return; // Need enough samples
    
    const recentValues = buffer.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Update signal stability metric
    const sorted = [...recentValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    
    // Normalized stability metric (0-1 where 1 is most stable)
    this.signalStability = Math.min(1, Math.max(0, 1 - (iqr / (amplitude || 1))));
    
    // More reactive threshold adjustment with stability factor
    const adaptationRate = 0.3 + (0.4 * this.signalStability);
    this.baselineThreshold = Math.max(
      0.3,
      this.baselineThreshold * (1 - adaptationRate) + amplitude * adaptationRate
    );
    
    if (debug) {
      console.log(`Peak detector updated: threshold=${this.baselineThreshold.toFixed(2)}, stability=${this.signalStability.toFixed(2)}, window=${this.adaptivePeakWindow}`);
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
  }
}
