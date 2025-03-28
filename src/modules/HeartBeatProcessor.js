
export class HeartBeatProcessor {
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.60;
  MIN_CONFIDENCE = 0.50;
  DERIVATIVE_THRESHOLD = -0.03;
  MIN_PEAK_TIME_MS = 300;
  WARMUP_TIME_MS = 2000;

  MEDIAN_FILTER_WINDOW = 3;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.3;
  BASELINE_FACTOR = 0.995;

  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 80;
  BEEP_VOLUME = 0.8;
  MIN_BEEP_INTERVAL_MS = 250;

  LOW_SIGNAL_THRESHOLD = 0.05; // Increased threshold for signal detection
  LOW_SIGNAL_FRAMES = 10;
  lowSignalCount = 0;

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
  isMonitoring = false; // Monitoring flag to prevent beeps when not measuring
  arrhythmiaCounter = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
    console.log("HeartBeatProcessor: New instance created");
  }

  async initAudio() {
    try {
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        console.log("HeartBeatProcessor: New audio context initialized, state:", this.audioContext.state);
        
        // Prepare audio system with a silent beep
        await this.playBeep(0.01);
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = 0.7) {
    // Don't play beeps if not monitoring
    if (!this.isMonitoring) {
      console.log("HeartBeatProcessor: Beep requested but monitoring is off");
      return false;
    }
    
    try {
      if (!this.audioContext) {
        await this.initAudio();
      }
      
      if (this.audioContext && this.audioContext.state === "running") {
        const time = this.audioContext.currentTime;
        
        // Create oscillator for the beep
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(this.BEEP_PRIMARY_FREQUENCY, time);
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, time + this.BEEP_DURATION/1000);
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start and stop the beep
        oscillator.start(time);
        oscillator.stop(time + this.BEEP_DURATION/1000 + 0.05);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
      return false;
    }
  }
  
  setMonitoring(isActive) {
    this.isMonitoring = isActive;
    console.log("HeartBeatProcessor: Monitoring state set to", isActive);
  }

  processSignal(value) {
    // Update signal buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Simple noise detection - ignore tiny fluctuations that are likely noise
    if (Math.abs(value) < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount > this.LOW_SIGNAL_FRAMES) {
        // Signal is too weak, probably no finger
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false
        };
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1);
    }
    
    // Apply filters
    const filtered = this.applyFilters(value);
    
    // Update baseline
    if (this.baseline === 0) {
      this.baseline = filtered;
    } else {
      this.baseline = this.baseline * this.BASELINE_FACTOR + filtered * (1 - this.BASELINE_FACTOR);
    }
    
    // Calculate derivative to detect peaks
    const derivative = filtered - this.lastValue;
    this.lastValue = filtered;
    
    // Find peaks
    let isPeak = false;
    const now = Date.now();
    
    // Only consider peaks if:
    // 1. We have enough data
    // 2. Derivative changes from positive to negative
    // 3. Signal is above threshold
    // 4. Enough time has passed since last peak
    if (
      this.signalBuffer.length > 5 &&
      derivative < this.DERIVATIVE_THRESHOLD &&
      filtered > this.baseline + this.SIGNAL_THRESHOLD &&
      (this.lastPeakTime === null || now - this.lastPeakTime > this.MIN_PEAK_TIME_MS)
    ) {
      isPeak = true;
      this.lastPeakTime = now;
      
      // Calculate BPM from peak
      if (this.previousPeakTime !== null) {
        const interval = now - this.previousPeakTime;
        const instantBPM = 60000 / interval;
        
        // Only accept physiologically possible BPM values
        if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
          this.bpmHistory.push(instantBPM);
          
          // Limit history size
          if (this.bpmHistory.length > 5) {
            this.bpmHistory.shift();
          }
          
          // Calculate smoothed BPM with outlier rejection
          if (this.bpmHistory.length >= 3) {
            // Sort values to find median
            const sortedBPM = [...this.bpmHistory].sort((a, b) => a - b);
            const medianBPM = sortedBPM[Math.floor(sortedBPM.length / 2)];
            
            // Filter out outliers from the average calculation
            const validBPMs = this.bpmHistory.filter(
              bpm => Math.abs(bpm - medianBPM) < medianBPM * 0.3
            );
            
            if (validBPMs.length > 0) {
              const avgBPM = validBPMs.reduce((sum, bpm) => sum + bpm, 0) / validBPMs.length;
              
              // Apply EMA for smoothing
              if (this.smoothBPM === 0) {
                this.smoothBPM = avgBPM;
              } else {
                this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + avgBPM * this.BPM_ALPHA;
              }
            }
          }
        }
      }
      
      this.previousPeakTime = now;
    }
    
    // Calculate confidence
    let confidence = 0;
    
    if (this.signalBuffer.length > 10) {
      // Use amplitude as a measure of signal strength
      const min = Math.min(...this.signalBuffer.slice(-10));
      const max = Math.max(...this.signalBuffer.slice(-10));
      const amplitude = max - min;
      
      // Calculate normalized amplitude-based confidence
      const ampConfidence = Math.min(1, amplitude / 2);
      
      // Calculate BPM stability confidence
      let stabilityConfidence = 0;
      if (this.bpmHistory.length >= 3) {
        const maxBPM = Math.max(...this.bpmHistory);
        const minBPM = Math.min(...this.bpmHistory);
        const bpmRange = maxBPM - minBPM;
        const avgBPM = this.bpmHistory.reduce((sum, bpm) => sum + bpm, 0) / this.bpmHistory.length;
        
        stabilityConfidence = Math.max(0, 1 - bpmRange / (avgBPM * 0.5));
      }
      
      // Calculate overall confidence - heavily weight signal quality
      confidence = ampConfidence * 0.7 + (stabilityConfidence || 0) * 0.3;
      
      // Apply time-based confidence factor
      const timeSinceStart = now - this.startTime;
      const warmupFactor = Math.min(1, timeSinceStart / this.WARMUP_TIME_MS);
      confidence *= warmupFactor;
    }
    
    return {
      bpm: Math.round(this.smoothBPM),
      confidence,
      isPeak
    };
  }
  
  applyFilters(value) {
    // Apply median filter
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    
    const medianValue = this.calculateMedian([...this.medianBuffer]);
    
    // Apply moving average
    this.movingAverageBuffer.push(medianValue);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    
    const movingAverage = this.movingAverageBuffer.reduce((sum, val) => sum + val, 0) / 
                          this.movingAverageBuffer.length;
    
    return movingAverage;
  }
  
  calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
  
  getRRIntervals() {
    if (this.bpmHistory.length < 2) {
      return {
        intervals: [],
        lastPeakTime: this.lastPeakTime
      };
    }
    
    // Calculate RR intervals from BPM history
    const intervals = this.bpmHistory.map(bpm => Math.round(60000 / bpm));
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
  
  getArrhythmiaCounter() {
    return this.arrhythmiaCounter;
  }
  
  reset() {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.smoothedValue = 0;
    this.lastBeepTime = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.bpmHistory = [];
    this.baseline = 0;
    this.lastValue = 0;
    this.values = [];
    this.startTime = Date.now();
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    console.log("HeartBeatProcessor: Reset complete");
  }
}
