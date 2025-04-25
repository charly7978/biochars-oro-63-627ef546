import { HeartBeatConfig } from './heart-beat/config'; // Asegúrate de que la ruta sea correcta

export class HeartBeatProcessor {
  SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE; // Usar config
  WINDOW_SIZE = HeartBeatConfig.WINDOW_SIZE;
  MIN_BPM = HeartBeatConfig.MIN_BPM;
  MAX_BPM = HeartBeatConfig.MAX_BPM;
  SIGNAL_THRESHOLD = HeartBeatConfig.SIGNAL_THRESHOLD;
  MIN_CONFIDENCE = HeartBeatConfig.MIN_CONFIDENCE;
  DERIVATIVE_THRESHOLD = HeartBeatConfig.DERIVATIVE_THRESHOLD;
  MIN_PEAK_TIME_MS = HeartBeatConfig.MIN_PEAK_TIME_MS;
  WARMUP_TIME_MS = HeartBeatConfig.WARMUP_TIME_MS;

  // Tamaños base y máximos para ventanas adaptables
  BASE_MEDIAN_WINDOW = 3;
  MAX_MEDIAN_WINDOW = 7; // Máximo tamaño para mediana
  BASE_MOVING_AVG_WINDOW = 5;
  MAX_MOVING_AVG_WINDOW = 11; // Máximo tamaño para media móvil

  // Configuración para detección de movimiento
  MOTION_STD_DEV_THRESHOLD = 0.6; // Umbral de desviación estándar para detectar movimiento (ajustable)
  MOTION_BUFFER_SIZE = 15; // Número de muestras crudas para analizar movimiento
  MOTION_PENALTY = 0.1; // Factor por el cual se reduce la confianza si hay movimiento

  EMA_ALPHA = HeartBeatConfig.EMA_ALPHA;
  BASELINE_FACTOR = HeartBeatConfig.BASELINE_FACTOR;

  BEEP_PRIMARY_FREQUENCY = HeartBeatConfig.BEEP_PRIMARY_FREQUENCY;
  BEEP_SECONDARY_FREQUENCY = HeartBeatConfig.BEEP_SECONDARY_FREQUENCY;
  BEEP_DURATION = HeartBeatConfig.BEEP_DURATION;
  BEEP_VOLUME = HeartBeatConfig.BEEP_VOLUME;
  MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;

  LOW_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  LOW_SIGNAL_FRAMES = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  lowSignalCount = 0;

  FORCE_IMMEDIATE_BEEP = true;
  SKIP_TIMING_VALIDATION = true;

  private isMonitoring = false;

  // Buffers de señal
  signalBuffer = []; // Buffer de señal filtrada
  rawSignalBuffer = []; // Buffer de señal cruda para detección de movimiento
  medianBuffer = [];
  movingAverageBuffer = [];
  smoothedValue = 0;

  // Estado de detección de picos y BPM
  lastPeakTime = null;
  previousPeakTime = null;
  bpmHistory = [];
  baseline = 0;
  lastValue = 0; // Último valor normalizado
  values = []; // Buffer corto para derivada
  peakConfirmationBuffer = [];
  lastConfirmedPeak = false;
  smoothBPM = 75; // Iniciar con un valor por defecto razonable
  BPM_ALPHA = 0.2;
  rrIntervals: number[] = [];

  // Estado de movimiento
  motionScore = 0; // Puntuación suavizada de movimiento
  isMotionDetected = false;

  // Otros estados
  audioContext = null;
  lastBeepTime = 0;
  startTime = 0;

  // Ganancia para la mejora armónica (0 = desactivado)
  HARMONIC_GAIN = 0.4; // Ajustable (0.3 - 0.6 es un buen punto de partida)

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
    this.reset(); // Inicializar todos los estados
  }

  /**
   * Establece el estado de monitoreo del procesador
   * @param monitoring Verdadero para activar el monitoreo, falso para desactivarlo
   */
  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    console.log(`HeartBeatProcessor: Monitoring set to ${monitoring}`);
    if (monitoring && this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context", err);
      });
    }
    if (!monitoring) {
      this.reset(); // Resetear estado al detener
    } else {
       this.startTime = Date.now(); // Reiniciar tiempo de warmup al iniciar
    }
  }

  /**
   * Obtiene el estado actual de monitoreo
   * @returns Verdadero si el monitoreo está activo
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  async initAudio() {
    try {
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        // No reproducir beep silencioso aquí, hacerlo en playBeep si es necesario
        console.log("HeartBeatProcessor: Audio Context Initialized");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    if (!this.isMonitoring || this.isInWarmup() || volume <= 0.01) return false;

    const now = Date.now();
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

    try {
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio(); // Intentar inicializar/resumir si no está listo
        if (!this.audioContext || this.audioContext.state !== 'running') {
          console.warn("HeartBeatProcessor: Audio context not ready for beep.");
          return false;
        }
      }

      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(this.BEEP_PRIMARY_FREQUENCY, this.audioContext.currentTime);
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(this.BEEP_SECONDARY_FREQUENCY, this.audioContext.currentTime);

      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      primaryGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.BEEP_DURATION / 1000);

      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(volume * 0.4, this.audioContext.currentTime + 0.01);
      secondaryGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + this.BEEP_DURATION / 1000);

      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      primaryOscillator.start(this.audioContext.currentTime);
      secondaryOscillator.start(this.audioContext.currentTime);
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);

      this.lastBeepTime = now;
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error playing beep", err);
      return false;
    }
  }

  isInWarmup() {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  // --- Funciones de Filtro con Tamaño Adaptable ---
  getAdaptiveWindowSize(base: number, max: number, bpm: number): number {
      if (bpm <= this.MIN_BPM) return max;
      if (bpm >= this.MAX_BPM) return base;

      // Mapear BPM al rango 0-1
      const normalizedBPM = (bpm - this.MIN_BPM) / (this.MAX_BPM - this.MIN_BPM);
      // Interpolar tamaño de ventana (mayor BPM -> menor ventana)
      const size = base + (max - base) * (1 - normalizedBPM);
      // Redondear al entero impar más cercano
      let roundedSize = Math.round(size);
      if (roundedSize % 2 === 0) {
          roundedSize = Math.max(base, roundedSize - 1); // Asegurar impar y no menor que base
      }
      return Math.min(max, Math.max(base, roundedSize)); // Asegurar dentro de límites
  }


  medianFilter(value: number, windowSize: number) {
    this.medianBuffer.push(value);
    // Mantener el buffer al tamaño de la ventana MÁXIMA para evitar errores al cambiar
    if (this.medianBuffer.length > this.MAX_MEDIAN_WINDOW) {
      this.medianBuffer.shift();
    }
    // Usar solo los últimos 'windowSize' elementos para el cálculo
    const actualWindow = this.medianBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value; // Devolver valor si la ventana está vacía

    const sorted = [...actualWindow].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  calculateMovingAverage(value: number, windowSize: number) {
    this.movingAverageBuffer.push(value);
     // Mantener el buffer al tamaño de la ventana MÁXIMA
    if (this.movingAverageBuffer.length > this.MAX_MOVING_AVG_WINDOW) {
      this.movingAverageBuffer.shift();
    }
     // Usar solo los últimos 'windowSize' elementos
    const actualWindow = this.movingAverageBuffer.slice(-windowSize);
    if (actualWindow.length === 0) return value;

    const sum = actualWindow.reduce((a, b) => a + b, 0);
    return sum / actualWindow.length;
  }

  calculateEMA(value) {
    // Inicializar smoothedValue si es la primera vez o es 0
    if (this.smoothedValue === 0 && this.signalBuffer.length === 0) {
        this.smoothedValue = value;
    } else {
        this.smoothedValue = this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    }
    return this.smoothedValue;
  }

  // --- Detección de Movimiento ---
  updateMotionDetection(rawValue: number) {
      this.rawSignalBuffer.push(rawValue);
      if (this.rawSignalBuffer.length > this.MOTION_BUFFER_SIZE) {
          this.rawSignalBuffer.shift();
      }

      if (this.rawSignalBuffer.length < this.MOTION_BUFFER_SIZE) {
          this.isMotionDetected = false; // No suficiente data
          this.motionScore = 0;
          return;
      }

      // Calcular desviación estándar de la señal cruda reciente
      const mean = this.rawSignalBuffer.reduce((a, b) => a + b, 0) / this.MOTION_BUFFER_SIZE;
      let variance = 0;
      for (const val of this.rawSignalBuffer) {
          variance += (val - mean) * (val - mean);
      }
      const stdDev = Math.sqrt(variance / this.MOTION_BUFFER_SIZE);

      // Normalizar (opcional, podría necesitar ajuste)
      // const normalizedStdDev = stdDev / (Math.abs(this.baseline) + 1e-6); // Evitar división por cero

      // Suavizar la puntuación de movimiento
      // Usaremos la stdDev directamente como puntuación por simplicidad inicial
      this.motionScore = this.motionScore * 0.7 + stdDev * 0.3; // EMA para suavizar

      this.isMotionDetected = this.motionScore > this.MOTION_STD_DEV_THRESHOLD;

      // Log si se detecta movimiento
      // if (this.isMotionDetected) {
      //    console.log(`Motion Detected: Score=${this.motionScore.toFixed(3)}, StdDev=${stdDev.toFixed(3)}`);
      // }
  }


  // --- Procesamiento Principal ---
  processSignal(rawValue: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    enhancedValue?: number;
    isMotionDetected: boolean;
  } {
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: 0, isMotionDetected: false };
    }

    if (this.startTime === 0) {
      this.startTime = Date.now();
    }

    // 1. Detección de Movimiento
    this.updateMotionDetection(rawValue);

    // 2. Filtrado con Ventanas Adaptables
    const currentBPM = this.smoothBPM > 0 ? this.smoothBPM : 75;
    const medianWindow = this.getAdaptiveWindowSize(this.BASE_MEDIAN_WINDOW, this.MAX_MEDIAN_WINDOW, currentBPM);
    const movingAvgWindow = this.getAdaptiveWindowSize(this.BASE_MOVING_AVG_WINDOW, this.MAX_MOVING_AVG_WINDOW, currentBPM);

    const medVal = this.medianFilter(rawValue, medianWindow);
    const movAvgVal = this.calculateMovingAverage(medVal, movingAvgWindow);
    const smoothed = this.calculateEMA(movAvgVal);

    // Almacenar valor filtrado (antes de realce) en el buffer principal
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Valor a usar para detección de picos (puede ser realzado)
    let valueForPeakDetection = smoothed;
    let enhancedValueResult: number | undefined = undefined; // Para el retorno

    // 3. Mejora Armónica (si está activada y hay suficiente data)
    if (this.HARMONIC_GAIN > 0 && currentBPM >= this.MIN_BPM && currentBPM <= this.MAX_BPM && this.signalBuffer.length >= this.WINDOW_SIZE * 0.8) {
        const periodSeconds = 60.0 / currentBPM;
        const periodSamples = Math.round(periodSeconds * this.SAMPLE_RATE);
        const bufferIndex = this.signalBuffer.length - 1; // Índice actual
        const delayedIndex = bufferIndex - periodSamples;

        // Asegurarse de que el índice retrasado es válido
        if (delayedIndex >= 0 && delayedIndex < this.signalBuffer.length) {
            const delayedSmoothedValue = this.signalBuffer[delayedIndex];
            valueForPeakDetection = smoothed + this.HARMONIC_GAIN * delayedSmoothedValue;
            enhancedValueResult = valueForPeakDetection;
        }
    }

    // Mover la actualización de la línea base aquí, DESPUÉS del posible realce
    // para que la línea base siga la señal que se usará para la detección.
    // 4. Actualización de Línea Base (usando valueForPeakDetection)
    if (this.signalBuffer.length > 10) { // Usar signalBuffer.length como indicador de madurez
        const recentValuesForBaseline = this.signalBuffer.slice(-15).map(v => v); // Usar valores del buffer (pre-realce)
        let minRecent = recentValuesForBaseline[0];
        for(let i = 1; i < recentValuesForBaseline.length; i++) {
            if (recentValuesForBaseline[i] < minRecent) minRecent = recentValuesForBaseline[i];
        }
        // La línea base debe seguir los valles de la señal original (pre-realce)
        this.baseline = this.baseline * 0.9 + minRecent * 0.1;
    } else if (this.signalBuffer.length > 0) {
        this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);
    }

    if (this.signalBuffer.length < 30) { // Aún esperando suficientes datos para detección fiable
      return { bpm: Math.round(this.getFinalBPM()), confidence: 0, isPeak: false, filteredValue: smoothed, enhancedValue: enhancedValueResult, isMotionDetected: this.isMotionDetected };
    }

    // 5. Normalización y Derivada (usando valueForPeakDetection)
    const normalizedValue = valueForPeakDetection - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue)); // Basado en señal normalizada

    // Usar valueForPeakDetection para la derivada, ya que buscamos picos en esta señal
    this.values.push(valueForPeakDetection);
    if (this.values.length > 3) {
      this.values.shift();
    }
    let smoothDerivative = 0;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    } else if (this.values.length === 2) {
      smoothDerivative = this.values[1] - this.values[0];
    }

    // 6. Detección de Pico (usando señal normalizada y derivada)
    let { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);

    // 7. Penalización por Movimiento
    if (this.isMotionDetected) {
        confidence *= this.MOTION_PENALTY;
    }

    const currentTimestamp = Date.now();
    // Beep inmediato
    if (isPeak && confidence > this.MIN_CONFIDENCE * 0.5 && currentTimestamp - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
        this.playBeep(confidence * this.BEEP_VOLUME);
        this.lastBeepTime = currentTimestamp;
    }

    // 8. Confirmación de Pico
    // Usar el valor normalizado (realzado o no) para la confirmación
    const confirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    this.lastValue = normalizedValue; // Actualizar último valor normalizado

    // 9. Actualización de BPM (solo si no hay movimiento y se confirma pico)
    if (confirmedPeak && !this.isMotionDetected) {
        this.updateBPM();

        if (this.previousPeakTime !== null && this.lastPeakTime !== null) {
            const rrInterval = this.lastPeakTime - this.previousPeakTime;
            if (rrInterval > 250 && rrInterval < 2000) {
                this.rrIntervals.push(rrInterval);
                if (this.rrIntervals.length > 30) this.rrIntervals.shift();
            }
        }
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = currentTimestamp;
    } else if (confirmedPeak && this.isMotionDetected) {
        this.lastConfirmedPeak = false;
    }

    // 10. Retornar Resultados
    return {
      bpm: Math.round(this.getFinalBPM()),
      confidence: this.isMotionDetected ? confidence : (confirmedPeak ? confidence : 0),
      isPeak: confirmedPeak && !this.isInWarmup() && !this.isMotionDetected,
      filteredValue: smoothed, // Devolver valor post-EMA
      enhancedValue: enhancedValueResult, // Devolver valor realzado si se calculó
      isMotionDetected: this.isMotionDetected
    };
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const isPotentialPeak =
      normalizedValue > this.SIGNAL_THRESHOLD &&
      derivative < 0 && // Pendiente negativa DESPUÉS del pico
      this.lastValue > 0 && // Asegurarse que venimos de un valor positivo (evita picos desde negativo)
      normalizedValue > this.lastValue; // Estrictamente mayor que el anterior

    const sufficientTimePassed =
      this.lastPeakTime === null ||
      (Date.now() - this.lastPeakTime) > this.MIN_PEAK_TIME_MS;

    const isPeak = isPotentialPeak && sufficientTimePassed;

    let confidence = 0;
    if (isPeak) {
      // Confianza basada en amplitud normalizada relativa al umbral
      confidence = Math.min(1.0, Math.max(0, (normalizedValue - this.SIGNAL_THRESHOLD) / (this.SIGNAL_THRESHOLD * 1.0))); // Ajustado para ser 0 en el umbral y 1 en 2*umbral
      // Considerar también la "claridad" de la bajada (derivada negativa)
      const derivativeFactor = Math.min(1.0, Math.abs(derivative) / (Math.abs(this.DERIVATIVE_THRESHOLD) * 2));
      confidence = confidence * 0.7 + derivativeFactor * 0.3; // Ponderar
      confidence = Math.max(0, Math.min(1.0, confidence)); // Asegurar rango 0-1
    }


    return { isPeak, confidence };
  }


  autoResetIfSignalIsLow(amplitude) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        // No resetear todo, solo el estado de picos para recalcular BPM
         this.resetDetectionStates();
         console.log("HeartBeatProcessor: Low signal detected, resetting peak states.");
         this.lowSignalCount = 0; // Resetear contador después de actuar
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates() {
    // Solo resetea variables relacionadas con la detección inmediata de picos y BPM
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakConfirmationBuffer = [];
    this.values = []; // Limpiar buffer de derivada
    this.bpmHistory = []; // Limpiar historial BPM para recalcular
    this.smoothBPM = 75; // Volver a BPM por defecto
    this.rrIntervals = []; // Limpiar intervalos RR
    // No resetear baseline, signalBuffer, smoothedValue, motionScore
  }

  // Usar la función confirmPeak mejorada importada o definida en peak-detector.ts
  // Aquí asumimos que está definida en este archivo por simplicidad del ejemplo
  // (En un caso real, se importaría o se refactorizaría a un archivo utils)
   confirmPeak(isPeak, normalizedValue, confidence) {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    let isConfirmedPeak = false;
    let updatedLastConfirmedPeak = this.lastConfirmedPeak; // Necesitamos actualizar el estado interno

    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        const peakValue = this.peakConfirmationBuffer[len - 3];
        const valueAfter1 = this.peakConfirmationBuffer[len - 2];
        const valueAfter2 = this.peakConfirmationBuffer[len - 1];

        const drop1 = peakValue - valueAfter1;
        const drop2 = valueAfter1 - valueAfter2;
        const MIN_DROP_RATIO = 0.15;

        // Requerir que al menos una de las caídas sea significativa O que ambas sean negativas
        const isSignificantDrop = drop1 > Math.abs(peakValue * MIN_DROP_RATIO) || drop2 > Math.abs(peakValue * MIN_DROP_RATIO);
        const isConsistentDrop = drop1 > 0 && drop2 > 0; // Ambas deben ser positivas para indicar caída

        if (isSignificantDrop || isConsistentDrop) {
          isConfirmedPeak = true;
          updatedLastConfirmedPeak = true; // Marcar como confirmado para el estado interno
        }
      }
    } else if (!isPeak) {
      updatedLastConfirmedPeak = false; // Resetear si no es pico candidato
    }

    this.lastConfirmedPeak = updatedLastConfirmedPeak; // Actualizar estado interno
    return isConfirmedPeak; // Devolver si este pico específico se confirmó AHORA
  }


  private updateBPM(): void {
    // No actualizar si hay movimiento detectado
    if (this.isMotionDetected) {
        console.log("HeartBeatProcessor: Motion detected, skipping BPM update.");
        return;
    }

    if (this.isInWarmup() || this.lastPeakTime === null || this.previousPeakTime === null) {
      return;
    }

    const currentInterval = this.lastPeakTime - this.previousPeakTime;

    if (currentInterval < (60000 / this.MAX_BPM) * 0.8 || currentInterval > (60000 / this.MIN_BPM) * 1.2) { // Rango fisiológico con margen
        console.log(`HeartBeatProcessor: Discarding unrealistic interval: ${currentInterval}ms`);
        return;
    }

    const instantBPM = 60000 / currentInterval;

    this.bpmHistory.push(instantBPM);
    if (this.bpmHistory.length > 8) { // Aumentar ligeramente historial para suavizado
      this.bpmHistory.shift();
    }

    this.smoothBPM = this.getSmoothBPM(); // Actualizar el BPM suavizado
  }


  private getSmoothBPM(): number {
    if (this.bpmHistory.length === 0) {
      return this.smoothBPM; // Devolver el último valor suavizado si no hay historial nuevo
    }

    // Usar mediana del historial reciente para robustez contra outliers
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    const medianBPM = sortedBPMs[Math.floor(sortedBPMs.length / 2)];

    // Suavizar el cambio hacia la mediana usando EMA
    const newSmoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + medianBPM * this.BPM_ALPHA;

    // Asegurar que está en rango fisiológico
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, newSmoothBPM));
  }

  public getFinalBPM(): number {
    if (this.isInWarmup() || this.bpmHistory.length < 3) {
      return 75; // O el último smoothBPM si es > 0? Quizás 75 es más seguro.
    }

    // Usar directamente el BPM suavizado que ya considera historial y outliers
    return this.smoothBPM;
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

    // Reiniciar explícitamente la línea base al resetear
    this.baseline = 0;
    // Reiniciar smoothedValue explícitamente
    this.smoothedValue = 0;

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
  }

  getRRIntervals() {
    return {
      intervals: [...this.rrIntervals], // Devolver copia
      lastPeakTime: this.lastPeakTime
    };
  }
}
