
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 30;          // Reducido para mayor rapidez de detección
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly SIGNAL_THRESHOLD = 0.18;    // Umbral más bajo para mayor sensibilidad
  private readonly MIN_CONFIDENCE = 0.35;      // Umbral de confianza más bajo
  private readonly DERIVATIVE_THRESHOLD = -0.005; // Mucho menos restrictivo
  private readonly MIN_PEAK_TIME_MS = 180;     // Más bajo para captar latidos rápidos
  private readonly WARMUP_TIME_MS = 1000;      // Tiempo de calentamiento reducido

  // Parámetros de filtrado optimizados
  private readonly MEDIAN_FILTER_WINDOW = 3;    // Ventana de filtro mediana reducida
  private readonly MOVING_AVERAGE_WINDOW = 3;   // Ventana de promedio móvil reducida
  private readonly EMA_ALPHA = 0.5;            // Alfa más alto para seguir cambios más rápidamente
  private readonly BASELINE_FACTOR = 0.97;     // Adaptación de línea base más rápida

  // Parámetros de beep ajustados
  private readonly BEEP_PRIMARY_FREQUENCY = 880;
  private readonly BEEP_SECONDARY_FREQUENCY = 440;
  private readonly BEEP_DURATION = 40;         // Beep más corto
  private readonly BEEP_VOLUME = 0.7;          // Volumen más alto
  private readonly MIN_BEEP_INTERVAL_MS = 200; // Intervalo mínimo entre beeps reducido

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.02; // Más permisivo con señales bajas
  private readonly LOW_SIGNAL_FRAMES = 15;
  private lowSignalCount = 0;

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
  private readonly BPM_ALPHA = 0.3; // Más sensible a cambios recientes
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private recentSignalAmplitude: number = 0; // Para cálculo adaptativo de umbrales

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext) return;

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

      // Envelope del sonido principal
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envelope del sonido secundario
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
    // Filtros sucesivos para mejorar la señal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 15) { // Reducido a 15 para detección más temprana
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Actualizar la amplitud reciente de la señal para umbral adaptativo
    const recentValues = this.signalBuffer.slice(-10);
    const minValue = Math.min(...recentValues);
    const maxValue = Math.max(...recentValues);
    this.recentSignalAmplitude = maxValue - minValue;

    // Adaptación de línea base más sensible
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Derivada mejorada
    let smoothDerivative = 0;
    if (this.values.length >= 2) {
      smoothDerivative = this.values[this.values.length - 1] - this.values[this.values.length - 2];
    }
    this.lastValue = smoothed;

    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Sonido de beep mejorado al detectar pico
    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Permitir detección de pico incluso en periodo de calentamiento inicial
      // para comenzar a captar resultados lo antes posible
      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        // Volumen de beep proporcional a la confianza y amplitud de la señal
        const beepVolume = Math.min(0.7, 0.3 + confidence * 0.4);
        this.playBeep(beepVolume);
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

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1); // Decrementar gradualmente
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

    // Permitimos detección más temprana
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS * 0.5) {
      return { isPeak: false, confidence: 0 };
    }

    // Umbrales adaptativos basados en la amplitud de la señal
    const adaptiveThreshold = Math.max(
      this.SIGNAL_THRESHOLD * 0.7,
      this.recentSignalAmplitude * 0.2
    );
    
    const adaptiveDerivativeThreshold = Math.min(
      this.DERIVATIVE_THRESHOLD,
      -0.005 - this.recentSignalAmplitude * 0.01
    );

    // Detección de pico mejorada con condiciones más flexibles
    const isOverThreshold = 
      (derivative < adaptiveDerivativeThreshold && normalizedValue > adaptiveThreshold * 0.7) ||
      (derivative < 0 && normalizedValue > adaptiveThreshold * 1.2);

    // Cálculo de confianza mejorado con mayor peso a la amplitud
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (adaptiveThreshold * 0.8), 0),
      1
    );
    
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(adaptiveDerivativeThreshold * 0.6), 0),
      1
    );

    // Mayor peso a la amplitud para mejor detección (70% amplitud, 30% derivada)
    const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

    return { 
      isPeak: isOverThreshold, 
      confidence: Math.max(confidence * 0.9, 0)
    };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Buffer más pequeño para confirmación más rápida
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 3) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Criterios de confirmación más simples
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      this.lastConfirmedPeak = true;
      return true;
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    
    return false;
  }

  private updateBPM() {
    if (!this.lastPeakTime) return;
    
    // Si no hay previousPeakTime, no podemos calcular intervalo aún
    if (!this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Validar que el BPM esté en un rango fisiológico realista
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      
      // Mantener historia limitada pero suficiente para promedios robustos
      if (this.bpmHistory.length > 8) {
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (rawBPM === 0) return 0;
    
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Suavizado más rápido para seguir cambios en BPM
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Usar mediana en lugar de media para mayor robustez
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Eliminar outliers solo si hay suficientes muestras
    if (sorted.length >= 5) {
      const trimmed = sorted.slice(1, -1);
      if (!trimmed.length) return 0;
      const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      return avg;
    } else {
      // Con pocas muestras, usar todas
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      return avg;
    }
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 3) {
      return 0;
    }
    
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Usar un rango central para mayor estabilidad
    const finalSet = sorted.slice(Math.floor(sorted.length * 0.2), Math.ceil(sorted.length * 0.8));
    
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
    this.recentSignalAmplitude = 0;
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
