export class HeartBeatProcessor {
  // Configuration constants for beep timing and detection
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 45;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.2;        // Increased threshold for more reliable detection
  MIN_CONFIDENCE = 0.50;         // Higher confidence requirement to prevent false positives
  DERIVATIVE_THRESHOLD = -0.02;  // More conservative derivative threshold
  MIN_PEAK_TIME_MS = 350;        // Increased minimum time between peaks to prevent rapid beeps
  WARMUP_TIME_MS = 2000;         // Longer warmup time for better baseline establishment

  // Filters for signal stability
  MEDIAN_FILTER_WINDOW = 5;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.15;              // Reduced for smoother signal
  BASELINE_FACTOR = 0.997;       // Slower baseline adaptation

  // Beep sound configuration
  BEEP_PRIMARY_FREQUENCY = 800;
  BEEP_DURATION = 80;            // Longer beep duration
  BEEP_VOLUME = 0.7;             // Moderate volume
  MIN_BEEP_INTERVAL_MS = 500;    // Enforced minimum time between beeps to prevent rapid beeping

  // Signal quality detection
  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 15;        // Increased for more stability
  lowSignalCount = 0;

  // State variables
  signalBuffer = [];
  medianBuffer = [];
  movingAverageBuffer = [];
  smoothedValue = 0;
  audioContext = null;
  lastBeepTime = 0;
  lastPeakTime = null;
  previousPeakTime = null;
  bpmHistory = [];
  baseline = 0;
  lastValue = 0;
  values = [];
  startTime = 0;
  peakConfirmationBuffer = [];
  lastConfirmedPeak = false;
  smoothBPM = 0;
  BPM_ALPHA = 0.15;              // Reduced for more stable BPM calculation
  
  // Peak detection variables
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  lastProcessedPeakTime = 0;
  peakThresholdAdjuster = 1.0;
  stableDetectionCount = 0;
  
  // Variables for consistent timing
  adaptiveThresholdHistory = [];
  signalQualityHistory = [];
  lastBpmUpdateTime = 0;
  
  // Variables for reliable detection
  peakIntervalConsistency = 0;
  detectionConfidence = 0;
  lastExpectedHeartbeatTime = 0;
  
  // Variables for beep management
  beepSuccessCount = 0;
  lastBeepAttemptTime = 0;
  pendingBeepRequest = false;
  consecutiveBeats = 0;
  consistentBeatsRequired = 4;

  constructor() {
    console.log("HeartBeatProcessor: Initializing with consistent timing configuration");
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      // Only create audio context if it doesn't exist
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined' && !this.audioContext) {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Always resume the audio context
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Test beep with minimal volume
        const result = await this.playBeep(0.05);
        
        console.log("HeartBeatProcessor: Audio Context initialized successfully", {
          sampleRate: this.audioContext?.sampleRate,
          state: this.audioContext?.state,
          beepResult: result
        });
      } else if (!this.audioContext) {
        console.warn("HeartBeatProcessor: AudioContext not available");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
      // Reset audio context on error
      this.audioContext = null;
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Skip beeps during warmup or if beep was played too recently
    if (this.isInWarmup()) {
      console.log("HeartBeatProcessor: Skipped beep during warmup");
      return false;
    }
    
    const now = Date.now();
    
    // Strict enforcement of minimum interval between beeps
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      console.log(`HeartBeatProcessor: Skipped beep - too soon (${now - this.lastBeepTime}ms < ${this.MIN_BEEP_INTERVAL_MS}ms)`);
      return false;
    }

    try {
      // Initialize audio if not already done
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
          console.warn("HeartBeatProcessor: Cannot play beep - audio context unavailable or not running");
          return false;
        }
      }

      // Create oscillator for clean tone
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Configure oscillator with simple sine wave
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Create envelope for smooth sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Connect and play
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      
      // Record successful beep
      this.lastBeepTime = now;
      this.beepSuccessCount++;
      this.pendingBeepRequest = false;
      
      console.log(`HeartBeatProcessor: Beep #${this.beepSuccessCount} played successfully`);
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
      return false;
    }
  }

  isInWarmup() {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  medianFilter(value) {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  calculateMovingAverage(value) {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  calculateEMA(value) {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  processSignal(value) {
    try {
      // Apply filtering to remove noise
      const medVal = this.medianFilter(value);
      const movAvgVal = this.calculateMovingAverage(medVal);
      const smoothed = this.calculateEMA(movAvgVal);

      // Store in buffer for analysis
      this.signalBuffer.push(smoothed);
      if (this.signalBuffer.length > this.WINDOW_SIZE) {
        this.signalBuffer.shift();
      }

      // Wait for minimum buffer size
      if (this.signalBuffer.length < 15) {
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          filteredValue: smoothed,
          arrhythmiaCount: 0
        };
      }

      // Update baseline with slow tracking
      this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

      // Normalize signal relative to baseline
      const normalizedValue = smoothed - this.baseline;
      
      // Auto-reset if signal is consistently low
      this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

      // Calculate derivative for peak detection
      this.values.push(smoothed);
      if (this.values.length > 5) {
        this.values.shift();
      }

      let smoothDerivative = 0;
      if (this.values.length >= 5) {
        smoothDerivative = (this.values[4] - this.values[0]) / 4;
      } else if (this.values.length >= 3) {
        smoothDerivative = (this.values[2] - this.values[0]) / 2;
      } else {
        smoothDerivative = smoothed - this.lastValue;
      }
      this.lastValue = smoothed;

      // Detect peaks with high confidence requirement
      const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
      
      // Use multiple confirmations for reliability
      const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

      // Process confirmed peak with timing validation
      if (isConfirmedPeak && !this.isInWarmup()) {
        const now = Date.now();
        const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;

        // Enforce minimum time between peaks
        if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
          // Additional validation for peak timing
          let isValidPeak = true;
          
          // If we have established a rhythm, validate against expected timing
          if (this.smoothBPM > 40 && this.consecutiveBeats >= this.consistentBeatsRequired) {
            const expectedInterval = 60000 / this.smoothBPM;
            
            // Allow a reasonable window for variation (30% of expected interval)
            const minValidTime = this.lastExpectedHeartbeatTime - (expectedInterval * 0.3);
            const maxValidTime = this.lastExpectedHeartbeatTime + (expectedInterval * 0.3);
            
            // Only consider valid if within expected window
            if (now < minValidTime || now > maxValidTime) {
              isValidPeak = false;
              console.log(`HeartBeatProcessor: Rejected out-of-rhythm peak (expected window: ${minValidTime}-${maxValidTime}, actual: ${now})`);
            }
          }
          
          if (isValidPeak) {
            // Update peak timing history
            this.previousPeakTime = this.lastPeakTime;
            this.lastPeakTime = now;
            this.lastProcessedPeakTime = now;
            
            // Calculate next expected beat time based on current rhythm
            if (this.smoothBPM >= 40 && this.smoothBPM <= 200) {
              const expectedInterval = 60000 / this.smoothBPM;
              this.lastExpectedHeartbeatTime = now + expectedInterval;
            }
            
            console.log(`HeartBeatProcessor: Valid peak detected and confirmed`);
            
            // Update BPM and track consecutive beats
            this.updateBPM();
            this.stableDetectionCount++;
            this.consecutiveBeats++;
            
            // Update detection confidence metrics
            this.updateDetectionConfidence(timeSinceLastPeak);
            
            // Only trigger beep if we have established consistent rhythm
            if (this.consecutiveBeats >= 2) {
              // Directly play beep instead of queueing
              this.pendingBeepRequest = true;
              this.playBeep();
            }
          } else {
            // Reset consecutive beats counter for rejected peaks
            this.consecutiveBeats = Math.max(0, this.consecutiveBeats - 1);
          }
        }
      } else if (!isPeak && !isConfirmedPeak) {
        // Handle non-peak signal (do nothing, just passing through)
      }

      // Process any pending beep
      if (this.pendingBeepRequest) {
        const now = Date.now();
        if (now - this.lastBeepAttemptTime > 150) {
          this.playBeep();
          this.pendingBeepRequest = false;
        }
      }

      return {
        bpm: Math.round(this.getSmoothBPM()),
        confidence: confidence,
        isPeak: isConfirmedPeak && !this.isInWarmup(),
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    } catch (error) {
      console.error("HeartBeatProcessor: Error processing signal", error);
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: 0,
        arrhythmiaCount: 0
      };
    }
  }

  updateDetectionConfidence(interval) {
    // Calculate signal quality based on consistency
    const signalQuality = Math.min(1, this.stableDetectionCount / 15);
    
    // Update quality history
    this.signalQualityHistory.push(signalQuality);
    if (this.signalQualityHistory.length > 8) {
      this.signalQualityHistory.shift();
    }
    
    // Calculate average confidence
    this.detectionConfidence = this.signalQualityHistory.reduce((a, b) => a + b, 0) / 
                              Math.max(1, this.signalQualityHistory.length);
    
    // Update interval consistency metrics
    if (this.previousPeakTime && this.lastPeakTime) {
      const prevInterval = this.lastPeakTime - this.previousPeakTime;
      const consistency = 1 - Math.min(1, Math.abs(interval - prevInterval) / Math.max(interval, prevInterval));
      
      // Weighted update of consistency metric
      this.peakIntervalConsistency = 0.8 * this.peakIntervalConsistency + 0.2 * consistency;
    }
  }

  autoResetIfSignalIsLow(amplitude) {
    // Track low signal for auto reset
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1);
    }
  }

  resetDetectionStates() {
    console.log("HeartBeatProcessor: Resetting detection state due to low signal quality");
    
    // Reset peak detection
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    this.lastProcessedPeakTime = 0;
    
    // Reset adaptive parameters
    this.peakThresholdAdjuster = 1.0;
    this.stableDetectionCount = 0;
    this.peakIntervalConsistency = 0;
    this.pendingBeepRequest = false;
    this.consecutiveBeats = 0;
    this.lastExpectedHeartbeatTime = 0;
    this.lowSignalCount = 0;
  }

  detectPeak(normalizedValue, derivative) {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime ? now - this.lastPeakTime : Number.MAX_VALUE;

    // Enforce minimum time between peaks
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Core peak detection logic - require negative derivative and sufficient amplitude
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline;

    // Calculate confidence based on signal characteristics
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 1.2), 0),
      1
    );

    // Combined confidence score with emphasis on amplitude
    const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    // Add value to confirmation buffer
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    // Only proceed if it's a peak, not already confirmed, and meets confidence threshold
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      // Need sufficient buffer for confirmation
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Confirm only if it's the peak (values afterward are decreasing)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];
        
        if (goingDown1 && goingDown2) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      // Reset confirmed state when not at a peak
      this.lastConfirmedPeak = false;
    }

    return false;
  }

  updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Only use physiologically plausible values
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      
      // Keep a reasonable history size
      if (this.bpmHistory.length > 8) {
        this.bpmHistory.shift();
      }
      
      this.lastBpmUpdateTime = Date.now();
      
      console.log(`HeartBeatProcessor: BPM updated - Instant: ${instantBPM.toFixed(1)}, Smoothed: ${this.calculateCurrentBPM().toFixed(1)}`);
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    
    // Initialize smooth BPM
    if (this.smoothBPM === 0 && rawBPM > 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Apply exponential smoothing with adaptive alpha
    if (rawBPM > 0) {
      this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Use median filtering for robustness
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Calculate trimmed mean for stability
    let trimmed;
    if (sorted.length >= 5) {
      // Trim extremes
      const cutSize = Math.floor(sorted.length * 0.2);
      trimmed = sorted.slice(cutSize, sorted.length - cutSize);
    } else {
      trimmed = sorted;
    }
    
    if (!trimmed.length) return 0;
    
    // Calculate mean
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  getFinalBPM() {
    // Only provide final BPM with sufficient data
    if (this.bpmHistory.length < 3) {
      return 0;
    }
    
    // Trimmed mean for robustness
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.min(1, Math.round(sorted.length * 0.1));
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) return 0;
    
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  reset() {
    // Reset all state variables
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakConfirmationBuffer = [];
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.startTime = Date.now();
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    this.lastProcessedPeakTime = 0;
    this.peakThresholdAdjuster = 1.0;
    this.stableDetectionCount = 0;
    this.adaptiveThresholdHistory = [];
    this.signalQualityHistory = [];
    this.lastBpmUpdateTime = 0;
    this.peakIntervalConsistency = 0;
    this.detectionConfidence = 0;
    this.beepSuccessCount = 0;
    this.lastBeepAttemptTime = 0;
    this.pendingBeepRequest = false;
    this.consecutiveBeats = 0;
    this.lastExpectedHeartbeatTime = 0;
    
    // Try to ensure audio context is active
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => console.log("HeartBeatProcessor: Audio Context reactivated"))
        .catch(err => console.error("HeartBeatProcessor: Error reactivating Audio Context", err));
    }
    
    console.log("HeartBeatProcessor: Complete reset performed");
  }

  getRRIntervals() {
    // Convert BPM to RR intervals
    const intervals = this.bpmHistory.map(bpm => bpm > 0 ? 60000 / bpm : 0);
    
    return {
      intervals: intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
