export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.30; // Reducido de 0.40 para mayor sensibilidad
  private readonly MIN_CONFIDENCE = 0.50; // Reducido de 0.60 para mayor sensibilidad
  private readonly DERIVATIVE_THRESHOLD = -0.025; // Menos restrictivo que -0.03
  private readonly MIN_PEAK_TIME_MS = 400; 
  private readonly WARMUP_TIME_MS = 3000; 

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 5; // Aumentado de 3 a 5 para mejor suavizado
  private readonly MOVING_AVERAGE_WINDOW = 5; // Aumentado de 3 a 5 para mejor suavizado
  private readonly EMA_ALPHA = 0.3; // Reducido de 0.4 para suavizar más la señal
  private readonly BASELINE_FACTOR = 0.995; // Más cercano a 1 para adaptación más lenta

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880; 
  private readonly BEEP_SECONDARY_FREQUENCY = 440; 
  private readonly BEEP_DURATION = 80; 
  private readonly BEEP_VOLUME = 0.9; 
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.02; // Reducido para detectar señales más débiles
  private readonly LOW_SIGNAL_FRAMES = 15; // Aumentado para dar más tiempo antes de resetear
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
  private readonly BPM_ALPHA = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;

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
    if (!this.audioContext || this.isInWarmup()) return;

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
    
    // Copia ordenada para obtener la mediana
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    // Para manejar mejor valores atípicos, utilizamos una mediana ponderada
    // que da más peso a los valores centrales
    
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length <= 3) {
      return sorted[mid];
    }
    
    // Para ventanas más grandes, aplicamos ponderación
    if (sorted.length % 2 === 0) {
      // Promedio ponderado para ventanas pares
      return (sorted[mid - 1] * 0.4 + sorted[mid] * 0.6);
    } else {
      // Para ventanas impares, damos más peso al elemento central
      // y un poco a sus vecinos
      if (sorted.length >= 5) {
        return (
          sorted[mid - 2] * 0.1 +
          sorted[mid - 1] * 0.2 +
          sorted[mid] * 0.4 +
          sorted[mid + 1] * 0.2 +
          sorted[mid + 2] * 0.1
        );
      } else {
        return (sorted[mid - 1] * 0.25 + sorted[mid] * 0.5 + sorted[mid + 1] * 0.25);
      }
    }
  }

  private calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    
    // Aplicar una media móvil ponderada que da más peso a los valores recientes
    let sum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.movingAverageBuffer.length; i++) {
      // Asignar pesos crecientes a valores más recientes
      const weight = i + 1;
      sum += this.movingAverageBuffer[i] * weight;
      weightSum += weight;
    }
    
    return sum / weightSum;
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

    if (this.signalBuffer.length < 30) {
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

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        this.playBeep(0.12); // Suena beep cuando se confirma pico
        this.updateBPM();
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
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
      this.lowSignalCount = 0;
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

    // No detectar picos demasiado cercanos entre sí
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // MEJORA: Lógica más robusta para detección de picos
    // Condiciones más flexibles para aumentar sensibilidad
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.95; // Antes era 0.98, ahora más permisivo

    // Mejora en el cálculo de confianza para dar más peso a la amplitud
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );

    // Ponderación mejorada para la confianza
    const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Añadir valor al buffer de confirmación
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // MEJORA: Usar máximo reciente en lugar de promedio para detectar mejor los picos
    const maxValue = Math.max(...this.peakConfirmationBuffer);
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / this.peakConfirmationBuffer.length;
    
    // MEJORA: Lógica más robusta para confirmación de picos
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE && 
        (avgBuffer > this.SIGNAL_THRESHOLD * 0.8 || maxValue > this.SIGNAL_THRESHOLD * 1.2)) {
        
      // Verificar que estamos en la fase descendente después del pico
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // MEJORA: Análisis más flexible de la forma del pico
        // Consideramos tanto "ir descendiendo" como "estar cerca del máximo"
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const nearPeak = this.peakConfirmationBuffer[len - 2] > this.peakConfirmationBuffer[len - 3] * 0.9;
        
        // Confirmar si estamos descendiendo O si estamos cerca del pico
        if (goingDown1 || nearPeak) {
          this.lastConfirmedPeak = true;
          console.log("Pico confirmado con confianza:", confidence.toFixed(2));
          return true;
        }
      }
    } else if (!isPeak || normalizedValue < this.SIGNAL_THRESHOLD * 0.5) {
      // Reset del estado de confirmación cuando la señal cae significativamente
      this.lastConfirmedPeak = false;
    }
    return false;
  }

  private updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // MEJORA: Filtrado más estricto para valores de BPM
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      // Si tenemos suficiente historial, validar que este valor no sea muy discrepante
      if (this.bpmHistory.length >= 3) {
        const avgBPM = this.bpmHistory.reduce((sum, val) => sum + val, 0) / this.bpmHistory.length;
        
        // Solo aceptar valores que no difieran más de un 30% del promedio
        if (Math.abs(instantBPM - avgBPM) <= avgBPM * 0.3) {
          this.bpmHistory.push(instantBPM);
        } else {
          // Si es muy discrepante, usar un valor intermedio para evitar saltos bruscos
          this.bpmHistory.push(avgBPM * 0.7 + instantBPM * 0.3);
        }
      } else {
        // Al inicio, aceptamos valores en el rango fisiológico
        this.bpmHistory.push(instantBPM);
      }
      
      // Limitar tamaño del historial
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    if (!trimmed.length) return 0;
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
