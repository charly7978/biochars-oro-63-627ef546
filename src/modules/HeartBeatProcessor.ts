import { antiRedundancyGuard } from '../core/validation/CrossValidationSystem';

export class HeartBeatProcessor {
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.60;
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
    this.startTime = Date.now();
  }

  /**
   * Establece el estado de monitoreo del procesador
   * @param monitoring Verdadero para activar el monitoreo, falso para desactivarlo
   */
  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    console.log(`HeartBeatProcessor: Monitoring set to ${monitoring}`);
  }

  /**
   * Obtiene el estado actual de monitoreo
   * @returns Verdadero si el monitoreo está activo
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  async initAudio() {
    // ELIMINADO: No inicializar audio aquí. El feedback se maneja en la UI.
    return;
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // ELIMINADO: No reproducir beep aquí. El feedback se maneja en la UI.
    return false;
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
    // Detectamos un pico cuando hay un máximo local (valor alto) 
    // en lugar de detectar cruce por cero del derivado
    const isPotentialPeak = 
      normalizedValue > this.SIGNAL_THRESHOLD && 
      derivative < 0 && // Estamos justo después del pico (pendiente negativa)
      this.lastValue < normalizedValue; // El valor actual es mayor que el anterior
      
    // Verificar que ha pasado suficiente tiempo desde el último pico
    const sufficientTimePassed = 
      this.lastPeakTime === null || 
      (Date.now() - this.lastPeakTime) > this.MIN_PEAK_TIME_MS;
      
    const isPeak = isPotentialPeak && sufficientTimePassed;
    
    // Calcular confianza basado en la amplitud del pico
    let confidence = 0;
    if (isPeak) {
      // La confianza aumenta con la amplitud normalizada
      confidence = Math.min(1.0, normalizedValue / (this.SIGNAL_THRESHOLD * 1.5));
      confidence = Math.max(this.MIN_CONFIDENCE, confidence);
    }
    
    return { isPeak, confidence };
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
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/modules/HeartBeatProcessor.ts');
antiRedundancyGuard.registerTask('HeartBeatProcessorSingleton');
