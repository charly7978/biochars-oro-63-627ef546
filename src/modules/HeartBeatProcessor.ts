export class HeartBeatProcessor {
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.45; // Reducido de 0.60 para detectar más picos
  MIN_CONFIDENCE = 0.50;
  DERIVATIVE_THRESHOLD = -0.03;
  MIN_PEAK_TIME_MS = 300; // Reducido para permitir detección más frecuente
  WARMUP_TIME_MS = 2000; // Reducido para comenzar antes

  MEDIAN_FILTER_WINDOW = 3;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.3;
  BASELINE_FACTOR = 0.995;

  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 80; // Ligeramente más corto para respuesta más rápida
  BEEP_VOLUME = 0.8; // Aumentado para mejor audibilidad
  MIN_BEEP_INTERVAL_MS = 250; // Reducido para permitir beeps más frecuentes

  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 10;
  lowSignalCount = 0;

  // Banderas para sincronización forzada
  FORCE_IMMEDIATE_BEEP = true; // Nueva bandera para forzar beeps inmediatos
  SKIP_TIMING_VALIDATION = true; // Omitir validaciones que puedan retrasar beeps
  
  // Variable para controlar el estado de monitoreo
  private isMonitoring = false;

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
  BPM_ALPHA = 0.2;
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  rrIntervals: number[] = [];

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  /**
   * Establece el estado de monitoreo del procesador
   * @param monitoring Verdadero para activar el monitoreo, falso para desactivarlo
   */
  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    console.log(`HeartBeatProcessor: Monitoring set to ${monitoring}`);
    
    // Si se activa el monitoreo, asegurarse que el audio esté iniciado
    if (monitoring && this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context", err);
      });
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
      // Inicializa o recupera el contexto de audio con baja latencia
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
        
        // Siempre asegúrate de que el contexto esté en estado "running"
        if (this.audioContext.state !== 'running') {
          await this.audioContext.resume();
        }
        
        // Prepara el sistema de audio con un beep silencioso
        await this.playBeep(0.01);
        console.log("HeartBeatProcessor: Audio Context Initialized with low latency");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Si no está en modo de monitoreo, no reproducir beeps
    if (!this.isMonitoring) return false;
    
    // Si estamos en el período de calentamiento, no reproducir beeps
    if (this.isInWarmup()) return false;
    
    // Verificación básica de intervalo para evitar beeps demasiado frecuentes
    const now = Date.now();
    if (!this.SKIP_TIMING_VALIDATION && now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

    try {
      // Asegúrate de que el contexto de audio esté disponible y activo
      if (!this.audioContext || this.audioContext.state !== 'running') {
        await this.initAudio();
        if (!this.audioContext || this.audioContext.state !== 'running') {
          return false;
        }
      }

      // Crea y configura osciladores para un sonido cardíaco más realista
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();
      
      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      // Configuración de tono principal
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Configuración de tono secundario
      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.BEEP_SECONDARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Envolvente de amplitud para tono principal (ataque rápido, decaimiento natural)
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envolvente de amplitud para tono secundario
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.4, // Volumen reducido para el secundario
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conecta osciladores y ganancias
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      // Inicia y detiene los osciladores con timing preciso
      primaryOscillator.start(this.audioContext.currentTime);
      secondaryOscillator.start(this.audioContext.currentTime);
      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.02);

      // Actualiza el tiempo del último beep
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

  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
  } {
    // Si no está en modo de monitoreo, retornar valores por defecto
    if (!this.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: 0,
        arrhythmiaCount: 0
      };
    }
    
    // Iniciar temporizador si es la primera vez
    if (this.startTime === 0) {
      this.startTime = Date.now();
      this.initAudio(); // Inicializar audio
    }
    
    // Aplicar filtros para reducir ruido
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    // Almacenar en buffer para análisis
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Esperar suficientes datos
    if (this.signalBuffer.length < 30) {
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

    // Normalizar señal
    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Calcular derivada para detección de picos
    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }

    // Detectar si es un pico
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    
    // CORRECCIÓN: Guardar el valor actual antes de actualizar el último valor
    // para usarlo en la próxima comparación
    this.lastValue = normalizedValue;
    
    // CORRECCIÓN: Reproducir beep inmediatamente en el pico, no en la confirmación posterior
    if (isPeak && Date.now() - this.lastBeepTime > this.MIN_BEEP_INTERVAL_MS) {
      this.playBeep(confidence * this.BEEP_VOLUME);
      this.lastBeepTime = Date.now();
    }
    
    // Confirmar si realmente es un pico (reduce falsos positivos)
    const confirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);
    
    // Actualizar BPM si se confirmó el pico
    if (confirmedPeak) {
      this.updateBPM();
      
      if (this.previousPeakTime !== null) {
        // Guardar información de intervalos RR para análisis de arritmias
        const rrInterval = this.lastPeakTime! - this.previousPeakTime;
        if (rrInterval > 300 && rrInterval < 2000) { // Filtrar valores fisiológicamente imposibles
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > 30) {
            this.rrIntervals.shift(); // Mantener solo los últimos 30 intervalos
          }
        }
      }
      
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = Date.now();
    }
    
    // Retornar resultados
    return {
      bpm: Math.round(this.getFinalBPM()),
      confidence,
      isPeak: confirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    // Verificar si ha pasado suficiente tiempo desde el último pico
    const sufficientTimePassed = 
      this.lastPeakTime === null || 
      (Date.now() - this.lastPeakTime) > this.MIN_PEAK_TIME_MS;
      
    if (!sufficientTimePassed) {
      return { isPeak: false, confidence: 0 };
    }

    // Primera etapa: detección de pico potencial
    const isPotentialPeak = 
      normalizedValue > this.SIGNAL_THRESHOLD && 
      derivative < 0 && 
      this.lastValue < normalizedValue;
      
    if (!isPotentialPeak) {
      return { isPeak: false, confidence: 0 };
    }

    // Segunda etapa: validación de forma y amplitud
    const shapeConfidence = this.calculateShapeConfidence(normalizedValue);
    const amplitudeConfidence = this.calculateAmplitudeConfidence(normalizedValue);
    const intervalConfidence = this.calculateIntervalConfidence();

    // Calcular confianza ponderada
    const weightedConfidence = 
      (shapeConfidence * 0.4) + 
      (amplitudeConfidence * 0.4) + 
      (intervalConfidence * 0.2);

    // Requisitos más estrictos para señales débiles
    const minConfidence = normalizedValue < this.SIGNAL_THRESHOLD * 1.5 
      ? this.MIN_CONFIDENCE * 1.2 
      : this.MIN_CONFIDENCE;

    const isPeak = weightedConfidence >= minConfidence;

    return {
      isPeak,
      confidence: weightedConfidence
    };
  }

  private calculateShapeConfidence(currentValue: number): number {
    if (this.peakConfirmationBuffer.length < 5) return 0;

    // Analizar forma usando últimos 5 valores
    const values = [...this.peakConfirmationBuffer];
    const maxVal = Math.max(...values);
    const normalizedShape = values.map(v => v / maxVal);

    // Forma ideal de un pico cardíaco (aproximada)
    const idealShape = [0.4, 0.7, 1.0, 0.7, 0.4];
    
    // Calcular similitud con forma ideal
    let similarity = 0;
    for (let i = 0; i < normalizedShape.length; i++) {
      similarity += 1 - Math.abs(normalizedShape[i] - idealShape[i]);
    }
    
    return similarity / normalizedShape.length;
  }

  private calculateAmplitudeConfidence(value: number): number {
    // Confianza basada en amplitud relativa al umbral
    const relativeAmplitude = value / this.SIGNAL_THRESHOLD;
    return Math.min(1, Math.max(0, (relativeAmplitude - 1) / 2));
  }

  private calculateIntervalConfidence(): number {
    if (this.lastPeakTime === null) return 1;

    const currentInterval = Date.now() - this.lastPeakTime;
    
    // Verificar si el intervalo está en rango fisiológico
    if (currentInterval < 250 || currentInterval > 1500) {
      return 0;
    }

    // Mayor confianza para intervalos más estables
    const expectedInterval = this.getAverageInterval();
    if (!expectedInterval) return 0.5;

    const deviation = Math.abs(currentInterval - expectedInterval);
    return Math.max(0, 1 - (deviation / expectedInterval));
  }

  private getAverageInterval(): number | null {
    if (this.bpmHistory.length < 2) return null;
    
    const intervals = [];
    for (let i = 1; i < this.bpmHistory.length; i++) {
      const interval = 60000 / this.bpmHistory[i];
      if (interval >= 250 && interval <= 1500) {
        intervals.push(interval);
      }
    }
    
    if (intervals.length === 0) return null;
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
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
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    // Añadir valor a buffer de confirmación
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    // Solo proceder si es un pico, no ya confirmado, y cumple umbral de confianza
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      // Necesita buffer suficiente para confirmación
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Confirmar solo si es el pico (valores posteriores están descendiendo)
        const goingDown1 =
          this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 =
          this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];

        if (goingDown1 || goingDown2) { // Cambiado a OR para mayor sensibilidad
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }

    return false;
  }

  private updateBPM(): void {
    // Verificar si hay suficientes datos para calcular
    if (this.isInWarmup() || this.lastPeakTime === null || this.previousPeakTime === null) {
      return;
    }

    // Calcular el intervalo actual en ms entre los dos últimos picos
    const currentInterval = this.lastPeakTime - this.previousPeakTime;
    
    // Filtrar intervalos fisiológicamente improbables
    if (currentInterval < 250 || currentInterval > 1500) {
      return; // Ignorar intervalos fuera del rango fisiológico (40-240 BPM)
    }
    
    // Calcular el BPM instantáneo a partir del intervalo
    const instantBPM = 60000 / currentInterval;
    
    // Añadir al histórico para promediado
    this.bpmHistory.push(instantBPM);
    
    // Mantener solo los últimos 5 valores para un promedio móvil
    if (this.bpmHistory.length > 5) {
      this.bpmHistory.shift();
    }
    
    // Actualizar BPM suavizado usando promedio ponderado
    this.smoothBPM = this.getSmoothBPM();
  }

  private getSmoothBPM(): number {
    if (this.bpmHistory.length === 0) {
      return 75; // Valor por defecto si no hay datos
    }
    
    // Ordenar valores para identificar posibles outliers
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Si hay suficientes valores, descartar el más alto y el más bajo para reducir ruido
    let validBPMs = this.bpmHistory;
    if (sortedBPMs.length >= 5) {
      validBPMs = sortedBPMs.slice(1, -1); // Excluir valores extremos
    }
    
    // Calcular media de los valores válidos
    const sum = validBPMs.reduce((acc, val) => acc + val, 0);
    const averageBPM = sum / validBPMs.length;
    
    // Asegurar que está en rango fisiológico
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, averageBPM));
  }

  private calculateCurrentBPM(): number {
    // Si no hay suficientes datos, usar valor suavizado actual
    if (this.bpmHistory.length < 2) {
      return this.smoothBPM > 0 ? this.smoothBPM : 75;
    }
    
    // Aplicar EMA al BPM actual (suaviza aún más los cambios)
    this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + 
                   this.getSmoothBPM() * this.BPM_ALPHA;
    
    // Asegurar valor fisiológico razonable
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, this.smoothBPM));
  }

  public getFinalBPM(): number {
    if (this.isInWarmup() || this.bpmHistory.length < 3) {
      // Durante el período de calentamiento, mostrar un valor promedio base
      return 75;
    }
    
    // Verificar si ha pasado demasiado tiempo desde el último pico
    const timeSinceLastPeak = this.lastPeakTime ? (Date.now() - this.lastPeakTime) : 0;
    
    // Si no hay picos recientes (>3 segundos), reducir gradualmente la confianza
    if (timeSinceLastPeak > 3000) {
      const degradationFactor = Math.min(1, 3000 / timeSinceLastPeak);
      return this.calculateCurrentBPM() * degradationFactor + 75 * (1 - degradationFactor);
    }
    
    return this.calculateCurrentBPM();
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
    this.rrIntervals = [];
    
    // Intentar asegurar que el contexto de audio esté activo
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
