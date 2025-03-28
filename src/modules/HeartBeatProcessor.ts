import { 
  KalmanFilter, 
  applyMedianFilter, 
  applySMAFilter, 
  applyEMAFilter,
  calculateBPMFromIntervals
} from '../utils/signalProcessingUtils';

export class HeartBeatProcessor {
  // Constants
  readonly SAMPLE_RATE = 30;
  readonly WINDOW_SIZE = 60;
  readonly MIN_BPM = 40;
  readonly MAX_BPM = 200;
  readonly SIGNAL_THRESHOLD = 0.60;
  readonly MIN_CONFIDENCE = 0.50;
  readonly DERIVATIVE_THRESHOLD = -0.03;
  readonly MIN_PEAK_TIME_MS = 400;
  readonly WARMUP_TIME_MS = 3000;

  readonly MEDIAN_FILTER_WINDOW = 3;
  readonly MOVING_AVERAGE_WINDOW = 5;
  readonly EMA_ALPHA = 0.3;
  readonly BASELINE_FACTOR = 0.995;

  readonly BEEP_PRIMARY_FREQUENCY = 880;
  readonly BEEP_SECONDARY_FREQUENCY = 440;
  readonly BEEP_DURATION = 100;
  readonly BEEP_VOLUME = 0.7;
  readonly MIN_BEEP_INTERVAL_MS = 300;

  readonly LOW_SIGNAL_THRESHOLD = 0.03;
  readonly LOW_SIGNAL_FRAMES = 10;
  
  // State variables
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private lastBeepTime: number = 0;
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
  private readonly BPM_ALPHA = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private lowSignalCount: number = 0;
  
  // Filter instances
  private kalmanFilter: KalmanFilter = new KalmanFilter();

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  /**
   * Initialize audio context for heart beat sound
   */
  async initAudio(): Promise<void> {
    try {
      // Usamos window.AudioContext para asegurar la compatibilidad con diferentes navegadores
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        console.error("HeartBeatProcessor: AudioContext no está soportado en este navegador");
        return;
      }
      
      this.audioContext = new AudioContextClass();
      
      // Intentamos reanudar el contexto de audio inmediatamente (útil para algunos navegadores)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Reproducimos un beep silencioso para inicializar el sistema de audio
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized", {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        timestamp: new Date().toISOString()
      });
      
      // Agregar manejadores de eventos para asegurar que el audio funcione después de la interacción del usuario
      const unlockAudio = async () => {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log("HeartBeatProcessor: Audio Context resumed after user interaction");
        }
      };
      
      document.addEventListener('touchstart', unlockAudio, { once: true });
      document.addEventListener('mousedown', unlockAudio, { once: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
      
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  /**
   * Play a beep sound for heart beat
   */
  async playBeep(volume: number = this.BEEP_VOLUME): Promise<void> {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      // Verificar y reanudar el contexto de audio si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Crear osciladores y nodos de ganancia
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configurar frecuencias
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

      // Configurar envolventes de ganancia
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.3,
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conectar los nodos
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Iniciar y detener los osciladores
      primaryOscillator.start();
      secondaryOscillator.start();
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);

      // Actualizar el tiempo del último beep
      this.lastBeepTime = now;
      
      console.log("HeartBeatProcessor: Beep played", {
        volume,
        timestamp: new Date().toISOString(),
        audioContextState: this.audioContext.state
      });
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
    }
  }

  /**
   * Check if we're in warmup period
   */
  isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  /**
   * Apply median filter to input signal
   */
  medianFilter(value: number): number {
    const result = applyMedianFilter(value, this.medianBuffer, this.MEDIAN_FILTER_WINDOW);
    this.medianBuffer = result.updatedBuffer;
    return result.filteredValue;
  }

  /**
   * Apply moving average filter
   */
  calculateMovingAverage(value: number): number {
    const result = applySMAFilter(value, this.movingAverageBuffer, this.MOVING_AVERAGE_WINDOW);
    this.movingAverageBuffer = result.updatedBuffer;
    return result.filteredValue;
  }

  /**
   * Apply exponential moving average
   */
  calculateEMA(value: number): number {
    this.smoothedValue = applyEMAFilter(value, this.smoothedValue, this.EMA_ALPHA);
    return this.smoothedValue;
  }

  /**
   * Process incoming signal value
   */
  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
    rrData?: { intervals: number[]; lastPeakTime: number | null };
  } {
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0,
        rrData: { intervals: [], lastPeakTime: null }
      };
    }

    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);
    let peakDetected = false;

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        this.playBeep(0.12).catch(err => {
          console.error("Error playing heartbeat sound:", err);
        });
        this.updateBPM();
        peakDetected = true;
      }
    }

    // Retornamos los datos de RR para el análisis de arritmias
    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: peakDetected,
      filteredValue: smoothed,
      arrhythmiaCount: 0,
      rrData: this.getRRIntervals()
    };
  }

  /**
   * Automatically reset detection state if signal is too low
   */
  autoResetIfSignalIsLow(amplitude: number): void {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  /**
   * Reset detection state variables
   */
  resetDetectionStates(): void {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  /**
   * Detect peaks in the heart beat signal
   */
  detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;

    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.8), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.8), 0),
      1
    );

    const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

    return { isPeak, confidence };
  }

  /**
   * Confirm peaks with additional analysis
   */
  confirmPeak(isPeak: boolean, normalizedValue: number, confidence: number): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        const goingDown1 =
          this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 =
          this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];

        if (goingDown1 && goingDown2) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }

    return false;
  }

  /**
   * Update BPM calculation when a new peak is detected
   */
  updateBPM(): void {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    }
  }

  /**
   * Get smoothed BPM value
   */
  getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  /**
   * Calculate current BPM from recent history
   */
  calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  /**
   * Get final BPM value (more robust calculation)
   */
  getFinalBPM(): number {
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

  /**
   * Reset processor state
   */
  reset(): void {
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
    this.kalmanFilter.reset();
    
    // Reinicializar el sistema de audio
    if (this.audioContext) {
      try {
        // Si el contexto está cerrado, creamos uno nuevo
        if (this.audioContext.state === 'closed') {
          this.initAudio();
        } 
        // Si está suspendido, intentamos reanudarlo
        else if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(err => {
            console.error("Error resuming audio context during reset:", err);
          });
        }
      } catch (err) {
        console.error("Error resetting audio system:", err);
      }
    }
  }

  /**
   * Get RR intervals data
   */
  getRRIntervals(): {
    intervals: number[];
    lastPeakTime: number | null;
  } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
