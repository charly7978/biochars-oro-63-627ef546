
import { PotentialPeak } from './types';

export class PeakDetector {
  // Peak detection parameters
  private readonly MIN_PEAK_THRESHOLD_FACTOR: number;
  private readonly STRONG_PEAK_THRESHOLD_FACTOR: number;
  private readonly DYNAMIC_THRESHOLD_FACTOR: number;
  private readonly PEAK_DETECTION_WINDOW: number;
  private readonly MIN_TIME_BETWEEN_BEATS: number;
  
  // State
  private baselineThreshold = 1.0;
  private lastThresholdUpdate = 0;
  private thresholdUpdateInterval: number;
  private potentialPeakQueue: PotentialPeak[] = [];
  private beatConfidence = 0;
  private shouldReduceTimeBetweenBeats = false;
  
  constructor(
    peakDetectionWindow = 4,
    minPeakThresholdFactor = 0.15,
    strongPeakThresholdFactor = 0.4,
    dynamicThresholdFactor = 0.8,
    minTimeBetweenBeats = 250,
    thresholdUpdateInterval = 500
  ) {
    this.PEAK_DETECTION_WINDOW = peakDetectionWindow;
    this.MIN_PEAK_THRESHOLD_FACTOR = minPeakThresholdFactor;
    this.STRONG_PEAK_THRESHOLD_FACTOR = strongPeakThresholdFactor;
    this.DYNAMIC_THRESHOLD_FACTOR = dynamicThresholdFactor;
    this.MIN_TIME_BETWEEN_BEATS = minTimeBetweenBeats;
    this.thresholdUpdateInterval = thresholdUpdateInterval;
  }
  
  public detectBeat(
    now: number,
    value: number, 
    quality: number, 
    signalBuffer: number[],
    derivativeValue: number,
    lastBeatTime: number
  ): boolean {
    // Skip if too soon after last beat
    const timeSinceLastBeat = now - lastBeatTime;
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.8 : this.MIN_TIME_BETWEEN_BEATS;
    
    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }
    
    // Current window for peak detection
    const recentValues = signalBuffer.slice(-this.PEAK_DETECTION_WINDOW * 2);
    if (recentValues.length < this.PEAK_DETECTION_WINDOW * 2) {
      return false;
    }
    
    // Get indices for window
    const midIdx = Math.floor(recentValues.length / 2);
    const currentValue = recentValues[midIdx];
    
    // Check if current value is a potential peak
    let isPotentialPeak = true;
    for (let i = 1; i <= this.PEAK_DETECTION_WINDOW; i++) {
      if (midIdx - i >= 0 && recentValues[midIdx - i] >= currentValue) {
        isPotentialPeak = false;
        break;
      }
    }
    
    // Look ahead to confirm peak
    if (isPotentialPeak) {
      for (let i = 1; i <= this.PEAK_DETECTION_WINDOW; i++) {
        if (midIdx + i < recentValues.length && recentValues[midIdx + i] > currentValue) {
          isPotentialPeak = false;
          break;
        }
      }
    }
    
    // If not a peak at this point, check the derivative for rapid upswing
    if (!isPotentialPeak && derivativeValue !== undefined) {
      // Strong positive derivative indicates start of upstroke (potential beat)
      if (derivativeValue > 0.3 && timeSinceLastBeat > minTimeBetweenBeats * 1.5) {
        this.potentialPeakQueue.push({ time: now, value });
        console.log(`Derivative-based potential peak queued, derivative: ${derivativeValue.toFixed(2)}`);
      }
    }
    
    // Process the potential peak queue
    if (this.potentialPeakQueue.length > 0) {
      // Process oldest peaks first
      const potentialPeak = this.potentialPeakQueue[0];
      this.potentialPeakQueue.shift();
      
      // If this peak is still relevant (not too old)
      if (now - potentialPeak.time < 300) {
        // Calculate dynamic threshold based on signal quality
        let effectiveThreshold = this.baselineThreshold;
        if (quality < 50) {
          // Lower threshold for low quality signals
          effectiveThreshold *= Math.max(0.3, quality / 100);
        }
        
        // Check if the peak is strong enough
        if (Math.abs(potentialPeak.value) > effectiveThreshold * this.MIN_PEAK_THRESHOLD_FACTOR) {
          // Strong signals need to meet a higher threshold
          const isStrongPeak = Math.abs(potentialPeak.value) > effectiveThreshold * this.STRONG_PEAK_THRESHOLD_FACTOR;
          
          // Higher confidence for stronger peaks
          this.beatConfidence = isStrongPeak ? 0.8 : 0.5;
          
          // Additional boost for good quality signals
          if (quality > 60) {
            this.beatConfidence = Math.min(1.0, this.beatConfidence + 0.2);
          }
          
          return true;
        }
      }
    }
    
    // Process immediate peaks for high quality signals
    if (isPotentialPeak && Math.abs(currentValue) > this.baselineThreshold * this.MIN_PEAK_THRESHOLD_FACTOR) {
      // For high quality signals, be more generous with peak detection
      if (quality > 60) {
        this.beatConfidence = 0.9;
        return true;
      }
      
      // For lower quality, require stronger peaks
      const isStrongPeak = Math.abs(currentValue) > this.baselineThreshold * this.STRONG_PEAK_THRESHOLD_FACTOR;
      if (isStrongPeak || (quality > 40 && Math.abs(currentValue) > this.baselineThreshold * 0.3)) {
        this.beatConfidence = isStrongPeak ? 0.7 : 0.4;
        return true;
      }
    }
    
    return false;
  }
  
  public updateAdaptiveThreshold(signalBuffer: number[], now: number, debug = false): void {
    if (now - this.lastThresholdUpdate <= this.thresholdUpdateInterval) {
      return;
    }
    
    // If buffer is too small, use a default threshold
    if (signalBuffer.length < 10) {
      this.baselineThreshold = 2.0;
      this.lastThresholdUpdate = now;
      return;
    }
    
    // Calculate threshold based on recent signal amplitude
    const recentValues = signalBuffer.slice(-30); // Last 30 samples
    if (recentValues.length === 0) return;
    
    // Find min, max, and average
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate amplitude and set threshold
    const amplitude = max - min;
    
    // Adapt threshold more gradually
    this.baselineThreshold = this.baselineThreshold * (1 - this.DYNAMIC_THRESHOLD_FACTOR) + 
                          amplitude * this.DYNAMIC_THRESHOLD_FACTOR;
    
    // Ensure threshold doesn't go too low
    this.baselineThreshold = Math.max(0.5, this.baselineThreshold);
    
    if (debug) {
      console.log(`Updated threshold: ${this.baselineThreshold.toFixed(2)}, Amplitude: ${amplitude.toFixed(2)}`);
    }
    
    this.lastThresholdUpdate = now;
  }
  
  public get confidence(): number {
    return this.beatConfidence;
  }
  
  public setTimingParameters(interval: number): void {
    if (interval < 400) {
      this.shouldReduceTimeBetweenBeats = true;
    } else if (interval > 1000) {
      this.shouldReduceTimeBetweenBeats = false;
    }
  }
  
  public reset(): void {
    this.potentialPeakQueue = [];
    this.baselineThreshold = 1.0;
    this.lastThresholdUpdate = 0;
    this.beatConfidence = 0;
    this.shouldReduceTimeBetweenBeats = false;
  }
}
