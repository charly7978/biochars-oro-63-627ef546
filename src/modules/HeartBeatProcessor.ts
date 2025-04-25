import { HeartBeatConfig } from './heart-beat/config';

export class HeartBeatProcessor {
  // --- Constantes y Configuraciones ---
  SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE;
  WINDOW_SIZE = 150; // Aumentado para soporte armónico
  MIN_BPM = HeartBeatConfig.MIN_BPM;
  MAX_BPM = HeartBeatConfig.MAX_BPM;
  SIGNAL_THRESHOLD = 0.45; // Reducir umbral para detectar picos más débiles
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

  // Nuevas constantes para validación avanzada
  PEAK_SHAPE_WINDOW = 5; // +/- N muestras alrededor del pico para analizar forma
  MIN_SHAPE_SCORE = 0.6; // Puntuación mínima de forma para confirmar
  AMPLITUDE_CONSISTENCY_FACTOR = 0.5; // Amplitud debe estar dentro de +/- 50% de la media reciente
  INTERVAL_CONSISTENCY_FACTOR = 0.3; // Intervalo debe estar dentro de +/- 30% de la media reciente
  LOW_AMPLITUDE_FACTOR = 1.3; // Picos con amplitud < THRESHOLD * FACTOR necesitan validación estricta
  STRICT_SHAPE_SCORE = 0.75; // Score de forma más alto para picos débiles
  STRICT_CONSISTENCY_FACTOR = 0.2; // Consistencia más estricta para picos débiles
  FINAL_CONFIDENCE_THRESHOLD_FOR_BPM = 0.65; // Confianza final mínima para incluir BPM en historial

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
  peakAmplitudeHistory: number[] = []; // Historial de amplitudes de picos confirmados
  MEAN_AMPLITUDE_HISTORY_SIZE = 5; // Tamaño del historial de amplitud
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
  lowSignalCount = 0;

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
    this.peakAmplitudeHistory = []; // Resetear historial de amplitud
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

    // Resetear estados de pico si señal baja
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Paso 7: Detectar Pico Inicial
    let { isPeak: isPotentialPeak, confidence: initialConfidence } = this.detectPeak(normalizedValue, smoothDerivative, this.isQualityUnstable);

    // Paso 8: Penalización por Movimiento (aplicar a confianza inicial)
    let currentConfidence = initialConfidence;
    if (this.isMotionDetected) currentConfidence *= this.MOTION_PENALTY;

    // Paso 9: Validación Avanzada (Forma y Consistencia) si es pico potencial
    let meetsShapeCriteria = false;
    let meetsConsistencyCriteria = false;
    let shapeScore = 0;
    let finalPeakConfidence = 0;
    let isConfirmedPeak = false;

    if (isPotentialPeak && currentConfidence > this.MIN_CONFIDENCE * 0.1) { // Solo validar si hay alguna confianza inicial
        // Validación de Forma
        const shapeResult = this.validatePeakShape(valueForPeakDetection, this.signalBuffer);
        meetsShapeCriteria = shapeResult.isValid;
        shapeScore = shapeResult.score;

        // Validación de Consistencia (Amplitud e Intervalo)
        const consistencyResult = this.validatePeakConsistency(normalizedValue, Date.now());
        meetsConsistencyCriteria = consistencyResult.isConsistent;

        // Requisitos estrictos para picos de baja amplitud
        const isLowAmplitude = Math.abs(normalizedValue) < this.SIGNAL_THRESHOLD * this.LOW_AMPLITUDE_FACTOR;
        const requiredShapeScore = isLowAmplitude ? this.STRICT_SHAPE_SCORE : this.MIN_SHAPE_SCORE;
        const requiredConsistency = isLowAmplitude ? consistencyResult.meetsStrictCriteria : true; // Solo aplicar consistencia estricta si es baja amplitud

        // Confirmación final
        if (meetsShapeCriteria && shapeScore >= requiredShapeScore && meetsConsistencyCriteria && requiredConsistency) {
            isConfirmedPeak = true;
            // Calcular confianza final combinando inicial, forma, consistencia y estabilidad BPM
            // Ponderación ejemplo: 40% inicial, 30% forma, 30% consistencia * estabilidad BPM
            finalPeakConfidence = currentConfidence * 0.4 + 
                                shapeScore * 0.3 + 
                                (consistencyResult.score * this.bpmStabilityScore) * 0.3;
            finalPeakConfidence = Math.max(0, Math.min(1.0, finalPeakConfidence)); // Clamp 0-1

            // Actualizar historial de amplitud solo si el pico es bueno
            if(finalPeakConfidence > 0.5) { // Umbral para considerar buena amplitud
                this.peakAmplitudeHistory.push(Math.abs(normalizedValue));
                if(this.peakAmplitudeHistory.length > this.MEAN_AMPLITUDE_HISTORY_SIZE) {
                    this.peakAmplitudeHistory.shift();
                }
            }
        } else {
             // Si falla validación avanzada, no es un pico confirmado
             isConfirmedPeak = false;
             finalPeakConfidence = currentConfidence * 0.2; // Dar una confianza baja si falla validación
        }

    } else {
         // No es un pico potencial o confianza inicial muy baja
         isConfirmedPeak = false;
         finalPeakConfidence = 0;
    }

    // Actualizar estado interno de confirmación (usado por confirmPeak original si se mantiene)
    this.lastConfirmedPeak = isConfirmedPeak; 
    this.lastValue = normalizedValue;

    // Paso 10: Beep (basado en confianza *antes* de modulación final? o después? Usemos la final)
    const currentTimestamp = Date.now();
    if (isConfirmedPeak && finalPeakConfidence > 0.4 && currentTimestamp - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
        this.playBeep(finalPeakConfidence * this.BEEP_VOLUME);
        this.lastBeepTime = currentTimestamp;
    }

    // Paso 11: Actualizar BPM (si pico confirmado Y confianza final es suficiente)
    if (isConfirmedPeak && finalPeakConfidence >= this.FINAL_CONFIDENCE_THRESHOLD_FOR_BPM) {
        if (this.updateBPMInternal(currentTimestamp)) { 
            this.previousPeakTime = this.lastPeakTime;
            this.lastPeakTime = currentTimestamp;
        }
    } else if (isConfirmedPeak) {
         // Pico confirmado pero confianza baja, no actualizar BPM pero resetear tiempos
         this.lastPeakTime = null;
         this.previousPeakTime = null;
    }

    // Paso 12: Calcular BPM final (actualiza bpmStabilityScore internamente)
    const finalBPM = Math.round(this.getFinalBPM()); // Llama a getSmoothBPM -> calcula estabilidad

    // Paso 13: Retornar resultados
    return {
      bpm: finalBPM,
      confidence: finalPeakConfidence,
      isPeak: isConfirmedPeak && !warmingUp, // No marcar como pico en warmup
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
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        console.log("HeartBeatProcessor: Audio Context Initialized/Resumed");
      } else if (this.audioContext && this.audioContext.state === 'suspended') {
         await this.audioContext.resume();
         console.log("HeartBeatProcessor: Audio Context Resumed");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing/resuming audio", err);
    }
  }

  private async playBeep(volume = this.BEEP_VOLUME) {
      if (!this.isMonitoring || this.isInWarmup() || volume <= 0.01) return false;
    const now = Date.now();
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    if (!this.audioContext || this.audioContext.state !== 'running') {
        console.log("Audio context not running, attempting to init/resume...");
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
            console.warn("HeartBeatProcessor: Audio context still not ready for beep after init/resume attempt.");
            return false;
        }
    }
    try {
        const primaryOscillator = this.audioContext.createOscillator();
        const primaryGain = this.audioContext.createGain();
        const secondaryOscillator = this.audioContext.createOscillator();
        const secondaryGain = this.audioContext.createGain();
        const currentTime = this.audioContext.currentTime;
        primaryOscillator.type = "sine";
        primaryOscillator.frequency.setValueAtTime(this.BEEP_PRIMARY_FREQUENCY, currentTime);
        secondaryOscillator.type = "sine";
        secondaryOscillator.frequency.setValueAtTime(this.BEEP_SECONDARY_FREQUENCY, currentTime);
        primaryGain.gain.setValueAtTime(0, currentTime);
        primaryGain.gain.linearRampToValueAtTime(volume, currentTime + 0.01);
        primaryGain.gain.exponentialRampToValueAtTime(0.01, currentTime + this.BEEP_DURATION / 1000);
        secondaryGain.gain.setValueAtTime(0, currentTime);
        secondaryGain.gain.linearRampToValueAtTime(volume * 0.4, currentTime + 0.01);
        secondaryGain.gain.exponentialRampToValueAtTime(0.01, currentTime + this.BEEP_DURATION / 1000);
        primaryOscillator.connect(primaryGain).connect(this.audioContext.destination);
        secondaryOscillator.connect(secondaryGain).connect(this.audioContext.destination);
        primaryOscillator.start(currentTime);
        secondaryOscillator.start(currentTime);
        primaryOscillator.stop(currentTime + this.BEEP_DURATION / 1000 + 0.05);
        secondaryOscillator.stop(currentTime + this.BEEP_DURATION / 1000 + 0.05);
        this.lastBeepTime = now;
        return true;
    } catch (err) {
        console.error("HeartBeatProcessor: Error playing beep sound", err);
        return false;
    }
  }

  private isInWarmup() {
    // Asegura que startTime sea un número antes de comparar
    const startTimeNum = typeof this.startTime === 'number' ? this.startTime : 0;
    return Date.now() - startTimeNum < this.WARMUP_TIME_MS;
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
    if (this.medianBuffer.length > this.MAX_MEDIAN_WINDOW) {
      this.medianBuffer.shift();
    }
    const actualWindow = this.medianBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value;
    const sorted = [...actualWindow].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number, windowSize: number) {
     this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MAX_MOVING_AVG_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const actualWindow = this.movingAverageBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value;
    const sum = actualWindow.reduce((a, b) => a + b, 0);
    return sum / actualWindow.length;
  }

  private calculateEMA(value: number): number {
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
          variance += Math.pow(val - mean, 2);
      }
      variance = Math.max(0, variance);
      const stdDev = Math.sqrt(variance / this.MOTION_BUFFER_SIZE);
      this.motionScore = this.motionScore * 0.7 + stdDev * 0.3;
      this.isMotionDetected = this.motionScore > this.MOTION_STD_DEV_THRESHOLD;
  }

  private applyHarmonicEnhancement(smoothed: number, currentBPM: number): { valueForPeakDetection: number, enhancedValueResult?: number } {
    let valueForPeakDetection = smoothed;
    let enhancedValueResult: number | undefined = undefined;
    if ((this.HARMONIC_GAIN > 0 || this.HARMONIC_GAIN_2ND > 0 || this.HARMONIC_GAIN_3RD > 0) &&
        currentBPM >= this.MIN_BPM && currentBPM <= this.MAX_BPM)
    {
      const periodSeconds = 60.0 / currentBPM;
      const periodSamples = Math.round(periodSeconds * this.SAMPLE_RATE);
      const bufferIndex = this.signalBuffer.length - 1;
      let enhancement = 0;
      if (periodSamples > 0) { // Evitar división por cero o bucles infinitos si BPM es irreal
          if (this.HARMONIC_GAIN > 0) {
            const delayedIndex1 = bufferIndex - periodSamples;
            if (delayedIndex1 >= 0 && delayedIndex1 < this.signalBuffer.length) {
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
      }
      if (enhancement !== 0) {
        valueForPeakDetection = smoothed + enhancement;
        enhancedValueResult = valueForPeakDetection;
      }
    }
    return { valueForPeakDetection, enhancedValueResult };
  }

  private updateSignalBaseline(smoothedValue: number) {
     if (this.signalBuffer.length > 10) {
         const recentValuesForBaseline = this.signalBuffer.slice(-15).map(v => v);
         let minRecent = recentValuesForBaseline.length > 0 ? recentValuesForBaseline[0] : this.baseline;
         for(let i = 1; i < recentValuesForBaseline.length; i++) {
             if (recentValuesForBaseline[i] < minRecent) minRecent = recentValuesForBaseline[i];
         }
         this.baseline = this.baseline * 0.9 + minRecent * 0.1;
     } else if (this.signalBuffer.length > 0) {
         this.baseline = this.baseline * this.BASELINE_FACTOR + smoothedValue * (1 - this.BASELINE_FACTOR);
     }
     // Asegurar que baseline no sea NaN
     if (isNaN(this.baseline)) this.baseline = 0;
  }

  private calculateSmoothedDerivative(currentValue: number): number {
      this.values.push(currentValue);
      if (this.values.length > 3) this.values.shift();
      let derivative = 0;
      if (this.values.length === 3) {
          derivative = (this.values[2] - this.values[0]) / 2;
      } else if (this.values.length === 2) {
          derivative = this.values[1] - this.values[0];
      }
      return isNaN(derivative) ? 0 : derivative; // Evitar NaN
  }

  private calculateLocalSignalQuality(normalizedAmplitude: number): number {
      const amplitudeScore = Math.min(1.0, Math.max(0, normalizedAmplitude / (this.SIGNAL_THRESHOLD * 1.5)));
      let rrStabilityScore = 0.5;
      if (this.rrIntervals.length >= 5) {
          const meanRR = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
          let varianceRR = 0;
          for (const interval of this.rrIntervals) {
              varianceRR += Math.pow(interval - meanRR, 2);
          }
          if (this.rrIntervals.length > 0) {
            varianceRR = Math.max(0, varianceRR);
            const stdDevRR = Math.sqrt(varianceRR / this.rrIntervals.length);
            const relativeStdDev = meanRR > 0 ? stdDevRR / meanRR : 1.0;
            rrStabilityScore = Math.max(0, 1.0 - Math.min(1.0, relativeStdDev / 0.15));
          }
      }
      const combinedQuality = amplitudeScore * 0.6 + rrStabilityScore * 0.4;
      this.lastQualityScore = this.lastQualityScore * 0.8 + combinedQuality * 0.2;
      return isNaN(this.lastQualityScore) ? 0.5 : this.lastQualityScore; // Evitar NaN
  }

  private updateQualityStability(): void {
      if (this.localQualityHistory.length < this.QUALITY_HISTORY_SIZE) {
          this.isQualityUnstable = true;
          return;
      }
      const firstQuality = this.localQualityHistory[0];
      const qualityChange = Math.abs(this.lastQualityScore - firstQuality);
      this.isQualityUnstable = qualityChange > this.QUALITY_CHANGE_THRESHOLD;
  }

   private autoResetIfSignalIsLow(amplitude: number) {
    // Usar valor absoluto para amplitud
    const absAmplitude = Math.abs(amplitude);
    if (absAmplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
         this.resetDetectionStates();
         console.log("HeartBeatProcessor: Low signal detected, resetting peak states.");
         this.lowSignalCount = 0;
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    this.values = [];
    this.bpmHistory = [];
    this.smoothBPM = 75;
    this.rrIntervals = [];
    this.bpmStabilityScore = 0.5;
  }

  private detectPeak(normalizedValue: number, derivative: number, isQualityUnstable: boolean): {
    isPeak: boolean;
    confidence: number;
  } {
    const isPotentialPeak =
      normalizedValue > this.SIGNAL_THRESHOLD &&
      derivative < 0 &&
      this.lastValue > 0 &&
      normalizedValue > this.lastValue;

    const timeNow = Date.now();
    const sufficientTimePassed =
      this.lastPeakTime === null ||
      (timeNow - this.lastPeakTime) > this.MIN_PEAK_TIME_MS;

    const isPeak = isPotentialPeak && sufficientTimePassed;
    let confidence = 0;

    if (isPeak) {
        // Confianza inicial basada en amplitud y claridad de derivada
        confidence = Math.min(1.0, Math.max(0, (normalizedValue - this.SIGNAL_THRESHOLD) / (this.SIGNAL_THRESHOLD * 1.0)));
        const derivativeFactor = Math.min(1.0, Math.abs(derivative) / (Math.abs(this.DERIVATIVE_THRESHOLD) * 2));
        confidence = confidence * 0.7 + derivativeFactor * 0.3;
        confidence = Math.max(0, Math.min(1.0, confidence));

        // Penalización por calidad inestable se aplica aquí a la confianza inicial
        if (isQualityUnstable) {
            confidence *= this.QUALITY_TRANSITION_PENALTY;
        }
    }
    // No descartar pico aquí, solo calcular confianza inicial
    return { isPeak, confidence };
  }

   // Nuevo: Valida la forma del pico
   private validatePeakShape(peakValue: number, buffer: number[]): { isValid: boolean, score: number } {
       const peakIndex = buffer.length - 1; // Asumimos que el pico es el último valor en el buffer corto `values`
                                           // NO, esto es incorrecto. Necesitamos pasar la ventana correcta.
       // Corrección: Necesitamos el índice real del pico en signalBuffer o pasar una ventana centrada.
       // Por simplicidad ahora, usaremos una ventana fija alrededor del valor actual en signalBuffer
       const windowRadius = this.PEAK_SHAPE_WINDOW;
       const currentIndexInBuffer = this.signalBuffer.length - 1;
       const startIndex = Math.max(0, currentIndexInBuffer - windowRadius);
       const endIndex = Math.min(this.signalBuffer.length -1, currentIndexInBuffer + windowRadius);
       const window = this.signalBuffer.slice(startIndex, endIndex + 1);
       const localPeakIndex = currentIndexInBuffer - startIndex; // Índice del pico dentro de la ventana

       if (window.length < 2 * windowRadius + 1 || localPeakIndex < windowRadius || localPeakIndex >= window.length - windowRadius) {
           return { isValid: false, score: 0 }; // No hay suficientes datos para analizar forma
       }

       const localPeakValue = window[localPeakIndex];

       // 1. Verificar si es un máximo local claro
       let isMax = true;
       for (let i = 1; i <= windowRadius; i++) {
           if (window[localPeakIndex - i] >= localPeakValue || window[localPeakIndex + i] >= localPeakValue) {
               isMax = false;
               break;
           }
       }
       if (!isMax) return { isValid: false, score: 0.1 };

       // 2. Verificar subida y bajada
       const valueBefore = window[localPeakIndex - windowRadius];
       const valueAfter = window[localPeakIndex + windowRadius];
       const rise = localPeakValue - valueBefore;
       const fall = localPeakValue - valueAfter;

       if (rise <= 0 || fall <= 0) return { isValid: false, score: 0.2 }; // Debe haber subida y bajada

       // 3. Calcular puntuación (más simétrico = mejor, ratios razonables)
       const symmetry = 1.0 - Math.abs(rise - fall) / (rise + fall + 1e-6); // Evitar división por cero
       const steepness = (rise + fall) / (2 * windowRadius); // Pendiente promedio

       // Puntuación combinada (ejemplo simple)
       let score = (symmetry * 0.5 + Math.min(1, steepness / 0.1) * 0.5); // Normalizar pendiente
       score = Math.max(0, Math.min(1, score));

       return { isValid: score >= this.MIN_SHAPE_SCORE, score };
   }

   // Nuevo: Valida la consistencia de amplitud e intervalo
   private validatePeakConsistency(normalizedAmplitude: number, currentTimestamp: number): 
       { isConsistent: boolean, meetsStrictCriteria: boolean, score: number } 
   {
       let ampConsistent = true;
       let intervalConsistent = true;
       let meetsStrictAmp = true;
       let meetsStrictInt = true;
       let consistencyScore = 0.5; // Default

       // Consistencia de Amplitud
       if (this.peakAmplitudeHistory.length >= 3) {
           const meanAmp = this.peakAmplitudeHistory.reduce((a, b) => a + b, 0) / this.peakAmplitudeHistory.length;
           const lowerBound = meanAmp * (1 - this.AMPLITUDE_CONSISTENCY_FACTOR);
           const upperBound = meanAmp * (1 + this.AMPLITUDE_CONSISTENCY_FACTOR);
           ampConsistent = normalizedAmplitude >= lowerBound && normalizedAmplitude <= upperBound;

           const strictLower = meanAmp * (1 - this.STRICT_CONSISTENCY_FACTOR);
           const strictUpper = meanAmp * (1 + this.STRICT_CONSISTENCY_FACTOR);
           meetsStrictAmp = normalizedAmplitude >= strictLower && normalizedAmplitude <= strictUpper;
       } else {
           ampConsistent = true; // No hay historial suficiente para juzgar
           meetsStrictAmp = true;
       }

       // Consistencia de Intervalo
       if (this.rrIntervals.length >= 3 && this.lastPeakTime !== null) {
           const currentInterval = currentTimestamp - this.lastPeakTime;
           const meanInterval = this.rrIntervals.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, this.rrIntervals.length);
           const lowerBound = meanInterval * (1 - this.INTERVAL_CONSISTENCY_FACTOR);
           const upperBound = meanInterval * (1 + this.INTERVAL_CONSISTENCY_FACTOR);
           intervalConsistent = currentInterval >= lowerBound && currentInterval <= upperBound;

           const strictLower = meanInterval * (1 - this.STRICT_CONSISTENCY_FACTOR);
           const strictUpper = meanInterval * (1 + this.STRICT_CONSISTENCY_FACTOR);
           meetsStrictInt = currentInterval >= strictLower && currentInterval <= strictUpper;
       } else {
           intervalConsistent = true; // No hay historial suficiente
           meetsStrictInt = true;
       }
       
       // Calcular puntuación combinada
       const ampScore = ampConsistent ? (meetsStrictAmp ? 1.0 : 0.7) : 0.2;
       const intScore = intervalConsistent ? (meetsStrictInt ? 1.0 : 0.7) : 0.2;
       consistencyScore = ampScore * 0.5 + intScore * 0.5;

       const isOverallConsistent = ampConsistent && intervalConsistent;
       const meetsOverallStrict = meetsStrictAmp && meetsStrictInt;

       return { isConsistent: isOverallConsistent, meetsStrictCriteria: meetsOverallStrict, score: consistencyScore };
   }

   private updateBPMInternal(currentTimestamp: number): boolean {
      if (this.lastPeakTime === null) {
          return false;
      }
      const currentInterval = currentTimestamp - this.lastPeakTime;
      const minValidInterval = (60000 / this.MAX_BPM) * 0.8;
      const maxValidInterval = (60000 / this.MIN_BPM) * 1.2;
      if (currentInterval < minValidInterval || currentInterval > maxValidInterval) {
          console.log(`HeartBeatProcessor: Discarding unrealistic interval: ${currentInterval}ms`);
          return false;
      }
      const instantBPM = 60000 / currentInterval;
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 8) this.bpmHistory.shift();
      this.rrIntervals.push(currentInterval);
      if (this.rrIntervals.length > 30) this.rrIntervals.shift();
      return true;
   }

  private getSmoothBPM(): number {
    if (this.bpmHistory.length < 3) {
      this.bpmStabilityScore = Math.max(0, this.bpmStabilityScore * 0.9);
      return this.smoothBPM > 0 ? this.smoothBPM : 75;
    }
    const meanBPM = this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
    let varianceBPM = 0;
    for(const bpm of this.bpmHistory) {
        varianceBPM += Math.pow(bpm - meanBPM, 2);
    }
    varianceBPM = Math.max(0, varianceBPM);
    const stdDevBPM = Math.sqrt(varianceBPM / this.bpmHistory.length);
    this.bpmStabilityScore = Math.max(0, 1.0 - Math.min(1.0, (stdDevBPM / this.BPM_STABILITY_THRESHOLD)**0.8 ));
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    const medianBPM = sortedBPMs[Math.floor(sortedBPMs.length / 2)];
    const newSmoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + medianBPM * this.BPM_ALPHA;
    this.smoothBPM = Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, newSmoothBPM));
    if (isNaN(this.smoothBPM)) this.smoothBPM = 75;
    return this.smoothBPM;
  }

   public getFinalBPM(): number {
     const currentSmoothBPM = this.getSmoothBPM();
     if (this.isInWarmup() || this.bpmHistory.length < 3) {
       return 75;
     }
     return currentSmoothBPM;
   }
}
