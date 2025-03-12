export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.35; // Reducido de 0.40 para mayor sensibilidad
  private readonly MIN_CONFIDENCE = 0.55; // Reducido de 0.60 para captar más señales
  private readonly DERIVATIVE_THRESHOLD = -0.025; // Menos restrictivo que -0.03
  private readonly MIN_PEAK_TIME_MS = 350; // Reducido de 400ms para captar frecuencias cardíacas más altas
  private readonly WARMUP_TIME_MS = 2500; // Reducido para obtener resultados más rápido

  // Parámetros de filtrado optimizados
  private readonly MEDIAN_FILTER_WINDOW = 3; // Mantenido en 3 para preservar la morfología del pulso
  private readonly MOVING_AVERAGE_WINDOW = 5; // Aumentado de 3 a 5 para suavizar mejor el ruido
  private readonly EMA_ALPHA = 0.35; // Ajustado para dar más peso a valores históricos (estabilidad)
  private readonly BASELINE_FACTOR = 0.98; // Ajustado para seguir mejor la línea base

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880; 
  private readonly BEEP_SECONDARY_FREQUENCY = 440; 
  private readonly BEEP_DURATION = 80; 
  private readonly BEEP_VOLUME = 0.9; 
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.02; // Reducido para ser más sensible a señales débiles
  private readonly LOW_SIGNAL_FRAMES = 15; // Aumentado para evitar reinicios prematuros
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
  private values: Array<{time: number, value: number, isPeak: boolean}> = [];
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
    // Comprobamos si la señal es NaN o Infinity y la reemplazamos con el último valor válido
    if (isNaN(value) || !isFinite(value)) {
      value = this.lastValue || 0;
    }
    
    // Aplicamos una ganancia adaptativa para amplificar señales débiles
    const gain = value < 0.2 ? 1.5 : 1.0;
    value = value * gain;
    
    // Filtros sucesivos para mejorar la señal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Guardamos el valor para futuras referencias
    this.lastValue = value;
    
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Esperamos a tener suficientes datos para un análisis confiable
    if (this.signalBuffer.length < 20) { // Reducido de 30 a 20 para responder más rápido
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Actualización de línea base más sensible a cambios lentos
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    // Normalizamos el valor restando la línea base y aplicando una amplificación si es necesario
    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push({
      time: Date.now(),
      value: smoothed,
      isPeak: false,
    });
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2].value - this.values[0].value) / 2;
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

    // Verificación de intervalo mínimo entre picos, pero con ajuste dinámico 
    // basado en el último BPM detectado para mejorar adaptabilidad
    const dynamicMinPeakTimeMs = this.smoothBPM > 0 ? 
      Math.min(this.MIN_PEAK_TIME_MS, 60000 / (this.smoothBPM * 1.3)) : 
      this.MIN_PEAK_TIME_MS;
      
    if (timeSinceLastPeak < dynamicMinPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Detección de picos mejorada con umbral adaptativo basado en la amplitud reciente
    // Calculamos la amplitud promedio de los últimos valores para ajustar la sensibilidad
    const recentValues = this.signalBuffer.slice(-10);
    const recentAmplitude = recentValues.length > 5 ? 
      Math.max(...recentValues) - Math.min(...recentValues) : 0;
    
    // Ajustamos el umbral de señal dinámicamente basado en la amplitud reciente
    const dynamicThreshold = Math.max(
      this.SIGNAL_THRESHOLD * 0.8,
      Math.min(this.SIGNAL_THRESHOLD, recentAmplitude * 0.4)
    );
    
    // La condición de detección de picos ahora es más adaptativa
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > dynamicThreshold &&
      this.lastValue > this.baseline * 0.95; // Relajamos la condición de baseline

    // Mejoramos el cálculo de confianza para ser más preciso con señales débiles
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (dynamicThreshold * 1.5), 0),
      1
    );
    
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );
    
    // Añadimos un factor de confianza temporal basado en la regularidad de los intervalos
    let temporalConfidence = 0.5; // Valor base
    if (this.lastPeakTime && this.previousPeakTime) {
      const lastInterval = this.lastPeakTime - this.previousPeakTime;
      const currentInterval = now - this.lastPeakTime;
      // Mayor confianza si el intervalo actual es similar al anterior (ritmo regular)
      const intervalRatio = Math.min(lastInterval, currentInterval) / 
                           Math.max(lastInterval, currentInterval);
      temporalConfidence = 0.3 + (intervalRatio * 0.7); // Escalamos entre 0.3 y 1.0
    }

    const confidence = (amplitudeConfidence * 0.5) + 
                       (derivativeConfidence * 0.3) + 
                       (temporalConfidence * 0.2);

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Guardamos este valor para análisis y visualización
    const currentTime = Date.now();
    
    // Si no es un pico candidato o la confianza es muy baja, no confirmamos
    if (!isPeak || confidence < this.MIN_CONFIDENCE * 0.8) {
      this.lastConfirmedPeak = false;
      
      // Si hay un candidato a pico en proceso, verificamos si deberíamos descartarlo
      // por haber encontrado un punto aún más bajo (detección de valley)
      if (this.peakCandidateIndex !== null && 
          normalizedValue < -this.SIGNAL_THRESHOLD * 0.5 && 
          this.peakConfirmationBuffer.length > 2) {
        // Encontramos un valley significativo, lo que aumenta la probabilidad
        // de que el candidato anterior sea un verdadero pico
        const peakValue = this.peakConfirmationBuffer[this.peakCandidateIndex];
        const valleyDifference = peakValue - normalizedValue;
        
        // Si la diferencia pico-valle es significativa, confirmamos el pico
        if (valleyDifference > this.SIGNAL_THRESHOLD) {
          // Encontramos un pico válido en el candidato anterior
          const peakTime = currentTime - (this.peakConfirmationBuffer.length - this.peakCandidateIndex) * (1000 / this.SAMPLE_RATE);
          
          // Actualizar los timestamps para cálculos de BPM
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = peakTime;
          
          // Marcamos el pico en el historial si corresponde
          const indexToMark = this.values.length - this.peakConfirmationBuffer.length + this.peakCandidateIndex;
          if (indexToMark >= 0 && indexToMark < this.values.length) {
            this.values[indexToMark].isPeak = true;
          }
          
          // Reproducir beep si la confianza es alta
          if (confidence > this.MIN_CONFIDENCE) {
            this.playBeep(Math.min(confidence, 1) * this.BEEP_VOLUME).catch(console.error);
          }
          
          // Reiniciar candidato
          this.peakCandidateIndex = null;
          this.peakCandidateValue = 0;
          this.peakConfirmationBuffer = [];
          
          // Actualizar BPM basado en los intervalos entre picos
          this.updateBPM();
          return true;
        }
      }
      
      // Si no tenemos un candidato a pico o no se confirmó con un valley,
      // simplemente añadimos el valor al buffer de confirmación
      this.peakConfirmationBuffer.push(normalizedValue);
      
      // Limitar el tamaño del buffer
      if (this.peakConfirmationBuffer.length > 10) {
        this.peakConfirmationBuffer.shift();
      }
      
      return false;
    }

    // Tenemos un pico potencial
    if (this.peakCandidateIndex === null || normalizedValue > this.peakCandidateValue) {
      // Es un nuevo candidato o mejor que el actual
      this.peakCandidateIndex = this.peakConfirmationBuffer.length;
      this.peakCandidateValue = normalizedValue;
    }
    
    this.peakConfirmationBuffer.push(normalizedValue);
    
    // Limitamos el buffer
    if (this.peakConfirmationBuffer.length > 10) {
      // Si perdimos nuestro candidato debido al desplazamiento, reiniciamos
      if (this.peakCandidateIndex === 0) {
        this.peakCandidateIndex = null;
        this.peakCandidateValue = 0;
      } else if (this.peakCandidateIndex !== null) {
        this.peakCandidateIndex--;
      }
      this.peakConfirmationBuffer.shift();
    }

    // Solo confirmamos el pico si es el candidato principal y 
    // la confianza supera nuestro umbral
    if (
      this.peakCandidateIndex !== null && 
      this.peakCandidateIndex === this.peakConfirmationBuffer.length - 1 &&
      confidence > this.MIN_CONFIDENCE
    ) {
      // Actualizamos los timestamps para calcular el BPM
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = currentTime;
      
      // Marcar este punto como pico
      if (this.values.length > 0) {
        this.values[this.values.length - 1].isPeak = true;
      }

      // Reiniciamos para el próximo ciclo
      this.peakCandidateIndex = null;
      this.peakCandidateValue = 0;
      this.peakConfirmationBuffer = [];
      
      // Actualizar BPM basado en intervalos
      this.updateBPM();
      
      // Reproducir beep con volumen proporcional a la confianza
      this.playBeep(Math.min(confidence, 1) * this.BEEP_VOLUME).catch(console.error);
      
      return true;
    }

    return false;
  }

  private updateBPM() {
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
