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
  
  constructor(
    peakWindow: number = 3,  
    minPeakThreshold: number = 0.15,  // Increased for better fingertip detection
    strongPeakThreshold: number = 0.3, // Increased for more reliable detection
    dynamicThreshold: number = 0.7,
    minTimeBetweenBeats: number = 250, // Adjusted for better rhythm detection
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
      this.MIN_TIME_BETWEEN_BEATS * 0.85 : this.MIN_TIME_BETWEEN_BEATS;

    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }

    // Need enough samples for detection, but be more permissive
    if (signalBuffer.length < this.adaptivePeakWindow) {
      return false;
    }

    // Adjust peak window based on signal stability (higher stability = smaller window)
    this.adaptivePeakWindow = Math.max(2, Math.min(5, Math.round(this.PEAK_WINDOW_SIZE * (1.15 - this.signalStability))));

    // Check for peak with adaptive window size
    const isPeak = this.isPeakValue(value, signalBuffer);
    
    // Enhanced validation for peaks - be more lenient
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
      
      // Get quality-adjusted threshold - lower threshold for more detection
      const qualityFactor = Math.max(0.3, quality / 100);
      const avgAmplitude = this.recentAmplitudes.reduce((sum, val) => sum + val, 0) / this.recentAmplitudes.length;
      
      // Adaptive threshold based on both global threshold and recent peak history
      // Lower thresholds for better detection
      const avgPeakStrength = this.peakHistory.length > 0 ? 
        this.peakHistory.reduce((sum, val) => sum + val, 0) / this.peakHistory.length : 0;
      
      // Use lower thresholds for all signals
      const adaptiveThreshold = this.baselineThreshold * 
        (this.MIN_PEAK_THRESHOLD_FACTOR * 0.8);
      
      // Consider peak intensity relative to recent history - be more permissive
      const relativePeakStrength = avgPeakStrength > 0 ? peakStrength / avgPeakStrength : 1;
      
      // Lower threshold even more for weak signals
      const effectiveThreshold = relativePeakStrength < 0.6 ? 
        adaptiveThreshold * 0.9 : adaptiveThreshold;

      // Check if peak surpasses threshold and calculate confidence - be more lenient
      if (peakStrength > effectiveThreshold * 0.8) {
        // Less strict beat interval validation
        if (this.beatIntervalHistory.length > 2) {
          // Calculate average interval
          const avgInterval = this.beatIntervalHistory.reduce((sum, val) => sum + val, 0) / 
                             this.beatIntervalHistory.length;
          
          // Be more permissive with off-rhythm beats
          if (Math.abs(timeSinceLastBeat - avgInterval) > avgInterval * 0.7 && timeSinceLastBeat < avgInterval * 0.5) {
            // Still accept it but with lower confidence
            this.beatConfidence = 0.3;
            this.lastBeatTime = now;
            return true;
          }
        }
        
        // Calculate more nuanced confidence based on peak strength, quality and rhythm
        // Boost confidence for all signals
        this.beatConfidence = Math.min(0.95, 
          (peakStrength / (adaptiveThreshold * 1.1)) * (qualityFactor + 0.2) * (this.signalStability + 0.6)
        );
        
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
    }

    // More aggressive derivative-based detection for missed beats
    if (!isPeak && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS * 0.7) {
      // Accept derivative-based detection at lower quality thresholds
      if (derivative > 0.25 && quality > 40) {
        this.beatConfidence = 0.4;
        this.lastBeatTime = now;
        return true;
      }
      
      // Even more permissive for long gaps
      if (derivative > 0.15 && timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS && quality > 35) {
        this.beatConfidence = 0.3;
        this.lastBeatTime = now;
        return true;
      }
      
      // Force a beat detection after very long periods with no beats
      if (timeSinceLastBeat > this.MAX_TIME_BETWEEN_BEATS * 1.5 && quality > 25) {
        console.log("Forcing beat detection after long gap");
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
    
    // Accept smaller peaks
    if (Math.abs(value) < 0.1) return false;
    
    // Check if current value is local maximum with less hysteresis
    let peakConfirmed = true;
    
    // Check before current value with minimal hysteresis
    for (let i = 1; i <= windowSize; i++) {
      if (midPoint - i >= 0 && buffer[midPoint - i] >= value - 0.05) {
        peakConfirmed = false;
        break;
      }
    }
    
    if (peakConfirmed) {
      // Check after current value with less hysteresis
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
    if (buffer.length < 20) return; // Reduced minimum samples
    
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
    
    // More aggressive threshold adjustment
    const adaptationRate = 0.3 + (0.3 * this.signalStability);
    this.baselineThreshold = Math.max(
      0.3,  // Lower minimum threshold to detect more beats
      this.baselineThreshold * (1 - adaptationRate) + amplitude * adaptationRate
    );
    
    if (debug) {
      console.log(`Peak detector updated: threshold=${this.baselineThreshold.toFixed(2)}, stability=${this.signalStability.toFixed(2)}, window=${this.adaptivePeakWindow}`);
    }
  }
  
  public setTimingParameters(interval: number): void {
    if (interval < 500) {
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
  }
}
