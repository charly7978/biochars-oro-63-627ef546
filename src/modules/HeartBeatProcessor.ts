import { HeartBeatConfig } from './heart-beat/config';

export class HeartBeatProcessor {
  // --- Constantes y Configuraciones ---
  SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE;
  WINDOW_SIZE = 150;
  MIN_BPM = HeartBeatConfig.MIN_BPM;
  MAX_BPM = HeartBeatConfig.MAX_BPM;
  SIGNAL_THRESHOLD = HeartBeatConfig.SIGNAL_THRESHOLD;
  MIN_CONFIDENCE = HeartBeatConfig.MIN_CONFIDENCE;
  DERIVATIVE_THRESHOLD = HeartBeatConfig.DERIVATIVE_THRESHOLD;
  MIN_PEAK_TIME_MS = HeartBeatConfig.MIN_PEAK_TIME_MS;
  WARMUP_TIME_MS = HeartBeatConfig.WARMUP_TIME_MS;
  BASE_MEDIAN_WINDOW = 3;
  MAX_MEDIAN_WINDOW = 7;
  BASE_MOVING_AVG_WINDOW = 5;
  MAX_MOVING_AVG_WINDOW = 11;
  MOTION_STD_DEV_THRESHOLD = 0.6;
  MOTION_BUFFER_SIZE = 15;
  MOTION_PENALTY = 0.1;
  HARMONIC_GAIN = 0.4;
  HARMONIC_GAIN_2ND = 0.25;
  HARMONIC_GAIN_3RD = 0.15;
  QUALITY_HISTORY_SIZE = 5;
  QUALITY_CHANGE_THRESHOLD = 0.2;
  QUALITY_TRANSITION_PENALTY = 0.5;
  BPM_STABILITY_THRESHOLD = 10.0;
  EMA_ALPHA = HeartBeatConfig.EMA_ALPHA;
  BASELINE_FACTOR = HeartBeatConfig.BASELINE_FACTOR;
  BEEP_PRIMARY_FREQUENCY = HeartBeatConfig.BEEP_PRIMARY_FREQUENCY;
  BEEP_SECONDARY_FREQUENCY = HeartBeatConfig.BEEP_SECONDARY_FREQUENCY;
  BEEP_DURATION = HeartBeatConfig.BEEP_DURATION;
  BEEP_VOLUME = HeartBeatConfig.BEEP_VOLUME;
  MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;
  LOW_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  LOW_SIGNAL_FRAMES = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  FORCE_IMMEDIATE_BEEP = true;
  SKIP_TIMING_VALIDATION = true;

  // --- Estados Internos ---
  private isMonitoring = false;
  signalBuffer: number[] = [];
  rawSignalBuffer: number[] = [];
  medianBuffer: number[] = [];
  movingAverageBuffer: number[] = [];
  smoothedValue = 0;
  lastPeakTime: number | null = null;
  previousPeakTime: number | null = null;
  bpmHistory: number[] = [];
  baseline = 0;
  lastValue = 0; // Último valor normalizado (puede ser realzado)
  values: number[] = []; // Buffer corto para derivada
  peakConfirmationBuffer: number[] = [];
  lastConfirmedPeak = false;
  smoothBPM = 75;
  BPM_ALPHA = 0.2;
  rrIntervals: number[] = [];
  motionScore = 0;
  isMotionDetected = false;
  localQualityHistory: number[] = [];
  lastQualityScore = 0.5;
  isQualityUnstable = false;
  bpmStabilityScore = 1.0;
  audioContext: AudioContext | null = null;
  lastBeepTime = 0;
  startTime = 0;
  lowSignalCount = 0; // Renombrado para claridad

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
    this.reset();
  }

  // --- Métodos Públicos ---
  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    console.log(`HeartBeatProcessor: Monitoring set to ${monitoring}`);
    if (monitoring) {
        this.startTime = Date.now(); // Reiniciar warmup timer
        if (this.audioContext && this.audioContext.state !== 'running') {
            this.audioContext.resume().catch(err => {
                console.error("HeartBeatProcessor: Error resuming audio context", err);
            });
        }
    } else {
        this.reset(); // Resetear completamente al detener
    }
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  reset() {
    console.log("HeartBeatProcessor: Full Reset Called");
    this.signalBuffer = [];
    this.rawSignalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakConfirmationBuffer = [];
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 75;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.startTime = this.isMonitoring ? Date.now() : 0;
    this.lowSignalCount = 0;
    this.rrIntervals = [];
    this.motionScore = 0;
    this.isMotionDetected = false;
    this.localQualityHistory = [];
    this.lastQualityScore = 0.5;
    this.isQualityUnstable = true;
    this.bpmStabilityScore = 0.5; // Empezar con estabilidad media tras reset
    this.baseline = 0;
    this.smoothedValue = 0;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
  }

  getRRIntervals() {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }

  // --- Lógica Principal de Procesamiento ---
  processSignal(rawValue: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number; // Valor post-EMA, pre-realce
    enhancedValue?: number; // Valor post-realce (si se aplicó)
    isMotionDetected: boolean;
    isQualityUnstable: boolean;
    bpmStabilityScore: number;
  } {
    // Paso 0: Verificar monitoreo y warmup
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: 0, enhancedValue: undefined, isMotionDetected: false, isQualityUnstable: true, bpmStabilityScore: 0 };
    }
    if (this.startTime === 0) this.startTime = Date.now(); // Asegurar que startTime esté inicializado
    const warmingUp = this.isInWarmup();

    // Paso 1: Detección de movimiento (usa rawValue)
    this.updateMotionDetection(rawValue);

    // Paso 2: Filtrado adaptable (usa rawValue)
    const currentBPMForFilter = this.smoothBPM > 0 ? this.smoothBPM : 75;
    const medianWindow = this.getAdaptiveWindowSize(this.BASE_MEDIAN_WINDOW, this.MAX_MEDIAN_WINDOW, currentBPMForFilter);
    const movingAvgWindow = this.getAdaptiveWindowSize(this.BASE_MOVING_AVG_WINDOW, this.MAX_MOVING_AVG_WINDOW, currentBPMForFilter);
    const medVal = this.medianFilter(rawValue, medianWindow);
    const movAvgVal = this.calculateMovingAverage(medVal, movingAvgWindow);
    const smoothed = this.calculateEMA(movAvgVal); // smoothed = valor filtrado pre-realce

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) this.signalBuffer.shift();

    // Paso 3: Mejora armónica (usa smoothed, devuelve valueForPeakDetection)
    let { valueForPeakDetection, enhancedValueResult } = this.applyHarmonicEnhancement(smoothed, currentBPMForFilter);

    // Paso 4: Actualizar línea base (usa smoothed, pre-realce)
    this.updateSignalBaseline(smoothed);

    // Paso 5: Normalizar y calcular derivada (usa valueForPeakDetection)
    const normalizedValue = valueForPeakDetection - this.baseline;
    const smoothDerivative = this.calculateSmoothedDerivative(valueForPeakDetection); // Calcular derivada aquí

    // Paso 6: Evaluar calidad local y estabilidad de calidad (usa normalizedValue y estabilidad RR)
    const currentQuality = this.calculateLocalSignalQuality(Math.abs(normalizedValue));
    this.localQualityHistory.push(currentQuality);
    if (this.localQualityHistory.length > this.QUALITY_HISTORY_SIZE) this.localQualityHistory.shift();
    this.updateQualityStability(); // Actualiza this.isQualityUnstable

    // Salir si no hay suficientes datos para detección fiable aún
    if (this.signalBuffer.length < 30 || warmingUp) {
       // Calcular BPM final incluso en warmup para actualizar estabilidad
       const bpmDuringWarmup = Math.round(this.getFinalBPM());
       return { bpm: bpmDuringWarmup, confidence: 0, isPeak: false, filteredValue: smoothed, enhancedValue: enhancedValueResult, isMotionDetected: this.isMotionDetected, isQualityUnstable: this.isQualityUnstable, bpmStabilityScore: this.bpmStabilityScore };
    }

    // Resetear si señal baja
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Paso 7: Detectar Pico (ahora usa isQualityUnstable)
    let { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative, this.isQualityUnstable);

    // Paso 8: Aplicar penalización por movimiento
    if (this.isMotionDetected) confidence *= this.MOTION_PENALTY;

    const currentTimestamp = Date.now();
    // Beep
    if (isPeak && confidence > this.MIN_CONFIDENCE * 0.5 && currentTimestamp - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
        this.playBeep(confidence * this.BEEP_VOLUME);
        this.lastBeepTime = currentTimestamp;
    }

    // Paso 9: Confirmar Pico (ahora usa isQualityUnstable)
    const confirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence, this.isQualityUnstable);
    this.lastValue = normalizedValue; // Actualizar último valor *usado* para detección

    // Paso 10: Actualizar BPM (si pico confirmado, no hay movimiento y calidad estable)
    if (confirmedPeak && !this.isMotionDetected && !this.isQualityUnstable) {
        this.updateBPMInternal(currentTimestamp); // Actualiza rrIntervals y bpmHistory
    } else if (confirmedPeak && (this.isMotionDetected || this.isQualityUnstable)) {
        // Si se detecta pico pero hay ruido/inestabilidad, no actualizar BPM y resetear tiempos
        this.lastConfirmedPeak = false; // Evitar que se confirme en el siguiente ciclo si la condición persiste
        this.lastPeakTime = null;      // No usar este pico para el próximo intervalo
        this.previousPeakTime = null;
    }

    // Paso 11: Calcular BPM final (actualiza bpmStabilityScore internamente)
    const finalBPM = Math.round(this.getFinalBPM()); // Llama a getSmoothBPM -> calcula estabilidad

    // Paso 12: Calcular Confianza Final (modulada por estabilidad)
    let finalConfidence = 0;
    if (confirmedPeak) {
        finalConfidence = confidence * this.bpmStabilityScore; // Multiplicar por estabilidad
        if (this.isMotionDetected || this.isQualityUnstable) {
             finalConfidence *= 0.5; // Penalización adicional si hay problemas
        }
    }

    // Paso 13: Retornar resultados
    return {
      bpm: finalBPM,
      confidence: Math.max(0, Math.min(1.0, finalConfidence)), // Asegurar rango 0-1
      isPeak: confirmedPeak && !warmingUp && !this.isMotionDetected && !this.isQualityUnstable,
      filteredValue: smoothed, // Valor post-EMA
      enhancedValue: enhancedValueResult, // Valor post-realce
      isMotionDetected: this.isMotionDetected,
      isQualityUnstable: this.isQualityUnstable,
      bpmStabilityScore: this.bpmStabilityScore
    };
  }

  // --- Métodos Auxiliares Internos ---

  private async initAudio() {
     try {
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        // Solo resumir si está suspendido
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        console.log("HeartBeatProcessor: Audio Context Initialized/Resumed");
      } else if (this.audioContext && this.audioContext.state === 'suspended') {
         // Intentar resumir si existe pero está suspendido
         await this.audioContext.resume();
         console.log("HeartBeatProcessor: Audio Context Resumed");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing/resuming audio", err);
    }
  }

  private async playBeep(volume = this.BEEP_VOLUME) {
      // Verificar monitoreo, warmup y volumen mínimo primero
      if (!this.isMonitoring || this.isInWarmup() || volume <= 0.01) return false;

      const now = Date.now();
      // Verificar intervalo mínimo si no se salta la validación
      if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
          return false;
      }

      // Intentar inicializar/resumir contexto de audio si es necesario
      if (!this.audioContext || this.audioContext.state !== 'running') {
          console.log("Audio context not running, attempting to init/resume...");
          await this.initAudio();
          // Volver a verificar después del intento
          if (!this.audioContext || this.audioContext.state !== 'running') {
              console.warn("HeartBeatProcessor: Audio context still not ready for beep after init/resume attempt.");
              return false;
          }
      }

      try {
          // Crear nodos de audio dentro del try-catch
          const primaryOscillator = this.audioContext.createOscillator();
          const primaryGain = this.audioContext.createGain();
          const secondaryOscillator = this.audioContext.createOscillator();
          const secondaryGain = this.audioContext.createGain();

          const currentTime = this.audioContext.currentTime; // Usar tiempo del contexto

          primaryOscillator.type = "sine";
          primaryOscillator.frequency.setValueAtTime(this.BEEP_PRIMARY_FREQUENCY, currentTime);
          secondaryOscillator.type = "sine";
          secondaryOscillator.frequency.setValueAtTime(this.BEEP_SECONDARY_FREQUENCY, currentTime);

          // Envolvente de ganancia
          primaryGain.gain.setValueAtTime(0, currentTime);
          primaryGain.gain.linearRampToValueAtTime(volume, currentTime + 0.01);
          primaryGain.gain.exponentialRampToValueAtTime(0.01, currentTime + this.BEEP_DURATION / 1000);
          secondaryGain.gain.setValueAtTime(0, currentTime);
          secondaryGain.gain.linearRampToValueAtTime(volume * 0.4, currentTime + 0.01);
          secondaryGain.gain.exponentialRampToValueAtTime(0.01, currentTime + this.BEEP_DURATION / 1000);

          // Conexiones
          primaryOscillator.connect(primaryGain).connect(this.audioContext.destination);
          secondaryOscillator.connect(secondaryGain).connect(this.audioContext.destination);

          // Iniciar y detener osciladores
          primaryOscillator.start(currentTime);
          secondaryOscillator.start(currentTime);
          primaryOscillator.stop(currentTime + this.BEEP_DURATION / 1000 + 0.05); // Un poco más de margen
          secondaryOscillator.stop(currentTime + this.BEEP_DURATION / 1000 + 0.05);

          this.lastBeepTime = now;
          return true;
      } catch (err) {
          console.error("HeartBeatProcessor: Error playing beep sound", err);
          // Si falla, intentar resetear el contexto para la próxima vez? Podría ser arriesgado.
          // this.audioContext = null;
          return false;
      }
  }

  private isInWarmup() {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  private getAdaptiveWindowSize(base: number, max: number, bpm: number): number {
      if (bpm <= this.MIN_BPM) return max;
      if (bpm >= this.MAX_BPM) return base;
      const normalizedBPM = (bpm - this.MIN_BPM) / (this.MAX_BPM - this.MIN_BPM);
      const size = base + (max - base) * (1 - normalizedBPM);
      let roundedSize = Math.round(size);
      if (roundedSize % 2 === 0) { // Asegurar que sea impar
          roundedSize = Math.max(base, roundedSize - 1);
      }
      return Math.min(max, Math.max(base, roundedSize)); // Clampear a límites
  }

  private medianFilter(value: number, windowSize: number) {
     this.medianBuffer.push(value);
    // Mantener buffer al tamaño MÁXIMO para evitar errores al cambiar ventana
    if (this.medianBuffer.length > this.MAX_MEDIAN_WINDOW) {
      this.medianBuffer.shift();
    }
    // Usar solo la ventana actual para cálculo
    const actualWindow = this.medianBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value; // Caso borde
    const sorted = [...actualWindow].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number, windowSize: number) {
     this.movingAverageBuffer.push(value);
     // Mantener buffer al tamaño MÁXIMO
    if (this.movingAverageBuffer.length > this.MAX_MOVING_AVG_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    // Usar solo la ventana actual
    const actualWindow = this.movingAverageBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value;
    const sum = actualWindow.reduce((a, b) => a + b, 0);
    return sum / actualWindow.length;
  }

  private calculateEMA(value) {
     // Inicializar si es necesario
     if (this.smoothedValue === 0 && this.signalBuffer.length === 0) {
        this.smoothedValue = value;
    } else {
        this.smoothedValue = this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    }
    return this.smoothedValue;
  }

  private updateMotionDetection(rawValue: number) {
      this.rawSignalBuffer.push(rawValue);
      if (this.rawSignalBuffer.length > this.MOTION_BUFFER_SIZE) {
          this.rawSignalBuffer.shift();
      }
      if (this.rawSignalBuffer.length < this.MOTION_BUFFER_SIZE) {
          this.isMotionDetected = false;
          this.motionScore = 0;
          return;
      }
      const mean = this.rawSignalBuffer.reduce((a, b) => a + b, 0) / this.MOTION_BUFFER_SIZE;
      let variance = 0;
      for (const val of this.rawSignalBuffer) {
          // Usar Math.pow para asegurar compatibilidad
          variance += Math.pow(val - mean, 2);
      }
      // Asegurar varianza no negativa antes de sqrt
      variance = Math.max(0, variance);
      const stdDev = Math.sqrt(variance / this.MOTION_BUFFER_SIZE);
      // Suavizar score
      this.motionScore = this.motionScore * 0.7 + stdDev * 0.3;
      this.isMotionDetected = this.motionScore > this.MOTION_STD_DEV_THRESHOLD;
  }

  private applyHarmonicEnhancement(smoothed: number, currentBPM: number): { valueForPeakDetection: number, enhancedValueResult?: number } {
    let valueForPeakDetection = smoothed;
    let enhancedValueResult: number | undefined = undefined;
    // Verificar ganancias y BPM válido
    if ((this.HARMONIC_GAIN > 0 || this.HARMONIC_GAIN_2ND > 0 || this.HARMONIC_GAIN_3RD > 0) &&
        currentBPM >= this.MIN_BPM && currentBPM <= this.MAX_BPM)
    {
      const periodSeconds = 60.0 / currentBPM;
      const periodSamples = Math.round(periodSeconds * this.SAMPLE_RATE);
      const bufferIndex = this.signalBuffer.length - 1;
      let enhancement = 0;

      if (this.HARMONIC_GAIN > 0) {
        const delayedIndex1 = bufferIndex - periodSamples;
        if (delayedIndex1 >= 0 && delayedIndex1 < this.signalBuffer.length) { // Doble check
             enhancement += this.HARMONIC_GAIN * this.signalBuffer[delayedIndex1];
        }
      }
      if (this.HARMONIC_GAIN_2ND > 0) {
        const delayedIndex2 = bufferIndex - 2 * periodSamples;
        if (delayedIndex2 >= 0 && delayedIndex2 < this.signalBuffer.length) {
             enhancement += this.HARMONIC_GAIN_2ND * this.signalBuffer[delayedIndex2];
        }
      }
      if (this.HARMONIC_GAIN_3RD > 0) {
        const delayedIndex3 = bufferIndex - 3 * periodSamples;
        if (delayedIndex3 >= 0 && delayedIndex3 < this.signalBuffer.length) {
             enhancement += this.HARMONIC_GAIN_3RD * this.signalBuffer[delayedIndex3];
        }
      }
      // Solo aplicar si hay mejora calculada
      if (enhancement !== 0) {
        valueForPeakDetection = smoothed + enhancement;
        enhancedValueResult = valueForPeakDetection;
      }
    }
    return { valueForPeakDetection, enhancedValueResult };
  }

  private updateSignalBaseline(smoothedValue: number) {
     // Usar mínimo móvil de la señal pre-realce (smoothed)
     if (this.signalBuffer.length > 10) {
         const recentValuesForBaseline = this.signalBuffer.slice(-15).map(v => v);
         let minRecent = recentValuesForBaseline.length > 0 ? recentValuesForBaseline[0] : this.baseline;
         for(let i = 1; i < recentValuesForBaseline.length; i++) {
             if (recentValuesForBaseline[i] < minRecent) minRecent = recentValuesForBaseline[i];
         }
         // Suavizar hacia el mínimo reciente
         this.baseline = this.baseline * 0.9 + minRecent * 0.1;
     } else if (this.signalBuffer.length > 0) {
         // EMA lenta si no hay suficientes datos para mínimo móvil
         this.baseline = this.baseline * this.BASELINE_FACTOR + smoothedValue * (1 - this.BASELINE_FACTOR);
     }
  }

  private calculateSmoothedDerivative(currentValue: number): number {
      this.values.push(currentValue); // Usar valor post-realce/filtrado
      if (this.values.length > 3) this.values.shift();
      let derivative = 0;
      if (this.values.length === 3) {
          // Derivada central
          derivative = (this.values[2] - this.values[0]) / 2;
      } else if (this.values.length === 2) {
          // Derivada hacia atrás simple
          derivative = this.values[1] - this.values[0];
      }
      return derivative;
  }

  // Método auxiliar para calcular calidad local
  private calculateLocalSignalQuality(normalizedAmplitude: number): number {
      const amplitudeScore = Math.min(1.0, Math.max(0, normalizedAmplitude / (this.SIGNAL_THRESHOLD * 1.5)));
      let rrStabilityScore = 0.5; // Default
      if (this.rrIntervals.length >= 5) {
          const meanRR = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
          let varianceRR = 0;
          for (const interval of this.rrIntervals) {
              varianceRR += Math.pow(interval - meanRR, 2);
          }
          if (this.rrIntervals.length > 0) {
            varianceRR = Math.max(0, varianceRR); // Asegurar no negatividad
            const stdDevRR = Math.sqrt(varianceRR / this.rrIntervals.length);
            const relativeStdDev = meanRR > 0 ? stdDevRR / meanRR : 1.0;
            rrStabilityScore = Math.max(0, 1.0 - Math.min(1.0, relativeStdDev / 0.15)); // ~15% varianza máx para score 0
          }
      }
      const combinedQuality = amplitudeScore * 0.6 + rrStabilityScore * 0.4;
      // Aplicar EMA a la puntuación de calidad para suavizarla
      this.lastQualityScore = this.lastQualityScore * 0.8 + combinedQuality * 0.2;
      return this.lastQualityScore;
  }

  // Método auxiliar para actualizar flag de calidad inestable
  private updateQualityStability(): void {
      if (this.localQualityHistory.length < this.QUALITY_HISTORY_SIZE) {
          this.isQualityUnstable = true; // Considerar inestable al inicio o si el historial es corto
          return;
      }
      // Comparar calidad actual (ya suavizada por EMA) con la más antigua en el historial
      const firstQuality = this.localQualityHistory[0];
      const qualityChange = Math.abs(this.lastQualityScore - firstQuality);
      this.isQualityUnstable = qualityChange > this.QUALITY_CHANGE_THRESHOLD;
  }

   private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
         this.resetDetectionStates(); // Solo resetear estados de pico/BPM
         console.log("HeartBeatProcessor: Low signal detected, resetting peak states.");
         this.lowSignalCount = 0; // Resetear contador después de actuar
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    // Solo resetea variables relacionadas con la detección inmediata de picos y BPM
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    this.values = []; // Limpiar buffer de derivada
    this.bpmHistory = []; // Limpiar historial BPM para recalcular
    this.smoothBPM = 75; // Volver a BPM por defecto
    this.rrIntervals = []; // Limpiar intervalos RR también
    this.bpmStabilityScore = 0.5; // Resetear estabilidad
  }

  private detectPeak(normalizedValue: number, derivative: number, isQualityUnstable: boolean): {
    isPeak: boolean;
    confidence: number;
  } {
    const isPotentialPeak =
      normalizedValue > this.SIGNAL_THRESHOLD &&
      derivative < 0 && // Pendiente negativa DESPUÉS del pico
      this.lastValue > 0 && // Evita picos desde negativo
      normalizedValue > this.lastValue; // Estrictamente mayor que el anterior

    const sufficientTimePassed =
      this.lastPeakTime === null ||
      (Date.now() - this.lastPeakTime) > this.MIN_PEAK_TIME_MS;

    let isPeak = isPotentialPeak && sufficientTimePassed;
    let confidence = 0;

    if (isPeak) {
        // Confianza base por amplitud y derivada
        confidence = Math.min(1.0, Math.max(0, (normalizedValue - this.SIGNAL_THRESHOLD) / (this.SIGNAL_THRESHOLD * 1.0)));
        const derivativeFactor = Math.min(1.0, Math.abs(derivative) / (Math.abs(this.DERIVATIVE_THRESHOLD) * 2));
        confidence = confidence * 0.7 + derivativeFactor * 0.3;
        confidence = Math.max(0, Math.min(1.0, confidence)); // Clamp 0-1

        // Aplicar penalización si la calidad es inestable
        if (isQualityUnstable) {
            confidence *= this.QUALITY_TRANSITION_PENALTY;
        }
    }

    // Descartar pico si la confianza es extremadamente baja después de penalizaciones
    if (confidence < this.MIN_CONFIDENCE * 0.3) {
        isPeak = false;
        confidence = 0;
    }

    return { isPeak, confidence };
  }

   private confirmPeak(isPeak: boolean, normalizedValue: number, confidence: number, isQualityUnstable: boolean): boolean {
     this.peakConfirmationBuffer.push(normalizedValue);
     if (this.peakConfirmationBuffer.length > 5) {
       this.peakConfirmationBuffer.shift();
     }

     let isConfirmedThisCycle = false; // Flag local para este ciclo específico
     // Usar umbral de confianza más alto si la calidad es inestable
     const requiredConfidence = isQualityUnstable ? this.MIN_CONFIDENCE * 1.2 : this.MIN_CONFIDENCE;

     // Proceder solo si es un pico candidato, no confirmado previamente, y cumple confianza requerida
     if (isPeak && !this.lastConfirmedPeak && confidence >= requiredConfidence) {
       // Necesita historial suficiente en el buffer de confirmación
       if (this.peakConfirmationBuffer.length >= 3) {
         const len = this.peakConfirmationBuffer.length;
         const peakValue = this.peakConfirmationBuffer[len - 3]; // Pico potencial
         const valueAfter1 = this.peakConfirmationBuffer[len - 2];
         const valueAfter2 = this.peakConfirmationBuffer[len - 1];
         const drop1 = peakValue - valueAfter1;
         const drop2 = valueAfter1 - valueAfter2;
         const MIN_DROP_RATIO = 0.15;

         // Verificar caída significativa o consistente
         const isSignificantDrop = drop1 > Math.abs(peakValue * MIN_DROP_RATIO) || drop2 > Math.abs(peakValue * MIN_DROP_RATIO);
         const isConsistentDrop = drop1 > 0 && drop2 > 0; // Ambas caídas deben ser positivas

         if (isSignificantDrop || isConsistentDrop) {
           isConfirmedThisCycle = true;
           this.lastConfirmedPeak = true; // Actualizar estado global: pico confirmado
         }
       }
     } else if (!isPeak) {
       this.lastConfirmedPeak = false; // Resetear estado global si el candidato actual no es un pico
     }

     return isConfirmedThisCycle; // Devolver si se confirmó *en este ciclo*
   }

   // Actualiza BPM y RR si el pico es válido. Devuelve true si se actualizó.
   private updateBPMInternal(currentTimestamp: number): boolean {
      // Necesitamos el tiempo del último pico *confirmado y válido*
      if (this.lastPeakTime === null) {
          // No hay pico anterior válido para calcular intervalo, solo guardar este
          // this.lastPeakTime se actualiza fuera después de la llamada
          return false; // No se pudo calcular intervalo
      }

      const currentInterval = currentTimestamp - this.lastPeakTime;

      // Filtro de intervalo fisiológico
      const minValidInterval = (60000 / this.MAX_BPM) * 0.8;
      const maxValidInterval = (60000 / this.MIN_BPM) * 1.2;
      if (currentInterval < minValidInterval || currentInterval > maxValidInterval) {
          console.log(`HeartBeatProcessor: Discarding unrealistic interval: ${currentInterval}ms`);
          // No invalidar lastPeakTime aquí, podría ser un outlier aislado
          return false; // Intervalo inválido
      }

      // Calcular BPM instantáneo y actualizar historial
      const instantBPM = 60000 / currentInterval;
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 8) this.bpmHistory.shift(); // Mantener historial corto

      // Guardar intervalo RR válido
      this.rrIntervals.push(currentInterval);
      if (this.rrIntervals.length > 30) this.rrIntervals.shift();

      // La actualización de smoothBPM y bpmStabilityScore se hace en getFinalBPM/getSmoothBPM
      return true; // Intervalo válido procesado
   }

   // Calcula y actualiza el BPM suavizado y la puntuación de estabilidad
  private getSmoothBPM(): number {
    // Si no hay suficiente historial, mantener valor actual y estabilidad baja
    if (this.bpmHistory.length < 3) {
      this.bpmStabilityScore = Math.max(0, this.bpmStabilityScore * 0.9); // Decaer estabilidad gradualmente
      return this.smoothBPM; // Devolver el último valor suavizado conocido
    }

    // Calcular desviación estándar del historial BPM
    const meanBPM = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
    let varianceBPM = 0;
    for(const bpm of this.bpmHistory) {
        varianceBPM += Math.pow(bpm - meanBPM, 2);
    }
    varianceBPM = Math.max(0, varianceBPM); // Asegurar no negatividad
    const stdDevBPM = Math.sqrt(varianceBPM / this.bpmHistory.length);

    // Actualizar puntuación de estabilidad (1 = muy estable, 0 = muy inestable)
    // Mapeo no lineal: más sensible a desviaciones pequeñas
    this.bpmStabilityScore = Math.max(0, 1.0 - Math.min(1.0, (stdDevBPM / this.BPM_STABILITY_THRESHOLD)**0.8 ));

    // Usar mediana para el cálculo del nuevo BPM suavizado (robusto a outliers)
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    const medianBPM = sortedBPMs[Math.floor(sortedBPMs.length / 2)];

    // Suavizar el cambio hacia la mediana usando EMA
    const newSmoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + medianBPM * this.BPM_ALPHA;

    // Actualizar y devolver el BPM suavizado, dentro de límites
    this.smoothBPM = Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, newSmoothBPM));
    return this.smoothBPM;
  }


   // Obtiene el BPM final a mostrar (llama a getSmoothBPM para actualizar estabilidad)
   public getFinalBPM(): number {
     const currentSmoothBPM = this.getSmoothBPM(); // Asegura que estabilidad se actualice
     if (this.isInWarmup() || this.bpmHistory.length < 3) {
       return 75; // Valor por defecto durante warmup o sin historial
     }
     return currentSmoothBPM; // Devolver el BPM suavizado y actualizado
   }
}
