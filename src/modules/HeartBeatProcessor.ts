export class HeartBeatProcessor {
  // Parámetros de configuración
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.28;        // Reducido para mayor sensibilidad
  MIN_CONFIDENCE = 0.20;          // Reducido para detectar más picos 
  DERIVATIVE_THRESHOLD = -0.010;  // Menos restrictivo para capturar más picos
  MIN_PEAK_TIME_MS = 250;         // Mínimo tiempo entre picos
  WARMUP_TIME_MS = 0;             // Sin tiempo de calentamiento

  // Filtros de señal
  MEDIAN_FILTER_WINDOW = 3;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.3;
  BASELINE_FACTOR = 0.99;

  // Configuración del beep
  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 80;             // Duración más corta para mejor sincronización
  BEEP_VOLUME = 1.0;              // Volumen máximo
  MIN_BEEP_INTERVAL_MS = 250;     // Mínimo intervalo entre beeps

  // Parámetros de detección de señal baja
  LOW_SIGNAL_THRESHOLD = 0.02;
  LOW_SIGNAL_FRAMES = 20;
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
  BPM_ALPHA = 0.35;
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  lastProcessedPeakTime = 0;      // Nueva variable para control de procesamiento de picos

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
        await this.playBeep(0.2);
        
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
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

    try {
      // Crear osciladores y ganancias
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configurar frecuencias de osciladores
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

      // Configurar envolventes de amplitud
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.005
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.7,
        this.audioContext.currentTime + 0.005
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conectar nodos de audio
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Iniciar y programar detención de osciladores
      primaryOscillator.start();
      secondaryOscillator.start();
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);

      // Actualizar tiempo del último beep
      this.lastBeepTime = now;
      console.log("HeartBeatProcessor: BEEP reproducido", {
        time: new Date().toISOString(),
        timeSinceLastBeep: now - this.lastBeepTime
      });
      
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error reproduciendo beep", err);
      return false;
    }
  }

  isInWarmup() {
    // Eliminado el período de calentamiento
    return false;
  }

  medianFilter(value) {
    // ... keep existing code (median filter implementation)
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  calculateMovingAverage(value) {
    // ... keep existing code (moving average implementation)
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  calculateEMA(value) {
    // ... keep existing code (EMA calculation)
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  processSignal(value) {
    // Aplicar filtros para reducir ruido
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Almacenar valor filtrado en el buffer
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Verificar si tenemos suficientes datos
    if (this.signalBuffer.length < 8) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Actualizar línea base
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    // Normalizar valor respecto a la línea base
    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Actualizar buffer para cálculo de derivada
    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Calcular derivada suavizada
    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Detectar si estamos en un pico
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Si hay un pico confirmado, NO reproducir beep automáticamente
    // Los beeps serán manejados por el hook useHeartBeatProcessor
    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        // Solo actualizar tiempos, no reproducir beep
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        this.lastProcessedPeakTime = now;
        this.updateBPM();
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak,
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
  }

  autoResetIfSignalIsLow(amplitude) {
    // ... keep existing code (low signal detection)
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
    // ... keep existing code (reset internal state)
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    this.lastProcessedPeakTime = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  detectPeak(normalizedValue, derivative) {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // No detectar picos demasiado cercanos
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Mejorada la detección de picos - menos restrictiva
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD * 0.7 &&   // Menos restrictivo
      normalizedValue > this.SIGNAL_THRESHOLD * 0.7 &&  // Menos restrictivo
      this.lastValue > this.baseline * 0.7;             // Menos restrictivo

    // Cálculo de confianza
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / (Math.abs(this.DERIVATIVE_THRESHOLD) * 0.5), 0),
      1
    );

    // Pesos ajustados para mejorar confianza
    const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    // Confirmación de pico menos restrictiva
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 2) {  // Reducido a 2 muestras
        const len = this.peakConfirmationBuffer.length;
        
        // Verificamos que estamos en descenso después del pico
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
    // ... keep existing code (BPM calculation)
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

  getSmoothBPM() {
    // ... keep existing code (smooth BPM calculation)
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    // ... keep existing code (current BPM calculation)
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  getFinalBPM() {
    // ... keep existing code (final BPM calculation)
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
    
    // Reiniciar audio si es necesario
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => console.log("HeartBeatProcessor: Audio Context reactivado en reset"))
        .catch(err => console.error("HeartBeatProcessor: Error reactivando Audio Context", err));
    }
    
    console.log("HeartBeatProcessor: Reset completo ejecutado");
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
