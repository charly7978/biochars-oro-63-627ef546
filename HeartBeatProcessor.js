
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 45;  // Incrementado ligeramente para reducir falsos positivos
  MAX_BPM = 180; // Reducido para evitar valores irreales
  SIGNAL_THRESHOLD = 0.55; // Aumentado de 0.60 para mayor precisión 
  MIN_CONFIDENCE = 0.60; // Aumentado de 0.50 para reducir beeps falsos
  DERIVATIVE_THRESHOLD = -0.025; // Ajustado para mejor detección
  MIN_PEAK_TIME_MS = 450; // Incrementado para asegurar picos reales
  WARMUP_TIME_MS = 3000;

  // Filtros mejorados
  MEDIAN_FILTER_WINDOW = 5; // Aumentado de 3 para mejor suavizado
  MOVING_AVERAGE_WINDOW = 7; // Aumentado de 5 para suavizar más la señal
  EMA_ALPHA = 0.25; // Reducido de 0.3 para suavizar más la señal
  BASELINE_FACTOR = 0.996; // Incrementado para seguimiento más lento del baseline

  // Parámetros de beep
  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 100;
  BEEP_VOLUME = 0.7;
  MIN_BEEP_INTERVAL_MS = 450; // Aumentado para evitar beeps muy seguidos

  // Detección de señal baja
  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 15; // Aumentado de 10 para mayor estabilidad
  lowSignalCount = 0;

  // Variables para mejor estabilidad del BPM
  BPM_ALPHA = 0.15; // Reducido de 0.2 para transiciones más suaves
  MIN_BPM_HISTORY = 6; // Mínimo de lecturas para dar un BPM confiable
  BPM_STABILITY_THRESHOLD = 10; // Umbral para considerar una lectura de BPM como estable
  
  // Nuevas variables para estabilidad
  stableReadingCount = 0;
  requiredStableReadings = 4; // Requiere 4 lecturas estables para confirmar BPM
  lastReportedBpm = 0;
  
  // Contador para evitar beeps inconsistentes
  consecutiveValidPeaks = 0;
  requiredConsecutivePeaks = 2; // Requiere al menos 2 picos consecutivos para empezar a hacer beep

  // Variables existentes
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
  peakCandidateIndex = null;
  peakCandidateValue = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;
    
    // Solo reproducir beep si tenemos suficientes picos válidos consecutivos
    if (this.consecutiveValidPeaks < this.requiredConsecutivePeaks) {
      console.log("Skipping beep - not enough consecutive valid peaks yet");
      return;
    }

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

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

      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      primaryOscillator.start();
      secondaryOscillator.start();
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);

      this.lastBeepTime = now;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
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
    // Aplicar filtros mejorados para la señal
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
        arrhythmiaCount: 0
      };
    }

    // Ajustar el seguimiento de la línea base para mejorar detección de picos
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Calcular derivada suavizada para detección de picos más robusta
    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Mejorar detección de picos
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Actualizar contador de picos válidos consecutivos
    if (isConfirmedPeak && !this.isInWarmup()) {
      this.consecutiveValidPeaks++;
    } else if (!isPeak) {
      // Solo decrementar si no es un pico (pero mantener mínimo en 0)
      this.consecutiveValidPeaks = Math.max(0, this.consecutiveValidPeaks - 0.2);
    }

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        this.playBeep(0.12);
        this.updateBPM();
      }
    }

    // Obtener BPM con validación mejorada de estabilidad
    const currentBPM = this.getSmoothBPM();
    
    // Determinar si el BPM actual es estable
    // Sólo reportamos BPM después de tener suficientes lecturas estables
    let reportedBPM = 0;
    
    if (currentBPM > 0) {
      if (this.lastReportedBpm === 0) {
        // Primera lectura, inicializar
        this.lastReportedBpm = currentBPM;
        this.stableReadingCount = 1;
      } else if (Math.abs(currentBPM - this.lastReportedBpm) <= this.BPM_STABILITY_THRESHOLD) {
        // Lectura consistente con la anterior
        this.stableReadingCount++;
        this.lastReportedBpm = currentBPM * 0.3 + this.lastReportedBpm * 0.7; // Suavizar
      } else {
        // Lectura inconsistente, resetear contador
        this.stableReadingCount = 0;
        this.lastReportedBpm = currentBPM;
      }
      
      if (this.stableReadingCount >= this.requiredStableReadings) {
        reportedBPM = Math.round(this.lastReportedBpm);
      } else if (this.bpmHistory.length >= this.MIN_BPM_HISTORY) {
        // Aún no es estable pero tenemos suficientes datos para mostrar algo
        reportedBPM = Math.round(currentBPM);
      }
    }

    return {
      bpm: reportedBPM,
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0,
      // Proporcionar datos RR mejorados para análisis de arritmias
      rrData: this.lastPeakTime && this.previousPeakTime ? {
        intervals: [...this.bpmHistory],
        lastPeakTime: this.lastPeakTime
      } : undefined
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
    this.consecutiveValidPeaks = 0;
    this.stableReadingCount = 0;
    this.lastReportedBpm = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  detectPeak(normalizedValue, derivative) {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Mejor detección de picos con criterios más estrictos
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;

    // Cálculo de confianza mejorado
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );

    // Factor de peso adicional para mejorar la confianza en picos reales
    const timingFactor = Math.min(timeSinceLastPeak / 1000, 1.5) / 1.5;
    const confidence = (amplitudeConfidence * 0.5 + derivativeConfidence * 0.3 + timingFactor * 0.2);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
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

  updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Filtrar valores de BPM implausibles
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 15) { // Aumentado para mejor promediado
        this.bpmHistory.shift();
      }
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    
    // No calcular BPM si no tenemos datos suficientes
    if (rawBPM === 0 || this.bpmHistory.length < this.MIN_BPM_HISTORY) {
      return 0;
    }
    
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Actualizar el BPM suavizado con más peso en el histórico
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < this.MIN_BPM_HISTORY) {
      return 0;
    }
    
    // Mejorado: Descartar outliers antes de calcular
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Descartar el 20% superior e inferior para estabilidad
    const cutSize = Math.max(1, Math.floor(sorted.length * 0.2));
    const trimmed = sorted.slice(cutSize, sorted.length - cutSize);
    
    if (!trimmed.length) return 0;
    
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  getFinalBPM() {
    if (this.bpmHistory.length < 6) {
      return 0;
    }
    
    // Descartar outliers para una medición final más estable
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.2);
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
    this.stableReadingCount = 0;
    this.lastReportedBpm = 0;
    this.consecutiveValidPeaks = 0;
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
} 
