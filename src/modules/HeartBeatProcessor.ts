
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 40; // Increased from 30 for better sampling
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40; 
  private readonly MAX_BPM = 190;
  private readonly SIGNAL_THRESHOLD = 0.22; // Reduced from 0.28 for better sensitivity
  private readonly MIN_CONFIDENCE = 0.55; // Reduced from 0.60 for better detection
  private readonly DERIVATIVE_THRESHOLD = -0.018; // Less restrictive (was -0.020)
  private readonly MIN_PEAK_TIME_MS = 300; // Reduced from 330 for better detection
  private readonly WARMUP_TIME_MS = 1500; // Reduced from 2500 for faster detection

  // Parámetros de filtrado - ajustados para mejor detección
  private readonly MEDIAN_FILTER_WINDOW = 5;
  private readonly MOVING_AVERAGE_WINDOW = 5;
  private readonly EMA_ALPHA = 0.45; // Increased from 0.40 for faster response
  private readonly BASELINE_FACTOR = 0.94; // Changed from 0.96 for faster baseline adaptation

  // Parámetros de beep - aumentados para mejor retroalimentación auditiva
  private readonly BEEP_PRIMARY_FREQUENCY = 1320; // Increased from 1200 for better audibility
  private readonly BEEP_SECONDARY_FREQUENCY = 660; // Increased from 600 for better audibility
  private readonly BEEP_DURATION = 120; // Increased from 100 for longer beep
  private readonly BEEP_VOLUME = 1.0; // Maximum volume
  private readonly MIN_BEEP_INTERVAL_MS = 250; // Reduced from 280

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.018; // Reduced from 0.022 for earlier reset
  private readonly LOW_SIGNAL_FRAMES = 10; // Reduced from 12 for faster response
  private lowSignalCount = 0;

  // Parameters for improved BPM calculation
  private readonly BPM_HISTORY_SIZE = 12;
  private readonly BPM_OUTLIER_THRESHOLD = 15; // Reduced from 18 for stricter filtering
  private readonly BPM_ALPHA = 0.25; // Increased from 0.20 for faster adaptation
  private readonly REQUIRED_STABLE_READINGS = 3; // Number of stable readings required

  // ─────────── PEAK AMPLIFICATION SETTINGS ───────────
  private readonly PEAK_AMPLIFICATION_FACTOR = 1.8; // Increased from 1.4
  private readonly PEAK_AMPLIFICATION_THRESHOLD = 0.01; // New threshold for when to apply amplification

  // Variables internas
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  
  // Variables for improved BPM stability
  private consecutiveValidIntervals: number = 0;
  private lastValidBPM: number = 0;
  private consistentBpmCounter: number = 0;
  private stableReadingsCount: number = 0;
  
  // New variables for peak tracking
  private peakCount: number = 0;
  private validPeakCount: number = 0;
  private lastAmplifiedPeakTime: number = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      // Initialize with a test beep at very low volume to load audio context
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    // Only play beep if we have at least 3 valid peaks detected
    if (this.validPeakCount < 3) {
      console.log("HeartBeatProcessor: Skipping beep - not enough valid peaks yet", {
        validPeakCount: this.validPeakCount
      });
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      // Create a more complex and audible beep sound
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();

      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();
      
      const tertiaryOscillator = this.audioContext.createOscillator();
      const tertiaryGain = this.audioContext.createGain();
      
      // Add a fourth oscillator for more clarity
      const quaternaryOscillator = this.audioContext.createOscillator();
      const quaternaryGain = this.audioContext.createGain();

      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.BEEP_SECONDARY_FREQUENCY,
        this.audioContext.currentTime
      );
      
      tertiaryOscillator.type = "triangle";
      tertiaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY / 2,
        this.audioContext.currentTime
      );
      
      quaternaryOscillator.type = "square";
      quaternaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY * 1.5,
        this.audioContext.currentTime
      );

      // Faster attack for primary sound
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume * 1.0,
        this.audioContext.currentTime + 0.003 // Faster attack (was 0.005)
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Secondary sound with slightly slower attack
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.6, // Increased from 0.5 for more volume
        this.audioContext.currentTime + 0.005
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );
      
      // Tertiary sound for body
      tertiaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      tertiaryGain.gain.linearRampToValueAtTime(
        volume * 0.5, // Increased from 0.4
        this.audioContext.currentTime + 0.008
      );
      tertiaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02
      );
      
      // Quaternary sound for clarity/accent (very subtle!)
      quaternaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      quaternaryGain.gain.linearRampToValueAtTime(
        volume * 0.15, // Very low volume since it's a square wave
        this.audioContext.currentTime + 0.002 // Fast attack
      );
      quaternaryGain.gain.exponentialRampToValueAtTime(
        0.005, // Lower end value for faster decay
        this.audioContext.currentTime + this.BEEP_DURATION / 800 // Shorter duration
      );

      // Improved compressor settings for better sound
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-20, this.audioContext.currentTime); // Less compression (was -24)
      compressor.knee.setValueAtTime(25, this.audioContext.currentTime); // Softer knee (was 30)
      compressor.ratio.setValueAtTime(10, this.audioContext.currentTime); // Lower ratio (was 12)
      compressor.attack.setValueAtTime(0.002, this.audioContext.currentTime); // Faster attack (was 0.003)
      compressor.release.setValueAtTime(0.2, this.audioContext.currentTime); // Faster release (was 0.25)

      // Add a slight reverb effect for richer sound
      const convolver = this.audioContext.createConvolver();
      const reverbTime = 0.1; // Very short reverb
      const sampleRate = this.audioContext.sampleRate;
      const reverbBuffer = this.audioContext.createBuffer(
        2, // Stereo
        sampleRate * reverbTime,
        sampleRate
      );
      
      // Create simple impulse response
      for (let channel = 0; channel < 2; channel++) {
        const channelData = reverbBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.05));
        }
      }
      convolver.buffer = reverbBuffer;

      // Connect all oscillators to their respective gain nodes
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      tertiaryOscillator.connect(tertiaryGain);
      quaternaryOscillator.connect(quaternaryGain);
      
      // Connect gain nodes to effects chain
      primaryGain.connect(compressor);
      secondaryGain.connect(compressor);
      tertiaryGain.connect(compressor);
      quaternaryGain.connect(compressor);
      
      // Connect compressor to reverb and then to output
      compressor.connect(convolver);
      convolver.connect(this.audioContext.destination);
      compressor.connect(this.audioContext.destination); // Direct connection for clarity

      // Start and stop all oscillators
      primaryOscillator.start();
      secondaryOscillator.start();
      tertiaryOscillator.start();
      quaternaryOscillator.start();

      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      tertiaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.07);
      quaternaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.03);

      this.lastBeepTime = now;
      
      console.log("HeartBeatProcessor: Beep played successfully", {
        volume,
        peakCount: this.peakCount,
        validPeakCount: this.validPeakCount
      });
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
    }
  }

  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  private medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  private calculateEMA(value: number): number {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
  } {
    // Apply enhanced multi-stage filtering for better noise reduction
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Apply dynamic signal amplification to enhance peaks
    const amplifiedValue = this.amplifyPeaks(smoothed);
    
    // Store signal in buffer for analysis
    this.signalBuffer.push(amplifiedValue);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Not enough data for analysis yet
    if (this.signalBuffer.length < 20) { // Reduced from 25 to start analyzing sooner
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: amplifiedValue,
        arrhythmiaCount: 0
      };
    }

    // Improved baseline tracking with adaptive factor
    if (this.baseline === 0) {
      this.baseline = amplifiedValue;
    } else {
      // Use faster adaptation during initial phase
      const adaptationFactor = this.signalBuffer.length < 30 ? 
                               0.93 : this.BASELINE_FACTOR; // Faster adaptation (was 0.94/0.96)
      this.baseline = this.baseline * adaptationFactor + amplifiedValue * (1 - adaptationFactor);
    }

    const normalizedValue = amplifiedValue - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Improved derivative calculation using window approach
    this.values.push(amplifiedValue);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = amplifiedValue - this.lastValue;
    if (this.values.length === 3) {
      // Enhanced center difference formula for better derivative approximation
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = amplifiedValue;

    // Enhanced peak detection with adaptive thresholds
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak) {
      this.peakCount++;
      
      // Consider it a valid peak if confidence is good
      if (confidence >= 0.6) {
        this.validPeakCount = Math.min(10, this.validPeakCount + 1);
      }
      
      if (!this.isInWarmup() && confidence >= 0.5) {
        const now = Date.now();
        const timeSinceLastPeak = this.lastPeakTime
          ? now - this.lastPeakTime
          : Number.MAX_VALUE;

        if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          
          // Volume proportional to confidence (and higher overall)
          const beepVolume = Math.min(1.0, Math.max(0.7, confidence * 1.1));
          this.playBeep(beepVolume);
          
          this.updateBPM();
        }
      }
    } else if (confidence < 0.3) {
      // Gradually decrease valid peak count when confidence is low
      this.validPeakCount = Math.max(0, this.validPeakCount - 0.1);
    }

    // Get smoothed BPM with confidence-based weighting
    const currentBPM = this.getSmoothBPM();
    
    return {
      bpm: Math.round(currentBPM),
      confidence: confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: amplifiedValue,
      arrhythmiaCount: 0
    };
  }
  
  // Enhanced peak amplification with dynamic factors
  private amplifyPeaks(value: number): number {
    // If we don't have enough data for baseline, don't amplify
    if (this.baseline === 0) return value;
    
    // Calculate difference from baseline
    const diff = value - this.baseline;
    
    // Only amplify when value is above baseline (potential peaks)
    if (diff > this.PEAK_AMPLIFICATION_THRESHOLD) {
      // Non-linear amplification: more amplification for larger differences
      const now = Date.now();
      const timeSinceLastAmplifiedPeak = now - this.lastAmplifiedPeakTime;
      
      // Dynamic amplification factor based on time since last peak
      let dynamicFactor = this.PEAK_AMPLIFICATION_FACTOR;
      
      // Increase amplification if it's been a while since last peak
      if (this.lastPeakTime && timeSinceLastAmplifiedPeak > 500) {
        dynamicFactor = Math.min(2.5, this.PEAK_AMPLIFICATION_FACTOR * 
                       (1 + (timeSinceLastAmplifiedPeak - 500) / 2000));
      }
      
      // Progressive amplification based on signal magnitude
      const amplification = Math.min(dynamicFactor, 
                                   1.0 + (Math.abs(diff) * 4));
                                   
      // Apply amplification
      const amplifiedValue = this.baseline + (diff * amplification);
      
      // Record time of amplification
      this.lastAmplifiedPeakTime = now;
      
      return amplifiedValue;
    }
    
    return value;
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      // Decrement counter more gradually to prevent rapid toggling
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 0.5);
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    this.consecutiveValidIntervals = 0;
    this.consistentBpmCounter = 0;
    this.validPeakCount = 0;
    this.peakCount = 0;
    this.stableReadingsCount = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // Refractory period check - don't detect peaks too close together
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Dynamic threshold based on signal history and stability
    const dynamicThreshold = this.bpmHistory.length > 0 ? 
                            this.SIGNAL_THRESHOLD * (1.0 - Math.min(0.4, this.consistentBpmCounter / 15)) :
                            this.SIGNAL_THRESHOLD;
    
    // More adaptive derivative threshold based on signal quality
    const adaptiveDerivativeThreshold = this.validPeakCount > 5 ? 
                                      this.DERIVATIVE_THRESHOLD * 1.1 : 
                                      this.DERIVATIVE_THRESHOLD;
    
    const isOverThreshold =
      derivative < adaptiveDerivativeThreshold &&
      normalizedValue > dynamicThreshold &&
      this.lastValue > this.baseline * 0.92; // Less restrictive (was 0.95)

    // Enhanced confidence calculation
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (dynamicThreshold * 1.2), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(adaptiveDerivativeThreshold * 0.6), 0),
      1
    );
    
    // Improved timing factor with expected heart rate adjustment
    let timingConfidence = 1.0;
    if (this.lastPeakTime && this.previousPeakTime) {
      const expectedInterval = (this.lastPeakTime - this.previousPeakTime);
      const expectedNextPeak = this.lastPeakTime + expectedInterval;
      const deviation = Math.abs(now - expectedNextPeak);
      
      // Use a variable tolerance based on signal stability
      const toleranceFactor = this.validPeakCount > 5 ? 0.5 : 0.6;
      if (deviation > expectedInterval * toleranceFactor) {
        timingConfidence = Math.max(0.5, 1 - deviation / (expectedInterval * 1.5));
      }
    }

    // Apply historical confidence boost if we have valid peaks
    const historyBoost = this.validPeakCount > 3 ? Math.min(0.15, this.validPeakCount * 0.02) : 0;

    // Calculate weighted confidence with emphasis on amplitude
    const confidence = (amplitudeConfidence * 0.6 + 
                      derivativeConfidence * 0.3 + 
                      timingConfidence * 0.1) + historyBoost;

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Update peak confirmation buffer
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Calculate average buffer value for stability
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / 
                      this.peakConfirmationBuffer.length;
    
    // Enhanced peak confirmation with adaptive confidence threshold
    const dynamicConfidence = this.validPeakCount >= 4 ? 
                             this.MIN_CONFIDENCE * 0.8 : // Easier threshold once we have established peaks
                             this.MIN_CONFIDENCE;
    
    if (isPeak && !this.lastConfirmedPeak && confidence >= dynamicConfidence && 
        avgBuffer > this.SIGNAL_THRESHOLD * 0.8) { // Less restrictive threshold (was 0.85)
      
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Check if we're past the peak (values going down)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        
        // More relaxed second condition for early peaks
        const goingDown2 = len >= 3 && 
                         (this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3] || 
                          this.bpmHistory.length < 2);
        
        if (goingDown1 && (goingDown2 || this.validPeakCount > 3)) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    
    return false;
  }

  private updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Improved BPM validation with stricter physiological limits
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      // Enhanced outlier detection
      let isOutlier = false;
      
      if (this.bpmHistory.length > 3) {
        // Calculate median of recent values for outlier detection
        const recentBpms = [...this.bpmHistory].slice(-3);
        recentBpms.sort((a, b) => a - b);
        const medianBPM = recentBpms[Math.floor(recentBpms.length / 2)];
        
        // Mark as outlier if it deviates too much from recent median
        if (Math.abs(instantBPM - medianBPM) > this.BPM_OUTLIER_THRESHOLD) {
          isOutlier = true;
          console.log("HeartBeatProcessor: BPM outlier rejected", {
            instantBPM,
            medianBPM,
            difference: Math.abs(instantBPM - medianBPM)
          });
        }
      }
      
      if (!isOutlier) {
        this.bpmHistory.push(instantBPM);
        if (this.bpmHistory.length > this.BPM_HISTORY_SIZE) {
          this.bpmHistory.shift();
        }
        
        // Track consecutive valid intervals for stability assessment
        this.consecutiveValidIntervals++;
        this.lastValidBPM = instantBPM;
        
        // Update stable readings count if the BPM is consistent
        if (this.bpmHistory.length >= 2) {
          const lastTwo = this.bpmHistory.slice(-2);
          if (Math.abs(lastTwo[0] - lastTwo[1]) < 8) {
            this.stableReadingsCount = Math.min(
              this.REQUIRED_STABLE_READINGS, 
              this.stableReadingsCount + 1
            );
          } else {
            this.stableReadingsCount = Math.max(0, this.stableReadingsCount - 1);
          }
        }
      }
    } else {
      // Reset consecutive counter on invalid values
      this.consecutiveValidIntervals = 0;
      console.log("HeartBeatProcessor: Invalid BPM rejected", { instantBPM });
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    
    // Handle no data case
    if (rawBPM === 0) {
      return this.smoothBPM > 0 ? this.smoothBPM * 0.95 : 0; // Gradual decay if no new data
    }
    
    // Initialize smooth BPM if needed
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Check for significant jumps that might indicate errors
    const bpmDifference = Math.abs(rawBPM - this.smoothBPM);
    
    // Return 0 if we don't have stable readings yet
    if (this.stableReadingsCount < Math.min(2, this.bpmHistory.length / 3)) {
      return 0;
    }
    
    if (bpmDifference > 12 && this.smoothBPM > 0) {
      // For large changes, adapt more gradually to prevent jumps
      this.smoothBPM = this.smoothBPM + (Math.sign(rawBPM - this.smoothBPM) * 
                       Math.min(bpmDifference * 0.15, 3));
      
      // Log significant changes for debugging
      console.log("HeartBeatProcessor: Large BPM change detected", {
        raw: rawBPM,
        smooth: this.smoothBPM,
        difference: bpmDifference
      });
    } else {
      // Normal smoothing for small changes
      this.smoothBPM =
        this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
      
      // Increment consistency counter if values are close
      if (bpmDifference < 4) { // Tighter threshold (was 5)
        this.consistentBpmCounter = Math.min(10, this.consistentBpmCounter + 1);
      } else {
        this.consistentBpmCounter = Math.max(0, this.consistentBpmCounter - 1);
      }
    }
    
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Improved statistical analysis with weighted recent values
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Dynamic trimming based on history size
    let trimAmount = Math.floor(sorted.length * 0.1); // 10% trim (was 15%)
    trimAmount = Math.min(Math.max(trimAmount, 1), 2); // At least 1, at most 2 (was 3)
    
    // Trim both ends to remove outliers
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (!trimmed.length) return 0;
    
    // Use weighted average giving more weight to recent values
    let weightedSum = 0;
    let weightTotal = 0;
    
    for (let i = 0; i < trimmed.length; i++) {
      const weight = i + 1; // More recent values get higher weight
      weightedSum += trimmed[i] * weight;
      weightTotal += weight;
    }
    
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 4) { // Reduced from 5 for earlier results
      return 0;
    }
    
    // More robust final BPM calculation
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.floor(sorted.length * 0.1); // Reduced trim (was 0.1)
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) return 0;
    
    // Weighted average favoring recent values
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < finalSet.length; i++) {
      // Give more weight to recent values (which are later in the array)
      const weight = Math.pow(i + 1, 1.2); // Exponential weighting
      weightedSum += finalSet[i] * weight;
      totalWeight += weight;
    }
    
    const avgBPM = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Only return a value if we have sufficient stable readings
    if (this.stableReadingsCount < 2 && this.bpmHistory.length < 8) {
      return 0;
    }
    
    return Math.round(avgBPM);
  }

  public reset() {
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
    this.consecutiveValidIntervals = 0;
    this.consistentBpmCounter = 0;
    this.peakCount = 0;
    this.validPeakCount = 0;
    this.stableReadingsCount = 0;
    this.lastAmplifiedPeakTime = 0;
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
