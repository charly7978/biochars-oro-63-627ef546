
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 20;          // Reducido para mayor velocidad de respuesta
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly SIGNAL_THRESHOLD = 0.08;   // Reducido drásticamente para máxima sensibilidad
  private readonly MIN_CONFIDENCE = 0.25;     // Valor mínimo para aceptar cualquier pico
  private readonly DERIVATIVE_THRESHOLD = -0.002; // Mucho menos restrictivo
  private readonly MIN_PEAK_TIME_MS = 150;    // Reducido para captar incluso latidos rápidos
  private readonly WARMUP_TIME_MS = 500;      // Reducido al mínimo para respuesta inmediata

  // Parámetros de filtrado optimizados para máxima sensibilidad
  private readonly MEDIAN_FILTER_WINDOW = 3;  // Ventana más pequeña
  private readonly MOVING_AVERAGE_WINDOW = 3; // Ventana más pequeña
  private readonly EMA_ALPHA = 0.7;          // Valor muy alto para seguir cambios instantáneamente
  private readonly BASELINE_FACTOR = 0.98;    // Adaptación de línea base más rápida

  // Parámetros de beep ajustados para máxima audibilidad
  private readonly BEEP_PRIMARY_FREQUENCY = 880;
  private readonly BEEP_SECONDARY_FREQUENCY = 440;
  private readonly BEEP_DURATION = 40;        // Beep más corto
  private readonly BEEP_VOLUME = 0.9;         // Volumen máximo sin distorsión
  private readonly MIN_BEEP_INTERVAL_MS = 150; // Intervalo mínimo reducido

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.01; // Extremadamente permisivo
  private readonly LOW_SIGNAL_FRAMES = 30;      // Dar más tiempo antes de resetear
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
  private readonly BPM_ALPHA = 0.5; // Extremadamente sensible a cambios recientes
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private recentSignalAmplitude: number = 0; // Para cálculo adaptativo de umbrales
  private potentialPeaksQueue: {value: number, time: number}[] = []; // Cola de picos potenciales

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
      
      // Para debugging - imprimir cuando se reproduce un beep
      console.log("BEEP played at", new Date().toISOString());
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
    // Imprimir valor de entrada para debugging
    // console.log("Input signal value:", value.toFixed(4));
    
    // Filtros sucesivos para mejorar la señal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 10) { // Reducido a 10 para detección más temprana
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Actualizar la amplitud reciente de la señal para umbral adaptativo
    const recentValues = this.signalBuffer.slice(-8); // Ventana más corta
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

    // Derivada mejorada con más peso en cambios recientes
    let smoothDerivative = 0;
    if (this.values.length >= 2) {
      smoothDerivative = this.values[this.values.length - 1] - this.values[this.values.length - 2];
    }
    this.lastValue = smoothed;

    // Detección de pico mejorada con sistema de confianza ponderada
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    
    // Sistema de confirmación de pico simplificado y con memoria
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Sonido de beep mejorado al detectar pico
    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Permitir detección de pico con menor intervalo mínimo
      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Volumen de beep proporcional a la confianza y amplitud de la señal
        // Aumentado para mayor audibilidad
        const beepVolume = Math.min(1.0, 0.5 + confidence * 0.5);
        
        // Debug info
        console.log("PEAK detected!", {
          confidence: confidence.toFixed(2),
          normalizedValue: normalizedValue.toFixed(4),
          timeSinceLastPeak
        });
        
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
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 2); // Decrementar más rápido
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.potentialPeaksQueue = [];
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
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS * 0.4) { // Reducido para detección más rápida
      return { isPeak: false, confidence: 0 };
    }

    // Umbrales adaptativos extremadamente sensibles
    // Usar un porcentaje bajo de la amplitud reciente para el umbral
    const adaptiveThreshold = Math.max(
      this.SIGNAL_THRESHOLD * 0.5, // Aún más bajo
      this.recentSignalAmplitude * 0.15  // Solo 15% de la amplitud reciente
    );
    
    const adaptiveDerivativeThreshold = Math.min(
      this.DERIVATIVE_THRESHOLD,
      -0.001 - this.recentSignalAmplitude * 0.005 // Mucho menos restrictivo
    );

    // Detección de pico con condiciones mucho más flexibles
    // AHORA ES CASI SEGURO QUE DETECTE CUALQUIER CAMBIO SIGNIFICATIVO
    const isOverThreshold = 
      (derivative < adaptiveDerivativeThreshold * 0.5 && normalizedValue > adaptiveThreshold * 0.5) ||
      (derivative < 0 && normalizedValue > adaptiveThreshold * 0.8) ||
      (Math.abs(derivative) > 0.01 && normalizedValue > 0); // Cualquier cambio brusco

    // Al menos considerar cualquier pico que tenga amplitud suficiente
    if (normalizedValue > this.recentSignalAmplitude * 0.4) {
      this.potentialPeaksQueue.push({
        value: normalizedValue,
        time: now
      });
      
      // Mantener cola de tamaño razonable
      if (this.potentialPeaksQueue.length > 10) {
        this.potentialPeaksQueue.shift();
      }
    }

    // Cálculo de confianza mejorado con mayor peso a cualquier cambio
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (adaptiveThreshold * 0.5), 0),
      1
    ) * 0.8; // 80% del peso a la amplitud
    
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(adaptiveDerivativeThreshold * 0.3), 0),
      1
    ) * 0.2; // 20% del peso a la derivada
    
    // Sumar ambas para mayor probabilidad de detección
    const confidence = amplitudeConfidence + derivativeConfidence;

    // Agregar bonificación por tiempo transcurrido desde último pico
    // Si ha pasado suficiente tiempo, aumentar la confianza
    let timeBonus = 0;
    if (timeSinceLastPeak > 500) {
      timeBonus = Math.min((timeSinceLastPeak - 500) / 1000, 0.3);
    }

    return { 
      isPeak: isOverThreshold, 
      confidence: Math.max((confidence + timeBonus) * 0.95, 0)
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
    
    // Criterios de confirmación extremadamente simplificados
    // Prácticamente cualquier señal con confianza mínima se acepta como pico
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      this.lastConfirmedPeak = true;
      return true;
    } 
    
    // También confirmar pico si hay un cambio de dirección marcado
    // después de una subida significativa
    if (!this.lastConfirmedPeak && this.peakConfirmationBuffer.length >= 3) {
      const rising = this.peakConfirmationBuffer[1] > this.peakConfirmationBuffer[0];
      const falling = this.peakConfirmationBuffer[2] < this.peakConfirmationBuffer[1];
      
      if (rising && falling && this.peakConfirmationBuffer[1] > 0.05) {
        this.lastConfirmedPeak = true;
        return true;
      }
    }
    
    // También forzar detección periódica si hay potenciales picos
    // y ha pasado demasiado tiempo sin uno confirmado
    const now = Date.now();
    if (!this.lastConfirmedPeak && 
        this.potentialPeaksQueue.length > 0 && 
        this.lastPeakTime && 
        (now - this.lastPeakTime > 1200)) { // Forzar si pasan > 1.2 segundos
      
      // Tomar el pico potencial más reciente con valor más alto
      const bestPeak = [...this.potentialPeaksQueue].sort((a, b) => b.value - a.value)[0];
      
      if (bestPeak && bestPeak.value > 0.03) {
        this.lastConfirmedPeak = true;
        this.potentialPeaksQueue = []; // Limpiar cola después de usar
        return true;
      }
    }
    
    // Reset de estado
    if (!isPeak) {
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
    
    // Validación más permisiva del BPM
    if (instantBPM >= this.MIN_BPM * 0.9 && instantBPM <= this.MAX_BPM * 1.1) {
      this.bpmHistory.push(instantBPM);
      
      // Mantener historia más corta para respuesta más rápida
      if (this.bpmHistory.length > 5) {
        this.bpmHistory.shift();
      }
      
      // Debug info
      console.log("BPM updated:", instantBPM.toFixed(1), "history:", this.bpmHistory.map(b => b.toFixed(1)));
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
    // Incluso con un solo valor, devolver algo
    if (this.bpmHistory.length == 0) {
      return 0;
    }
    
    if (this.bpmHistory.length == 1) {
      return this.bpmHistory[0];
    }
    
    // Con pocos valores, usar promedio simple
    if (this.bpmHistory.length < 4) {
      const avg = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
      return avg;
    }
    
    // Con más valores, usar mediana para mayor robustez
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const medianBPM = sorted[Math.floor(sorted.length / 2)];
    return medianBPM;
  }

  public getFinalBPM(): number {
    // Incluso con pocos valores, intentar devolver algo útil
    if (this.bpmHistory.length == 0) {
      return 0;
    }
    
    if (this.bpmHistory.length < 3) {
      return this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
    }
    
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Con al menos 3 valores, usar el rango central
    const finalSet = sorted.slice(Math.floor(sorted.length * 0.2), Math.ceil(sorted.length * 0.8));
    
    if (!finalSet.length) return sorted[Math.floor(sorted.length / 2)];
    
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  public reset() {
    console.log("HeartBeatProcessor: reset llamado manualmente");
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
    this.potentialPeaksQueue = [];
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
