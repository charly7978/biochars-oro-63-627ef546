export class HeartBeatProcessor {
  // Core configuration constants
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 45;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.2;
  MIN_CONFIDENCE = 0.35;
  DERIVATIVE_THRESHOLD = -0.015;
  MIN_PEAK_TIME_MS = 250;
  WARMUP_TIME_MS = 500;

  // Signal processing filters
  MEDIAN_FILTER_WINDOW = 5;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.25;
  BASELINE_FACTOR = 0.997;

  // Beep configuration
  BEEP_PRIMARY_FREQUENCY = 800;
  BEEP_DURATION = 60;
  BEEP_VOLUME = 1.0;
  MIN_BEEP_INTERVAL_MS = 250;

  // Signal quality detection
  LOW_SIGNAL_THRESHOLD = 0.025;
  LOW_SIGNAL_FRAMES = 10;
  lowSignalCount = 0;

  // Force immediate beeps
  FORCE_IMMEDIATE_BEEP = true;
  SKIP_TIMING_VALIDATION = true;

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
  BPM_ALPHA = 0.2;
  peakCandidateIndex = null;
  peakCandidateValue = 0;

  constructor() {
    console.log("HeartBeatProcessor: Initializing new instance with real-time beep synchronization");
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
        // Create a new audio context with interactive latency hint for faster response
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Make sure audio context is resumed/running
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Play silent beep to initialize audio system
        await this.playBeep(0.01);
        
        console.log("HeartBeatProcessor: Audio Context initialized successfully", {
          sampleRate: this.audioContext?.sampleRate,
          state: this.audioContext?.state
        });
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
      // Try recreating the audio context
      this.audioContext = null;
      
      // Second attempt
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
        try {
          this.audioContext = new AudioContext();
          this.audioContext.resume();
        } catch (innerErr) {
          console.error("HeartBeatProcessor: Second attempt audio init failed", innerErr);
        }
      }
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Skip warmup check for more predictable beep behavior
    const now = Date.now();
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

    try {
      // Ensure audio context is available and running
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
          console.warn("HeartBeatProcessor: Cannot play beep - audio context unavailable");
          return false;
        }
      }

      // Create oscillator for a cleaner, more noticeable beep
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Configure oscillator with sine wave
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Create sharper envelope for immediate audibility
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.005
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Connect and play
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      
      // Record successful beep
      this.lastBeepTime = now;
      
      console.log("HeartBeatProcessor: Beep played successfully at", now);
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
      // Apply filtering to reduce noise
      const medVal = this.medianFilter(value);
      const movAvgVal = this.calculateMovingAverage(medVal);
      const smoothed = this.calculateEMA(movAvgVal);

      // Store in buffer for analysis
      this.signalBuffer.push(smoothed);
      if (this.signalBuffer.length > this.WINDOW_SIZE) {
        this.signalBuffer.shift();
      }

      // Wait for minimum buffer size
      if (this.signalBuffer.length < 8) {
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

      // Normalize signal
      const normalizedValue = smoothed - this.baseline;
      this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

      // Calculate derivative for peak detection
      this.values.push(smoothed);
      if (this.values.length > 3) {
        this.values.shift();
      }

      let smoothDerivative = smoothed - this.lastValue;
      if (this.values.length === 3) {
        smoothDerivative = (this.values[2] - this.values[0]) / 2;
      }
      this.lastValue = smoothed;

      // Detect peak with adjusted thresholds for more reliable detection
      const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
      
      // Confirm peak to avoid false positives
      const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

      // Process confirmed peak and ALWAYS play beep immediately 
      if (isConfirmedPeak) {
        const now = Date.now();
        
        // Update timing for BPM calculation
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Update BPM
        this.updateBPM();
        
        // Always play beep immediately on peak detection
        this.playBeep(this.BEEP_VOLUME);
      }

      // Return results
      return {
        bpm: Math.round(this.getSmoothBPM()),
        confidence: confidence,
        isPeak: isConfirmedPeak,
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

  autoResetIfSignalIsLow(amplitude) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    console.log("HeartBeatProcessor: Reset detection states (low signal)");
  }

  detectPeak(normalizedValue, derivative) {
    // Core peak detection logic - simplified for more reliable peak detection
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD;

    // Calculate confidence
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.2), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD), 0),
      1
    );

    // Combined confidence
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
        
        // Confirm peak immediately when values start decreasing (peak found)
        const goingDown = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        
        if (goingDown) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }

    return false;
  }

  updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Only use values within physiological range
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 8) {
        this.bpmHistory.shift();
      }
      
      console.log(`HeartBeatProcessor: BPM updated - Instant: ${instantBPM.toFixed(1)}`);
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Only apply smoothing if we have a valid raw BPM
    if (rawBPM > 0) {
      this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Use median filtering for more stable BPM
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Middle value for stability
    const middle = Math.floor(sorted.length / 2);
    const medianBPM = sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2 
      : sorted[middle];
    
    return medianBPM;
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
    
    // Try to ensure audio context is active
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => console.log("HeartBeatProcessor: Audio Context resumed during reset"))
        .catch(err => console.error("HeartBeatProcessor: Error resuming audio context during reset", err));
    }
    
    console.log("HeartBeatProcessor: Complete reset performed");
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory.map(bpm => 60000 / bpm)],
      lastPeakTime: this.lastPeakTime
    };
  }
}

