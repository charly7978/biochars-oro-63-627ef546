
export class PeakDetector {
  // Constants for detection
  private readonly peakWindowSize: number;
  private readonly minPeakThreshold: number;
  private readonly strongPeakThreshold: number;
  private readonly adaptiveThresholdFactor: number;
  private readonly minTimeBetweenBeats: number;
  private readonly maxTimeBetweenBeats: number;
  
  // State variables
  private adaptiveThreshold: number = 0.2;
  private lastPeakTime: number = 0;
  private lastBeatValue: number = 0;
  private stability: number = 0.5;
  private confidence: number = 0.5;
  private lastPeakValues: number[] = [];
  private consecutiveBeats: number = 0;
  private minTimeSinceLastBeat: number;
  private missedBeatCounter: number = 0;
  
  // Enhanced thresholds for more sensitive detection
  private readonly MAX_PEAK_VALUES = 10;
  private readonly STABILITY_WINDOW = 5;
  private readonly CONFIDENCE_DECAY = 0.9;
  private readonly CONFIDENCE_BOOST = 1.2;
  private readonly PEAK_SIMILARITY_THRESHOLD = 0.7;
  private readonly AGGRESSIVE_DETECTION_THRESHOLD = 3;

  constructor(
    peakWindowSize: number = 3,
    minPeakThreshold: number = 0.15,
    strongPeakThreshold: number = 0.25,
    adaptiveThresholdFactor: number = 0.55,
    minTimeBetweenBeats: number = 240,
    maxTimeBetweenBeats: number = 1600
  ) {
    this.peakWindowSize = peakWindowSize;
    this.minPeakThreshold = minPeakThreshold;
    this.strongPeakThreshold = strongPeakThreshold;
    this.adaptiveThresholdFactor = adaptiveThresholdFactor;
    this.minTimeBetweenBeats = minTimeBetweenBeats;
    this.maxTimeBetweenBeats = maxTimeBetweenBeats;
    this.minTimeSinceLastBeat = minTimeBetweenBeats;
  }

  // More sensitive detection of beat signals
  public detectBeat(
    timestamp: number,
    value: number,
    quality: number,
    buffer: number[],
    derivative: number,
    lastHeartBeatTime: number
  ): boolean {
    const timeSinceLastPeak = timestamp - this.lastPeakTime;
    
    // More aggressive timing checks based on signal quality
    let minTimeRequired = this.minTimeSinceLastBeat;
    if (quality < 40) {
      // For lower quality signals, be more permissive with timing
      minTimeRequired = Math.max(200, this.minTimeSinceLastBeat * 0.8);
    } else if (this.missedBeatCounter > 2) {
      // If we've missed several beats, be more aggressive
      minTimeRequired = Math.max(180, this.minTimeSinceLastBeat * 0.7);
    }
    
    // More aggressive detection threshold adjustment based on signal quality
    let currentThreshold = this.adaptiveThreshold;
    if (quality < 50) {
      // Lower threshold for lower quality signals
      currentThreshold *= 0.8;
    }
    
    if (this.missedBeatCounter > this.AGGRESSIVE_DETECTION_THRESHOLD) {
      // Very aggressive threshold for detection after missed beats
      currentThreshold *= 0.6;
      console.log(`PeakDetector: Using aggressive threshold ${currentThreshold.toFixed(3)} after ${this.missedBeatCounter} missed beats`);
    }
    
    // Early rejection for timing constraints
    if (timeSinceLastPeak < minTimeRequired) {
      return false;
    }
    
    // Improved peak detection algorithm with more sensitivity
    const bufferLength = buffer.length;
    let isPeak = false;
    
    if (bufferLength < this.peakWindowSize * 2 + 1) {
      // Not enough data for detection
      return false;
    }
    
    // Get the current sliding window
    const windowStart = Math.max(0, bufferLength - this.peakWindowSize * 2 - 1);
    const window = buffer.slice(windowStart);
    
    // More aggressive peak finding for small windows
    if (window.length >= 3) {
      const currentIndex = window.length - 1;
      const current = window[currentIndex];
      
      // Check if this point is higher than previous and next is lower (if available)
      const prevHigherThanThreshold = current > window[currentIndex - 1] + currentThreshold;
      const prevLowerThanCurrent = current > window[currentIndex - 1];
      
      // Detect if we have a potential peak
      if (prevLowerThanCurrent && prevHigherThanThreshold) {
        // For the last point, we can only check previous
        if (currentIndex === window.length - 1 || current > window[currentIndex + 1]) {
          isPeak = true;
        }
      }
    }
    
    // Only proceed if we detected a peak and quality is acceptable
    if (isPeak && (value > currentThreshold || quality > 40)) {
      const timeSinceLastBeat = timestamp - lastHeartBeatTime;
      
      // More permissive quality check for first beat detection
      const qualityCheck = lastHeartBeatTime === 0 ? quality > 20 : quality > 30;
      
      // Check if the peak is within valid timing windows with more permissive check
      if ((timeSinceLastBeat >= minTimeRequired || lastHeartBeatTime === 0) && 
          (timeSinceLastBeat <= this.maxTimeBetweenBeats * 1.1 || lastHeartBeatTime === 0) &&
          qualityCheck) {
        
        console.log(`PeakDetector: Valid peak detected - Value: ${value.toFixed(3)}, Quality: ${quality}, TimeSinceLastBeat: ${timeSinceLastBeat}ms`);
        
        // Update stability metric based on consistent detection
        if (this.lastPeakValues.length > 0) {
          const prevValue = this.lastPeakValues[this.lastPeakValues.length - 1];
          const similarity = 1 - Math.min(1, Math.abs(value - prevValue) / Math.max(0.01, Math.abs(prevValue)));
          
          // More gradual stability adjustments
          if (similarity > this.PEAK_SIMILARITY_THRESHOLD) {
            this.stability = Math.min(1.0, this.stability + 0.1);
            this.consecutiveBeats++;
          } else {
            this.stability = Math.max(0.1, this.stability - 0.05);
            this.consecutiveBeats = Math.max(0, this.consecutiveBeats - 1);
          }
        }
        
        // More aggressive confidence boost
        this.confidence = Math.min(1.0, this.confidence * this.CONFIDENCE_BOOST + 0.1);
        
        // Store peak information
        this.lastPeakTime = timestamp;
        this.lastBeatValue = value;
        this.lastPeakValues.push(value);
        if (this.lastPeakValues.length > this.MAX_PEAK_VALUES) {
          this.lastPeakValues.shift();
        }
        
        // Reset missed beat counter on successful detection
        this.missedBeatCounter = 0;
        
        return true;
      }
    } else if (lastHeartBeatTime > 0) {
      // Beat missed based on timing - more aggressive checking
      const timeSinceLastBeat = timestamp - lastHeartBeatTime;
      const expectedBeatInterval = 60000 / 75; // Assume average heart rate
      
      if (timeSinceLastBeat > expectedBeatInterval * 1.3) {
        this.missedBeatCounter++;
        
        // More aggressive confidence reduction
        this.confidence = Math.max(0.2, this.confidence * this.CONFIDENCE_DECAY);
        
        if (this.missedBeatCounter % 3 === 0) {
          console.log(`PeakDetector: ${this.missedBeatCounter} consecutive beats missed, confidence reduced to ${this.confidence.toFixed(2)}`);
        }
      }
    }
    
    return false;
  }

  // More frequent update for adaptive threshold
  public updateAdaptiveThreshold(buffer: number[], timestamp: number, debug: boolean = false): void {
    if (buffer.length < 10) return;
    
    // Take recent values for threshold calculation
    const recentValues = buffer.slice(-20);
    
    // Calculate average and standard deviation
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    // More sensitive threshold based on signal characteristics
    const newThreshold = Math.max(
      this.minPeakThreshold,
      stdDev * this.adaptiveThresholdFactor
    );
    
    // Faster threshold adaptation (80% old, 20% new)
    this.adaptiveThreshold = this.adaptiveThreshold * 0.8 + newThreshold * 0.2;
    
    if (debug) {
      console.log(`PeakDetector: Updated adaptive threshold to ${this.adaptiveThreshold.toFixed(3)}, avg=${avg.toFixed(3)}, stdDev=${stdDev.toFixed(3)}`);
    }
  }

  // Update timing parameters based on detected intervals
  public setTimingParameters(beatInterval: number): void {
    // More responsive timing parameter updates
    if (beatInterval > 300 && beatInterval < 1500) {
      // Set minimum time as 75% of last interval (more aggressive)
      this.minTimeSinceLastBeat = Math.max(
        this.minTimeBetweenBeats,
        Math.round(beatInterval * 0.75)
      );
      
      console.log(`PeakDetector: Updated minimum time between beats to ${this.minTimeSinceLastBeat}ms based on interval ${beatInterval}ms`);
    }
  }

  // Reset the detector
  public reset(): void {
    this.adaptiveThreshold = 0.2;
    this.lastPeakTime = 0;
    this.lastBeatValue = 0;
    this.stability = 0.5;
    this.confidence = 0.5;
    this.lastPeakValues = [];
    this.consecutiveBeats = 0;
    this.minTimeSinceLastBeat = this.minTimeBetweenBeats;
    this.missedBeatCounter = 0;
    console.log("PeakDetector: Reset complete");
  }
  
  // Getters for internal state
  public get currentThreshold(): number {
    return this.adaptiveThreshold;
  }
  
  public get lastPeakTimestamp(): number {
    return this.lastPeakTime;
  }
  
  public get confidenceLevel(): number {
    return this.confidence;
  }
  
  public get stabilityLevel(): number {
    return this.stability;
  }
}
