export class HeartBeatProcessor {
  // Parámetros de configuración optimizados para sincronización de beeps
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.24;        // Ajustado para mejor detección
  MIN_CONFIDENCE = 0.25;          // Aumentado para evitar falsos positivos
  DERIVATIVE_THRESHOLD = -0.012;  // Ajustado para capturar picos reales
  MIN_PEAK_TIME_MS = 300;         // Aumentado para evitar dobles detecciones
  WARMUP_TIME_MS = 500;           // Tiempo mínimo de calentamiento

  // Filtros de señal mejorados
  MEDIAN_FILTER_WINDOW = 5;       // Aumentado para mejor suavizado
  MOVING_AVERAGE_WINDOW = 7;      // Aumentado para estabilizar la señal
  EMA_ALPHA = 0.25;               // Reducido para suavizado más agresivo
  BASELINE_FACTOR = 0.995;        // Más lento seguimiento de línea base

  // Configuración del beep optimizada
  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 60;             // Duración más corta para mejor sincronización
  BEEP_VOLUME = 0.8;              // Volumen ajustado para mejor audibilidad
  MIN_BEEP_INTERVAL_MS = 300;     // Aumentado para evitar beeps demasiado cercanos

  // Parámetros de detección de señal baja
  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 15;
  lowSignalCount = 0;

  // Variables internas y estado
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
  BPM_ALPHA = 0.3;
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  lastProcessedPeakTime = 0;
  peakThresholdAdjuster = 1.0;    // Factor de ajuste dinámico
  stableDetectionCount = 0;       // Contador para detecciones estables

  constructor() {
    console.log("HeartBeatProcessor: Inicializando con parámetros optimizados para sincronización de beeps");
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      // Verificar si AudioContext está disponible
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
        await this.audioContext.resume();
        
        // Reproducir un beep de prueba para verificar funcionamiento
        await this.playBeep(0.1);
        
        console.log("HeartBeatProcessor: Audio Context inicializado correctamente", {
          sampleRate: this.audioContext?.sampleRate,
          state: this.audioContext?.state,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error("HeartBeatProcessor: AudioContext no está disponible en este navegador");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error inicializando audio", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Verificar si el contexto de audio está inicializado
    if (!this.audioContext) {
      await this.initAudio();
      if (!this.audioContext) return false;
    }

    const now = Date.now();
    // Verificación más estricta del intervalo entre beeps
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      console.log("HeartBeatProcessor: Beep ignorado - demasiado cercano al anterior", {
        timeSinceLastBeep: now - this.lastBeepTime,
        threshold: this.MIN_BEEP_INTERVAL_MS
      });
      return false;
    }

    try {
      // Optimización de creación de osciladores
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      // Usamos un solo oscilador para mejor precisión de timing
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Envolvente optimizada para mejor sincronización
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.003
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conexión y ejecución optimizada
      primaryOscillator.connect(primaryGain);
      primaryGain.connect(this.audioContext.destination);
      
      primaryOscillator.start();
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      
      // Actualizar tiempo del último beep
      this.lastBeepTime = now;
      console.log("HeartBeatProcessor: BEEP sincronizado", {
        time: new Date().toISOString(),
        bpm: this.getSmoothBPM()
      });
      
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error reproduciendo beep", err);
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
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 10) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    
    if (this.signalBuffer.length > 30) {
      const recentValues = this.signalBuffer.slice(-30);
      const minVal = Math.min(...recentValues);
      const maxVal = Math.max(...recentValues);
      const range = maxVal - minVal;
      
      if (range > 0.1) {
        this.peakThresholdAdjuster = Math.min(1.2, Math.max(0.8, range / 0.5));
      }
    }
    
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

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

    const adjustedThreshold = this.SIGNAL_THRESHOLD * this.peakThresholdAdjuster;
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative, adjustedThreshold);
    
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        const currentBPM = this.getSmoothBPM();
        let isValidPeak = true;
        
        if (currentBPM > 0 && timeSinceLastPeak < (60000 / (currentBPM * 1.3))) {
          isValidPeak = false;
          console.log("HeartBeatProcessor: Ignorando pico demasiado temprano", {
            timeSinceLastPeak,
            expectedMinInterval: 60000 / (currentBPM * 1.3)
          });
        }
        
        if (isValidPeak) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          this.lastProcessedPeakTime = now;
          this.updateBPM();
          this.stableDetectionCount++;
        }
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0,
      stableDetectionCount: this.stableDetectionCount
    };
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
    this.lastProcessedPeakTime = 0;
    this.peakThresholdAdjuster = 1.0;
    this.stableDetectionCount = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  detectPeak(normalizedValue, derivative, adjustedThreshold) {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > adjustedThreshold &&
      this.lastValue > this.baseline;

    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / adjustedThreshold, 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD), 0),
      1
    );

    const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 7) {
      this.peakConfirmationBuffer.shift();
    }

    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = len >= 3 ? this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3] : true;
        
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

  updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      
      while (this.bpmHistory.length > 8) {
        this.bpmHistory.shift();
      }
      
      console.log("HeartBeatProcessor: BPM actualizado", {
        instantBPM,
        interval,
        historySize: this.bpmHistory.length
      });
    } else {
      console.log("HeartBeatProcessor: BPM fuera de rango ignorado", {
        instantBPM,
        interval,
        min: this.MIN_BPM,
        max: this.MAX_BPM
      });
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    
    if (this.smoothBPM === 0 && rawBPM > 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    let alpha = this.BPM_ALPHA;
    if (this.stableDetectionCount > 20) {
      alpha = Math.max(0.15, alpha * 0.7);
    }
    
    if (rawBPM > 0) {
      this.smoothBPM = alpha * rawBPM + (1 - alpha) * this.smoothBPM;
    }
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    let trimmed;
    if (sorted.length >= 5) {
      const cutSize = Math.floor(sorted.length * 0.2);
      trimmed = sorted.slice(cutSize, sorted.length - cutSize);
    } else {
      trimmed = sorted.length > 3 ? sorted.slice(1, -1) : sorted;
    }
    
    if (!trimmed.length) return 0;
    
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  getFinalBPM() {
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

  reset() {
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
    
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => console.log("HeartBeatProcessor: Audio Context reactivado en reset"))
        .catch(err => console.error("HeartBeatProcessor: Error reactivando Audio Context", err));
    }
    
    console.log("HeartBeatProcessor: Reset completo ejecutado");
  }

  getRRIntervals() {
    const intervals = [...this.bpmHistory];
    
    const msIntervals = intervals.map(bpm => bpm > 0 ? 60000 / bpm : 0);
    
    return {
      intervals: msIntervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
