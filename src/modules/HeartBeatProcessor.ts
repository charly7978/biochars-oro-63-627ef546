import HumSoundFile from '../assets/sounds/heartbeat-low.mp3';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isBeat: boolean;
  lastBeatTime: number;
  rrData: { timestamp: number; interval: number }[];
}

export class HeartBeatProcessor {
  // Debug mode
  private DEBUG = true;

  // Signal processing parameters
  private readonly MAX_BUFFER_SIZE = 300;
  private readonly MIN_CONFIDENCE_FOR_BPM = 0.2; // Much lower to detect weak signals
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 180;
  private readonly SIGNAL_WINDOW = 3.0; // seconds
  private readonly PEAK_DETECTION_WINDOW = 4; // Much smaller for faster detection
  private readonly BPM_WINDOW_SIZE = 5; // Average over 5 beats
  private readonly MAX_RR_DATA_POINTS = 20;

  // Adaptive thresholds
  private readonly MIN_PEAK_THRESHOLD_FACTOR = 0.15; // Much lower to detect subtle peaks
  private readonly STRONG_PEAK_THRESHOLD_FACTOR = 0.4; // For definite peaks
  private readonly DYNAMIC_THRESHOLD_FACTOR = 0.8; // Adapt threshold more quickly
  private baselineThreshold = 1.0;
  private lastThresholdUpdate = 0;
  private thresholdUpdateInterval = 500; // ms between threshold updates

  // Adaptive timing
  private readonly MIN_TIME_BETWEEN_BEATS = 250; // ms - corresponds to 240 BPM (maximum)
  private shouldReduceTimeBetweenBeats = false;

  // State
  private signalBuffer: number[] = [];
  private bpmValues: number[] = [];
  private lastBeatTime = 0;
  private lastMajorBeatTime = 0;
  private prevValidBpm = 0;
  private rrIntervals: { timestamp: number; interval: number }[] = [];
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private beepGainNode: GainNode | null = null;
  private isInitialized = false;
  private potentialPeakQueue: { time: number; value: number }[] = [];
  private lastProcessedValue = 0;
  private valueDerivative = 0;
  private consecutiveMissedBeats = 0;
  private forcedDetectionMode = false;
  private lastSignalQuality = 0;
  private beatConfidence = 0;
  private audioInitialized = false;
  
  // Derivative processing
  private derivativeBuffer: number[] = []; 
  private readonly DERIVATIVE_BUFFER_SIZE = 10;

  // Adaptive EMA smoothing
  private readonly EMA_ALPHA = 0.4; // Higher for faster response

  constructor() {
    this.initialize();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load audio asynchronously
      const response = await fetch(HumSoundFile);
      const arrayBuffer = await response.arrayBuffer();

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain node for volume control
      this.beepGainNode = this.audioContext.createGain();
      this.beepGainNode.gain.value = 0.7; // Lower default volume
      this.beepGainNode.connect(this.audioContext.destination);
      
      // Decode audio
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.audioInitialized = true;
      console.log("HeartBeatProcessor: Audio Context Initialized");
      this.isInitialized = true;
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
    }
  }

  public processSignal(value: number, quality: number = 0): HeartBeatResult {
    const now = Date.now();
    this.lastSignalQuality = quality;
    
    // Add signal to buffer with EMA smoothing for noise reduction
    if (this.signalBuffer.length === 0) {
      this.signalBuffer.push(value);
    } else {
      // Smooth signal using EMA
      const smoothedValue = this.lastProcessedValue + 
        this.EMA_ALPHA * (value - this.lastProcessedValue);
      this.signalBuffer.push(smoothedValue);
      this.lastProcessedValue = smoothedValue;
    }
    
    // Calculate first derivative (slope) - important for peak detection
    if (this.signalBuffer.length >= 2) {
      const currentValue = this.signalBuffer[this.signalBuffer.length - 1];
      const prevValue = this.signalBuffer[this.signalBuffer.length - 2];
      const newDerivative = currentValue - prevValue;
      
      // Smooth derivative using EMA
      if (this.derivativeBuffer.length === 0) {
        this.valueDerivative = newDerivative;
      } else {
        this.valueDerivative = this.valueDerivative * 0.7 + newDerivative * 0.3;
      }
      
      // Store derivative for trend analysis
      this.derivativeBuffer.push(this.valueDerivative);
      if (this.derivativeBuffer.length > this.DERIVATIVE_BUFFER_SIZE) {
        this.derivativeBuffer.shift();
      }
    }
    
    // Limit buffer size
    if (this.signalBuffer.length > this.MAX_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }

    // Beat detection logic
    let isBeat = false;
    let currentBpm = this.prevValidBpm || 75; // Default to 75 BPM if no history
    
    // Only try to detect beats if we have enough samples
    if (this.signalBuffer.length > this.PEAK_DETECTION_WINDOW * 2) {
      isBeat = this.detectBeat(now, value, quality);
      
      // If beat detected, calculate new BPM
      if (isBeat) {
        // Reset counter for forced mode
        this.consecutiveMissedBeats = 0;
        this.forcedDetectionMode = false;
        
        if (this.lastBeatTime > 0) {
          const interval = now - this.lastBeatTime;
          
          // Calculate BPM from RR interval
          const bpm = 60000 / interval;
          
          // Only accept physiologically plausible values
          if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
            // Store RR interval data
            this.rrIntervals.push({ timestamp: now, interval });
            if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
              this.rrIntervals.shift();
            }
            
            // Add to BPM history
            this.bpmValues.push(bpm);
            if (this.bpmValues.length > this.BPM_WINDOW_SIZE) {
              this.bpmValues.shift();
            }
            
            // Calculate average BPM
            const sum = this.bpmValues.reduce((a, b) => a + b, 0);
            currentBpm = Math.round(sum / this.bpmValues.length);
            this.prevValidBpm = currentBpm;
            
            // Check if we need to adjust timing parameters
            if (interval < 400) { // Very fast heart rate
              this.shouldReduceTimeBetweenBeats = true;
            } else if (interval > 1000) { // Slow heart rate
              this.shouldReduceTimeBetweenBeats = false;
            }
          }
        }
        
        // Update last beat time
        this.lastBeatTime = now;
        this.lastMajorBeatTime = now;
        
        // Play beep with volume based on confidence and signal quality
        this.playBeep(this.beatConfidence, quality);
        
        if (this.DEBUG) {
          console.log(`HEARTBEAT @ ${new Date().toISOString()} - BPM: ${currentBpm}, Confidence: ${this.beatConfidence.toFixed(2)}, Quality: ${quality}`);
        }
      } else {
        // Increment missed beats counter
        this.consecutiveMissedBeats++;
        
        // After too many missed beats, enter forced detection mode
        if (this.consecutiveMissedBeats > 15 && !this.forcedDetectionMode && quality > 40) {
          this.forcedDetectionMode = true;
          console.log("Entering forced beat detection mode due to missed beats");
        }
        
        // In forced mode with decent quality, try to detect beats based on expected timing
        if (this.forcedDetectionMode && quality > 40 && this.lastBeatTime > 0) {
          const expectedInterval = 60000 / (this.prevValidBpm || 75);
          const sinceLastBeat = now - this.lastBeatTime;
          
          // If we're past the expected interval and have a positive derivative, force a beat
          if (sinceLastBeat > expectedInterval * 1.1 && this.valueDerivative > 0 && 
              this.signalBuffer[this.signalBuffer.length - 1] > this.signalBuffer[this.signalBuffer.length - 3]) {
            
            console.log("Forcing beat detection based on timing");
            isBeat = true;
            this.lastBeatTime = now;
            
            // Play softer beep for forced beats
            this.playBeep(0.3, quality);
            
            // Add to RR data
            this.rrIntervals.push({ timestamp: now, interval: sinceLastBeat });
            if (this.rrIntervals.length > this.MAX_RR_DATA_POINTS) {
              this.rrIntervals.shift();
            }
          }
        }
      }
    }

    // Update threshold periodically
    if (now - this.lastThresholdUpdate > this.thresholdUpdateInterval) {
      this.updateAdaptiveThreshold();
      this.lastThresholdUpdate = now;
    }

    // Adjust time between beats dynamically
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.8 : this.MIN_TIME_BETWEEN_BEATS;

    return {
      bpm: currentBpm,
      confidence: this.calculateConfidence(quality),
      isBeat,
      lastBeatTime: this.lastBeatTime,
      rrData: [...this.rrIntervals]
    };
  }

  private detectBeat(now: number, value: number, quality: number): boolean {
    // Skip if too soon after last beat
    const timeSinceLastBeat = now - this.lastBeatTime;
    const minTimeBetweenBeats = this.shouldReduceTimeBetweenBeats ? 
      this.MIN_TIME_BETWEEN_BEATS * 0.8 : this.MIN_TIME_BETWEEN_BEATS;
    
    if (timeSinceLastBeat < minTimeBetweenBeats) {
      return false;
    }
    
    // Current window for peak detection
    const recentValues = this.signalBuffer.slice(-this.PEAK_DETECTION_WINDOW * 2);
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
    if (!isPotentialPeak && this.derivativeBuffer.length >= 3) {
      const recentDerivatives = this.derivativeBuffer.slice(-3);
      const avgDerivative = recentDerivatives.reduce((sum, val) => sum + val, 0) / recentDerivatives.length;
      
      // Strong positive derivative indicates start of upstroke (potential beat)
      if (avgDerivative > 0.3 && timeSinceLastBeat > minTimeBetweenBeats * 1.5) {
        this.potentialPeakQueue.push({ time: now, value });
        console.log(`Derivative-based potential peak queued, derivative: ${avgDerivative.toFixed(2)}`);
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

  private updateAdaptiveThreshold(): void {
    // If buffer is too small, use a default threshold
    if (this.signalBuffer.length < 10) {
      this.baselineThreshold = 2.0;
      return;
    }
    
    // Calculate threshold based on recent signal amplitude
    const recentValues = this.signalBuffer.slice(-30); // Last 30 samples
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
    
    if (this.DEBUG) {
      console.log(`Updated threshold: ${this.baselineThreshold.toFixed(2)}, Amplitude: ${amplitude.toFixed(2)}`);
    }
  }

  private calculateConfidence(quality: number): number {
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
    
    // Reduce confidence for forced detection mode
    if (this.forcedDetectionMode) {
      confidence *= 0.7;
    }
    
    // Cap at 100%
    return Math.min(1.0, confidence);
  }

  private playBeep(confidence: number, quality: number): void {
    // Skip if audio not initialized
    if (!this.audioContext || !this.audioBuffer || !this.beepGainNode || !this.audioInitialized) {
      return;
    }
    
    try {
      // Adjust volume based on confidence and quality
      const volume = Math.min(1.0, confidence * (quality / 100 + 0.5));
      this.beepGainNode.gain.value = Math.max(0.3, volume);
      
      // Create and configure source
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      source.connect(this.beepGainNode);
      
      // Start playback
      source.start();
      console.log(`BEEP played at ${new Date().toISOString()}`);
    } catch (error) {
      console.error("Error playing heartbeat sound:", error);
    }
  }

  public reset(): void {
    this.signalBuffer = [];
    this.bpmValues = [];
    this.lastBeatTime = 0;
    this.lastMajorBeatTime = 0;
    this.prevValidBpm = 0;
    this.rrIntervals = [];
    this.baselineThreshold = 1.0;
    this.lastThresholdUpdate = 0;
    this.potentialPeakQueue = [];
    this.lastProcessedValue = 0;
    this.valueDerivative = 0;
    this.derivativeBuffer = [];
    this.consecutiveMissedBeats = 0;
    this.forcedDetectionMode = false;
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // Convert RR interval data to a simple array of intervals
    const intervals = this.rrIntervals.map(rr => rr.interval);
    
    return {
      intervals: intervals,
      lastPeakTime: this.lastBeatTime > 0 ? this.lastBeatTime : null
    };
  }
}
