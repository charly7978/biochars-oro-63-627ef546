export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40; // Adjusted lower limit for better detection
  private readonly MAX_BPM = 190; // Reduced from 200 to avoid unrealistic values
  private readonly SIGNAL_THRESHOLD = 0.28; // Reducido de 0.35 para mejor sensibilidad
  private readonly MIN_CONFIDENCE = 0.60; // Reduced from 0.65 for better detection
  private readonly DERIVATIVE_THRESHOLD = -0.020; // Menos restrictivo (antes: -0.025)
  private readonly MIN_PEAK_TIME_MS = 330; // Reducido de 350 para mejor detección de taquicardia
  private readonly WARMUP_TIME_MS = 2500; // Reducido de 3000 para iniciar antes la detección

  // Parámetros de filtrado - ajustados para mejor detección
  private readonly MEDIAN_FILTER_WINDOW = 5;
  private readonly MOVING_AVERAGE_WINDOW = 5;
  private readonly EMA_ALPHA = 0.40; // Increased from 0.35 for faster response
  private readonly BASELINE_FACTOR = 0.96; // Changed from 0.98 for better baseline tracking

  // Parámetros de beep - aumentados para mejor retroalimentación auditiva
  private readonly BEEP_PRIMARY_FREQUENCY = 1200; // Aumentado de 880 para mejor audibilidad
  private readonly BEEP_SECONDARY_FREQUENCY = 600; // Aumentado de 440 para mejor audibilidad
  private readonly BEEP_DURATION = 100; // Aumentado de 80 para beep más largo
  private readonly BEEP_VOLUME = 1.0; // Aumentado al máximo desde 0.9
  private readonly MIN_BEEP_INTERVAL_MS = 280; // Reducido ligeramente de 300

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.022; // Reduced from 0.025 for earlier reset
  private readonly LOW_SIGNAL_FRAMES = 12;
  private lowSignalCount = 0;

  // Parameters for improved BPM calculation
  private readonly BPM_HISTORY_SIZE = 12; // Reduced from 15 for faster adaptability
  private readonly BPM_OUTLIER_THRESHOLD = 18; // Reduced from 20 for stricter filtering
  private readonly BPM_ALPHA = 0.20; // Increased from 0.15 for faster adaptation

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
  
  // New variables for improved BPM stability
  private consecutiveValidIntervals: number = 0;
  private lastValidBPM: number = 0;
  private consistentBpmCounter: number = 0;
  
  // Nueva variable para amplificación dinámica
  private readonly PEAK_AMPLIFICATION_FACTOR = 1.4; // Factor para amplificar picos

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      // Inicializar con un beep de prueba muy bajo para cargar el contexto de audio
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();

      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();
      
      // Tercer oscilador para añadir cuerpo al sonido
      const tertiaryOscillator = this.audioContext.createOscillator();
      const tertiaryGain = this.audioContext.createGain();

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
      
      tertiaryOscillator.type = "triangle"; // Tono más rico con forma de onda triangular
      tertiaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY / 2,
        this.audioContext.currentTime
      );

      // Envelope del sonido principal - ataque más rápido
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume * 1.0, // Máximo volumen
        this.audioContext.currentTime + 0.005 // Ataque más rápido (antes: 0.01)
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envelope del sonido secundario - ligeramente más suave
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.5, // Aumentado de 0.3 para mayor volumen
        this.audioContext.currentTime + 0.008
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );
      
      // Envelope del sonido terciario - da cuerpo al beep
      tertiaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      tertiaryGain.gain.linearRampToValueAtTime(
        volume * 0.4,
        this.audioContext.currentTime + 0.01
      );
      tertiaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02
      );

      // Compressor para evitar distorsión y aumentar volumen percibido
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
      compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      tertiaryOscillator.connect(tertiaryGain);
      
      primaryGain.connect(compressor);
      secondaryGain.connect(compressor);
      tertiaryGain.connect(compressor);
      
      compressor.connect(this.audioContext.destination);

      primaryOscillator.start();
      secondaryOscillator.start();
      tertiaryOscillator.start();

      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      tertiaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.07);

      this.lastBeepTime = now;
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
    // Enhanced multi-stage filtering for better noise reduction
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Aplicamos amplificación para resaltar picos
    const amplifiedValue = this.amplifyPeaks(smoothed);
    
    this.signalBuffer.push(amplifiedValue);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Not enough data for analysis yet
    if (this.signalBuffer.length < 25) { // Reducido de 30 para comenzar antes
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
      const adaptationFactor = this.signalBuffer.length < 40 ? 
                               0.96 : this.BASELINE_FACTOR; // Ligeramente más rápido
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
      // Center difference formula for better derivative approximation
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = amplifiedValue;

    // Enhanced peak detection with adaptive thresholds
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Solo sonamos el beep si es un pico confirmado y tenemos suficiente confianza
    if (isConfirmedPeak && !this.isInWarmup() && confidence >= 0.5) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Volumen proporcional a la confianza para dar feedback
        const beepVolume = Math.min(1.0, Math.max(0.5, confidence));
        this.playBeep(beepVolume);
        
        this.updateBPM();
      }
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
  
  // Nuevo método para amplificar picos
  private amplifyPeaks(value: number): number {
    // Si no tenemos suficientes datos para calcular baseline, no amplificamos
    if (this.baseline === 0) return value;
    
    // Calculamos la diferencia desde el baseline
    const diff = value - this.baseline;
    
    // Solo amplificamos cuando el valor está por encima del baseline (posibles picos)
    if (diff > 0) {
      // Amplificación no lineal: más amplificación para diferencias mayores
      const amplification = Math.min(this.PEAK_AMPLIFICATION_FACTOR, 
                                    1.0 + (Math.abs(diff) * 2));
      return this.baseline + (diff * amplification);
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

    // Improved peak detection criteria with adaptation basada en historial
    const dynamicThreshold = this.bpmHistory.length > 0 ? 
                            this.SIGNAL_THRESHOLD * (1.0 - Math.min(0.3, this.consistentBpmCounter / 20)) :
                            this.SIGNAL_THRESHOLD;
    
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > dynamicThreshold &&
      this.lastValue > this.baseline * 0.95; // Menos restrictivo (antes: 0.98)

    // More nuanced confidence calculation based on amplitude and derivative
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (dynamicThreshold * 1.3), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );
    
    // Add timing factor - penalize peaks that come too soon or too late
    let timingConfidence = 1.0;
    if (this.lastPeakTime && this.previousPeakTime) {
      const expectedInterval = (this.lastPeakTime - this.previousPeakTime);
      const expectedNextPeak = this.lastPeakTime + expectedInterval;
      const deviation = Math.abs(now - expectedNextPeak);
      
      // Menos penalización por desviaciones temporales (toleramos más variabilidad)
      if (deviation > expectedInterval * 0.5) { // Antes: 0.4
        timingConfidence = Math.max(0.6, 1 - deviation / (expectedInterval * 1.4)); // Menos penalización
      }
    }

    // Calculate weighted confidence - mayor peso para la amplitud
    const confidence = (amplitudeConfidence * 0.55 + derivativeConfidence * 0.35 + timingConfidence * 0.1);

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
    
    // Enhanced peak confirmation logic with multiple criteria
    const minConfidence = this.bpmHistory.length >= 5 ? this.MIN_CONFIDENCE * 0.9 : this.MIN_CONFIDENCE;
    
    if (isPeak && !this.lastConfirmedPeak && confidence >= minConfidence && 
        avgBuffer > this.SIGNAL_THRESHOLD * 0.85) { // Menos restrictivo (antes: 0.9)
      
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Check if we're past the peak (values going down)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = len >= 3 && this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];
        
        if (goingDown1 && (goingDown2 || this.bpmHistory.length < 3)) {
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
      // Check for outliers compared to previous values
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
    
    if (bpmDifference > 15 && this.smoothBPM > 0) {
      // For large changes, adapt more slowly to prevent jumps
      this.smoothBPM = this.smoothBPM + (Math.sign(rawBPM - this.smoothBPM) * 
                       Math.min(bpmDifference * 0.1, 2));
      
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
      if (bpmDifference < 5) {
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
    
    // Copy and sort BPM history for robust statistical analysis
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Improved outlier rejection - remove more extreme values in larger datasets
    let trimAmount = Math.floor(sorted.length * 0.15); // 15% trim
    trimAmount = Math.min(Math.max(trimAmount, 1), 3); // At least 1, at most 3
    
    // Trim both ends to remove outliers
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (!trimmed.length) return 0;
    
    // Calculate mean of trimmed array
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    
    return avg;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 5) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    if (!finalSet.length) return 0;
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
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
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
