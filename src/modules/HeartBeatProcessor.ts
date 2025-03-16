export class HeartBeatProcessor {
  // Configuration constants for beep timing and detection
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 45;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.15;        // Lowered for more sensitive detection
  MIN_CONFIDENCE = 0.40;         // Lowered confidence requirement to catch more peaks
  DERIVATIVE_THRESHOLD = -0.015;  // More sensitive derivative threshold
  MIN_PEAK_TIME_MS = 200;        // Reduced for more frequent beat detection
  WARMUP_TIME_MS = 1000;         // Shorter warmup for faster response

  // Filters for signal stability
  MEDIAN_FILTER_WINDOW = 5;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.20;              // Balanced for responsiveness
  BASELINE_FACTOR = 0.997;       // Slow baseline adaptation for stability

  // Beep sound configuration
  BEEP_PRIMARY_FREQUENCY = 800;
  BEEP_DURATION = 70;            // Shorter for more responsive beeps
  BEEP_VOLUME = 0.95;            // High volume for clear audio
  MIN_BEEP_INTERVAL_MS = 180;    // Reduced interval between beeps for responsiveness

  // Signal quality detection
  LOW_SIGNAL_THRESHOLD = 0.02;
  LOW_SIGNAL_FRAMES = 15;
  lowSignalCount = 0;

  // Flags for synchronized beeps
  FORCE_IMMEDIATE_BEEP = true;  // Always force immediate beeps
  SKIP_TIMING_VALIDATION = true; // Skip timing validation to maximize beeps

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
  BPM_ALPHA = 0.15;
  
  // Peak detection variables
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  lastProcessedPeakTime = 0;
  
  // Variables for consistent timing
  lastBpmUpdateTime = 0;
  
  // Variables for reliable detection
  peakIntervalConsistency = 0;
  detectionConfidence = 0;
  
  // Variables for beep management
  beepQueue = [];
  lastBeepRequestTime = 0;
  pendingBeepRequest = false;
  consecutiveBeats = 0;
  beepSuccessCount = 0;

  constructor() {
    console.log("HeartBeatProcessor: Initializing with synchronized beep configuration");
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined' && !this.audioContext) {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Always resume the audio context for reliable playback
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Test beep with minimal volume to prepare audio system
        await this.playBeep(0.01);
        
        // Prepare oscillator in advance to reduce latency
        this.prepareAudioSystem();
        
        console.log("HeartBeatProcessor: Audio Context initialized successfully", {
          sampleRate: this.audioContext?.sampleRate,
          state: this.audioContext?.state
        });
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
      // Reset audio context on error for clean retry
      this.audioContext = null;
    }
  }
  
  // Prepare the audio system to reduce latency on future beeps
  async prepareAudioSystem() {
    if (!this.audioContext) return;
    
    try {
      // Create a silent oscillator and play briefly to warm up the audio system
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      gain.gain.value = 0.001; // Nearly silent
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.01);
    } catch (err) {
      console.error("HeartBeatProcessor: Error preparing audio system", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Only skip during warmup
    if (this.isInWarmup()) {
      return false;
    }
    
    const now = Date.now();
    
    // Skip timing validation if configured to do so
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS * 0.7) {
      // Queue the beep for later if we can't play it now
      this.queueBeep(volume);
      return false;
    }

    try {
      // Ensure audio context is ready
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
          return false;
        }
      }

      // Simple beep implementation for lower latency
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Quick attack, quick release for responsive sound
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.005 // Faster attack
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      
      // Record successful beep
      this.lastBeepTime = now;
      this.beepSuccessCount++;
      this.pendingBeepRequest = false;
      
      // Process any queued beeps if available
      this.processBeepQueue();
      
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
      return false;
    }
  }

  // Queue a beep to play later
  queueBeep(volume) {
    this.beepQueue.push({
      time: Date.now(),
      volume: volume
    });
    
    // Process queue immediately if possible
    setTimeout(() => this.processBeepQueue(), 10);
  }

  // Process queued beeps
  processBeepQueue() {
    if (this.beepQueue.length === 0) return;
    
    const now = Date.now();
    
    // Only process if enough time has passed since last beep
    if (now - this.lastBeepTime >= this.MIN_BEEP_INTERVAL_MS * 0.7) {
      const nextBeep = this.beepQueue.shift();
      if (nextBeep) {
        this.playBeep(nextBeep.volume);
      }
    } else if (this.beepQueue.length > 0) {
      // Try again soon
      setTimeout(() => this.processBeepQueue(), 50);
    }
  }

  // Method for external components to request beeps
  requestBeepForTime(timestamp) {
    const now = Date.now();
    if (now - this.lastBeepRequestTime < 100) return false;
    
    this.lastBeepRequestTime = now;
    
    // Always force immediate beep to synchronize with visual
    this.playBeep(this.BEEP_VOLUME);
    return true;
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
      if (this.signalBuffer.length < 10) { // Reduced from 15 for faster startup
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

      // Calculate smooth derivative
      let smoothDerivative = 0;
      if (this.values.length >= 3) {
        smoothDerivative = (this.values[this.values.length-1] - this.values[0]) / 
                           Math.max(1, this.values.length - 1);
      } else {
        smoothDerivative = smoothed - this.lastValue;
      }
      this.lastValue = smoothed;

      // Detect peaks with relaxed confidence requirements
      const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
      
      // Simplified peak confirmation for more reliable detection
      const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

      // Process confirmed peak with immediate beep
      if (isConfirmedPeak && !this.isInWarmup()) {
        const now = Date.now();
        
        // Update peak timing history
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;

        // Calculate heart rate
        this.updateBPM();
        
        // Play beep immediately for each peak if configured to do so
        if (this.FORCE_IMMEDIATE_BEEP) {
          this.playBeep(this.BEEP_VOLUME);
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
    this.lowSignalCount = 0;
  }

  detectPeak(normalizedValue, derivative) {
    const now = Date.now();
    
    // Skip timing validation if configured to do so
    if (!this.SKIP_TIMING_VALIDATION && this.lastPeakTime) {
      const timeSinceLastPeak = now - this.lastPeakTime;
      if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS * 0.7) {
        return { isPeak: false, confidence: 0 };
      }
    }

    // Core peak detection logic - more sensitive thresholds
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD;

    // Calculate confidence based on signal characteristics
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.2), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD), 0),
      1
    );

    // Combined confidence score with emphasis on derivative for better timing
    const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    // Add value to confirmation buffer
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 3) { // Reduced for faster confirmation
      this.peakConfirmationBuffer.shift();
    }

    // Simplified peak confirmation for more reliability
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 2) { // Reduced for faster confirmation
        const len = this.peakConfirmationBuffer.length;
        
        // Only need one indicator of a peak for more sensitivity
        const goingDown = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        
        if (goingDown) {
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
      if (this.bpmHistory.length > 6) { // Reduced for faster adaptation
        this.bpmHistory.shift();
      }
      
      this.lastBpmUpdateTime = Date.now();
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    
    // Initialize smooth BPM
    if (this.smoothBPM === 0 && rawBPM > 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Apply exponential smoothing for stability
    if (rawBPM > 0) {
      this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Simple mean for faster response
    const sum = this.bpmHistory.reduce((a, b) => a + b, 0);
    return sum / this.bpmHistory.length;
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
    this.pendingBeepRequest = false;
    this.beepSuccessCount = 0;
    this.lastBeepRequestTime = 0;
    this.beepQueue = [];
    
    // Try to ensure audio context is active
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => {
          console.log("HeartBeatProcessor: Audio Context reactivated");
          this.prepareAudioSystem();
        })
        .catch(err => console.error("HeartBeatProcessor: Error reactivating Audio Context", err));
    } else {
      this.prepareAudioSystem();
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
