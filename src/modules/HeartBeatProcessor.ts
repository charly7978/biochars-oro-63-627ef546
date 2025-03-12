export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.45;    // Aumentado para mayor precisión
  private readonly MIN_CONFIDENCE = 0.65;      // Más estricto
  private readonly DERIVATIVE_THRESHOLD = -0.035; // Ajustado para mejor detección
  private readonly MIN_PEAK_TIME_MS = 400;    // Ajustado para HR normal
  private readonly WARMUP_TIME_MS = 3000;     // Aumentado para mejor estabilización

  // Parámetros de filtrado optimizados
  private readonly MEDIAN_FILTER_WINDOW = 5;   // Aumentado para mejor filtrado
  private readonly MOVING_AVERAGE_WINDOW = 7;  // Aumentado para suavizado
  private readonly EMA_ALPHA = 0.25;          // Reducido para más estabilidad
  private readonly BASELINE_FACTOR = 0.97;     // Ajustado para mejor seguimiento

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
  private peakBuffer: Array<{time: number, value: number}> = [];
  private waveformBuffer: number[] = [];
  private readonly BPM_HISTORY_SIZE = 10;

  constructor() {
    this.initAudio();
    this.reset();
    console.log("HeartBeatProcessor: Inicializado con configuración optimizada");
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

  private calculateAdaptiveEMA(value: number): number {
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
    // Verificar warmup
    if (this.isInWarmup()) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: value, arrhythmiaCount: 0 };
    }

    // Filtrado de señal mejorado
    const filtered = this.applyFilters(value);
    
    // Normalización adaptativa
    const normalizedValue = this.normalizeSignal(filtered);

    // Detección de picos mejorada
    const { isPeak, confidence } = this.detectPeak(normalizedValue);

    // Actualización de BPM
    let bpm = 0;
    if (isPeak && confidence > this.MIN_CONFIDENCE) {
      this.updatePeakBuffer(normalizedValue);
      bpm = this.calculateBPM();
    }

    this.values.push({
      time: Date.now(),
      value: filtered,
      isPeak: isPeak,
    });
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = filtered - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2].value - this.values[0].value) / 2;
    }
    this.lastValue = filtered;

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
      bpm,
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: filtered,
      arrhythmiaCount: 0
    };
  }

  private applyFilters(value: number): number {
    // Filtro de mediana mejorado
    const medianFiltered = this.medianFilter(value);
    
    // Promedio móvil mejorado
    const movingAverageFiltered = this.calculateMovingAverage(medianFiltered);
    
    // EMA con alpha adaptativo
    return this.calculateAdaptiveEMA(movingAverageFiltered);
  }

  private normalizeSignal(value: number): number {
    // Actualización adaptativa de la línea base
    this.baseline = this.baseline * this.BASELINE_FACTOR + 
                   value * (1 - this.BASELINE_FACTOR);

    // Normalización con respecto a la línea base
    const normalized = (value - this.baseline) / Math.max(1, Math.abs(this.baseline));
    
    return normalized;
  }

  private detectPeak(normalizedValue: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const currentTime = Date.now();
    
    // Verificar intervalo mínimo entre picos
    if (this.lastPeakTime && 
        (currentTime - this.lastPeakTime) < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Análisis de forma de onda
    const waveformQuality = this.analyzeWaveform(normalizedValue);
    
    // Cálculo de derivada mejorado
    const derivative = this.calculateDerivative(normalizedValue);

    // Detección de pico con múltiples criterios
    const isPeak = normalizedValue > this.SIGNAL_THRESHOLD &&
                  derivative < this.DERIVATIVE_THRESHOLD &&
                  waveformQuality > 0.7;

    // Cálculo de confianza mejorado
    let confidence = 0;
    if (isPeak) {
      const amplitudeConfidence = Math.min(1, normalizedValue / this.SIGNAL_THRESHOLD);
      const derivativeConfidence = Math.min(1, Math.abs(derivative / this.DERIVATIVE_THRESHOLD));
      confidence = Math.min(amplitudeConfidence, derivativeConfidence, waveformQuality);
    }

    if (isPeak && confidence > this.MIN_CONFIDENCE) {
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = currentTime;
    }

    return { isPeak, confidence };
  }

  private analyzeWaveform(value: number): number {
    this.waveformBuffer.push(value);
    if (this.waveformBuffer.length > 10) {
      this.waveformBuffer.shift();
    }

    if (this.waveformBuffer.length < 10) return 0;

    // Análisis de forma de onda PPG
    const rising = this.waveformBuffer.slice(0, 5);
    const falling = this.waveformBuffer.slice(5);

    const risingScore = this.analyzeWaveformSegment(rising, true);
    const fallingScore = this.analyzeWaveformSegment(falling, false);

    return (risingScore + fallingScore) / 2;
  }

  private analyzeWaveformSegment(segment: number[], isRising: boolean): number {
    let validPoints = 0;
    for (let i = 1; i < segment.length; i++) {
      const diff = segment[i] - segment[i-1];
      const isValid = isRising ? 
        diff >= 0 && diff < segment[i-1] * 0.3 : 
        diff <= 0 && Math.abs(diff) < segment[i-1] * 0.3;
      
      if (isValid) validPoints++;
    }
    return validPoints / (segment.length - 1);
  }

  private calculateDerivative(value: number): number {
    return (value - this.lastValue) / (Date.now() - this.lastPeakTime);
  }

  private calculateBPM(): number {
    if (!this.previousPeakTime || !this.lastPeakTime) {
      return 0;
    }

    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval === 0) return 0;

    const instantBPM = 60000 / interval;

    // Validación de BPM
    if (instantBPM < this.MIN_BPM || instantBPM > this.MAX_BPM) {
      return this.getAverageBPM();
    }

    // Actualizar historial de BPM
    this.bpmHistory.push(instantBPM);
    if (this.bpmHistory.length > this.BPM_HISTORY_SIZE) {
      this.bpmHistory.shift();
    }

    return this.getAverageBPM();
  }

  private getAverageBPM(): number {
    if (this.bpmHistory.length === 0) return 0;

    // Eliminar valores atípicos
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const validBPMs = sorted.filter(bpm => 
      bpm >= q1 - 1.5 * iqr && 
      bpm <= q3 + 1.5 * iqr
    );

    // Promedio de valores válidos
    return Math.round(
      validBPMs.reduce((a, b) => a + b, 0) / validBPMs.length
    );
  }

  private updatePeakBuffer(value: number) {
    this.peakBuffer.push({ time: Date.now(), value });
    if (this.peakBuffer.length > 10) {
      this.peakBuffer.shift();
    }
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

  public reset(): void {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakBuffer = [];
    this.waveformBuffer = [];
    this.smoothedValue = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastBeepTime = 0;
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
