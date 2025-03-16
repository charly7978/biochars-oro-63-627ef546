
export class HeartBeatProcessor {
  // Configuración optimizada para sincronización natural de beeps
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 45;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.20;       // Umbral de señal ajustado
  MIN_CONFIDENCE = 0.30;         // Umbral de confianza reducido para mayor sensibilidad
  DERIVATIVE_THRESHOLD = -0.010; // Umbral de derivada ajustado
  MIN_PEAK_TIME_MS = 250;        // Intervalo mínimo entre picos
  WARMUP_TIME_MS = 800;          // Tiempo de calentamiento

  // Filtros de señal optimizados
  MEDIAN_FILTER_WINDOW = 5;      // Ventana del filtro mediana
  MOVING_AVERAGE_WINDOW = 5;     // Ventana de promedio móvil
  EMA_ALPHA = 0.20;              // Factor de suavizado exponencial
  BASELINE_FACTOR = 0.992;       // Factor de seguimiento de línea base

  // Configuración de beep para sincronización natural
  BEEP_PRIMARY_FREQUENCY = 800;  // Frecuencia primaria más natural
  BEEP_DURATION = 80;            // Duración optimizada para percepción natural
  BEEP_VOLUME = 0.7;             // Volumen ajustado
  MIN_BEEP_INTERVAL_MS = 250;    // Intervalo mínimo entre beeps

  // Parámetros de detección de señal baja
  LOW_SIGNAL_THRESHOLD = 0.025;
  LOW_SIGNAL_FRAMES = 12;
  lowSignalCount = 0;

  // Variables internas
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
  BPM_ALPHA = 0.2;               // Factor de suavizado de BPM reducido para mayor estabilidad
  
  // Variables para detección adaptativa
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  lastProcessedPeakTime = 0;
  peakThresholdAdjuster = 1.0;
  stableDetectionCount = 0;
  
  // Nuevas variables para sincronización natural
  adaptiveThresholdHistory = [];
  signalQualityHistory = [];
  beepDelayMs = 0;
  lastBpmUpdateTime = 0;
  
  // Variables para análisis de consistencia
  peakIntervalConsistency = 0;
  detectionConfidence = 0;

  constructor() {
    console.log("HeartBeatProcessor: Inicializado con configuración optimizada para sincronización natural");
    this.initAudio();
    this.startTime = Date.now();
  }

  async initAudio() {
    try {
      // Verificar disponibilidad de AudioContext
      if (typeof window !== 'undefined' && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
        await this.audioContext.resume();
        
        // Beep de prueba con volumen bajo
        await this.playBeep(0.1);
        
        console.log("HeartBeatProcessor: Audio Context inicializado correctamente", {
          sampleRate: this.audioContext?.sampleRate,
          state: this.audioContext?.state
        });
      } else {
        console.warn("HeartBeatProcessor: AudioContext no disponible");
      }
    } catch (err) {
      console.error("HeartBeatProcessor: Error inicializando audio", err);
    }
  }

  async playBeep(volume = this.BEEP_VOLUME) {
    // Verificar audio context
    if (!this.audioContext) {
      await this.initAudio();
      if (!this.audioContext) return false;
    }

    const now = Date.now();
    // Verificar intervalo mínimo entre beeps
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }

    try {
      // Crear oscilador para tono primario
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Configurar oscilador
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Configurar envolvente de volumen para sonido más natural
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.004
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Conectar nodos y reproducir
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.01);
      
      // Actualizar tiempo del último beep
      this.lastBeepTime = now;
      
      return true;
    } catch (err) {
      console.error("HeartBeatProcessor: Error reproduciendo beep", err);
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

  processSignal(value) {
    // Aplicar filtro de mediana para eliminar valores atípicos
    const medVal = this.medianFilter(value);
    
    // Aplicar promedio móvil para suavizar
    const movAvgVal = this.calculateMovingAverage(medVal);
    
    // Aplicar promedio móvil exponencial para mayor suavizado preservando características
    const smoothed = this.calculateEMA(movAvgVal);

    // Almacenar en buffer para análisis
    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Verificar si tenemos suficientes datos
    if (this.signalBuffer.length < 8) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Actualizar línea base con seguimiento lento
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    // Normalizar señal respecto a línea base
    const normalizedValue = smoothed - this.baseline;
    
    // Ajustar umbral dinámicamente basado en amplitud de señal reciente
    if (this.signalBuffer.length > 20) {
      const recentValues = this.signalBuffer.slice(-20);
      const minVal = Math.min(...recentValues);
      const maxVal = Math.max(...recentValues);
      const range = maxVal - minVal;
      
      // Registrar rango para ajuste de umbral
      this.adaptiveThresholdHistory.push(range);
      if (this.adaptiveThresholdHistory.length > 10) {
        this.adaptiveThresholdHistory.shift();
      }
      
      // Calcular umbral adaptativo basado en promedio de rangos
      if (this.adaptiveThresholdHistory.length > 5) {
        const avgRange = this.adaptiveThresholdHistory.reduce((a, b) => a + b, 0) / 
                        this.adaptiveThresholdHistory.length;
        this.peakThresholdAdjuster = Math.min(1.2, Math.max(0.8, avgRange / 0.4));
      }
    }
    
    // Auto-reset si la señal es muy baja por mucho tiempo
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Almacenar valores recientes para derivada
    this.values.push(smoothed);
    if (this.values.length > 5) {
      this.values.shift();
    }

    // Calcular derivada suavizada
    let smoothDerivative = 0;
    if (this.values.length >= 5) {
      smoothDerivative = (this.values[4] - this.values[0]) / 4;
    } else if (this.values.length >= 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    } else {
      smoothDerivative = smoothed - this.lastValue;
    }
    this.lastValue = smoothed;

    // Umbral ajustado dinámicamente
    const adjustedThreshold = this.SIGNAL_THRESHOLD * this.peakThresholdAdjuster;
    
    // Detección de pico con umbral adaptativo
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative, adjustedThreshold);
    
    // Confirmación de pico con análisis de contexto
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Procesar pico confirmado
    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      // Verificar intervalo mínimo entre picos
      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        const currentBPM = this.getSmoothBPM();
        let isValidPeak = true;
        
        // Validación adicional basada en BPM actual
        if (currentBPM > 0) {
          const expectedInterval = 60000 / currentBPM;
          // Si el intervalo es demasiado corto (latido prematuro extremo), rechazar
          if (timeSinceLastPeak < expectedInterval * 0.5) {
            isValidPeak = false;
          }
        }
        
        if (isValidPeak) {
          // Actualizar tiempos de pico
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          this.lastProcessedPeakTime = now;
          
          // Actualizar BPM y contadores
          this.updateBPM();
          this.stableDetectionCount++;
          
          // Actualizar confianza de detección
          this.updateDetectionConfidence(timeSinceLastPeak);
        }
      }
    }

    // Calcular confianza combinada
    const finalConfidence = Math.min(1, 
      (confidence * 0.6) + 
      (this.detectionConfidence * 0.2) + 
      (this.peakIntervalConsistency * 0.2)
    );

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: finalConfidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0,
      stableDetectionCount: this.stableDetectionCount
    };
  }

  updateDetectionConfidence(interval) {
    // Registrar nueva calidad de señal
    const signalQuality = Math.min(1, this.stableDetectionCount / 30);
    this.signalQualityHistory.push(signalQuality);
    if (this.signalQualityHistory.length > 10) {
      this.signalQualityHistory.shift();
    }
    
    // Calcular confianza media
    this.detectionConfidence = this.signalQualityHistory.reduce((a, b) => a + b, 0) / 
                              Math.max(1, this.signalQualityHistory.length);
    
    // Actualizar consistencia de intervalos
    if (this.previousPeakTime && this.lastPeakTime) {
      const prevInterval = this.lastPeakTime - this.previousPeakTime;
      const consistency = 1 - Math.min(1, Math.abs(interval - prevInterval) / Math.max(interval, prevInterval));
      this.peakIntervalConsistency = 0.7 * this.peakIntervalConsistency + 0.3 * consistency;
    }
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
    this.lastProcessedPeakTime = 0;
    this.peakThresholdAdjuster = 1.0;
    this.stableDetectionCount = Math.max(0, this.stableDetectionCount - 10);
    this.peakIntervalConsistency = Math.max(0, this.peakIntervalConsistency - 0.3);
  }

  detectPeak(normalizedValue, derivative, adjustedThreshold) {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // No detectar picos demasiado cercanos
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Criterios de detección de pico optimizados
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > adjustedThreshold * 0.9 &&
      this.lastValue > this.baseline;

    // Calcular confianza basada en amplitud y derivada
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / adjustedThreshold, 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD), 0),
      1
    );

    // Combinación ponderada de factores de confianza
    const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

    return { isPeak, confidence };
  }

  confirmPeak(isPeak, normalizedValue, confidence) {
    // Almacenar valores para confirmación
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 7) {
      this.peakConfirmationBuffer.shift();
    }

    // Confirmar pico solo si no hemos confirmado uno recientemente
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Verificar patrón descendente (característico de pico real)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = len >= 3 ? this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3] : true;
        
        if (goingDown1 && goingDown2) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      // Resetear confirmación cuando no es pico
      this.lastConfirmedPeak = false;
    }

    return false;
  }

  updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    
    // Verificar si el BPM está en rango fisiológico
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      // Agregar al historial con mayor peso a valores recientes
      this.bpmHistory.push(instantBPM);
      
      // Limitar tamaño del historial
      while (this.bpmHistory.length > 8) {
        this.bpmHistory.shift();
      }
      
      this.lastBpmUpdateTime = Date.now();
    }
  }

  getSmoothBPM() {
    const rawBPM = this.calculateCurrentBPM();
    
    // Inicializar BPM suavizado
    if (this.smoothBPM === 0 && rawBPM > 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Ajustar factor de suavizado basado en estabilidad
    let alpha = this.BPM_ALPHA;
    if (this.stableDetectionCount > 20) {
      // Con alta estabilidad, suavizado más lento para estabilidad
      alpha = Math.max(0.10, alpha * 0.6);
    } else if (this.stableDetectionCount < 10) {
      // Con baja estabilidad, suavizado más rápido para adaptabilidad
      alpha = Math.min(0.4, alpha * 1.5);
    }
    
    // Aplicar suavizado exponencial
    if (rawBPM > 0) {
      this.smoothBPM = alpha * rawBPM + (1 - alpha) * this.smoothBPM;
    }
    
    return this.smoothBPM;
  }

  calculateCurrentBPM() {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Método de media recortada para mayor robustez
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    let trimmed;
    if (sorted.length >= 5) {
      // Recortar extremos para media más robusta
      const cutSize = Math.floor(sorted.length * 0.2);
      trimmed = sorted.slice(cutSize, sorted.length - cutSize);
    } else {
      // Con pocos valores, usar todos o quitar extremos
      trimmed = sorted.length > 3 ? sorted.slice(1, -1) : sorted;
    }
    
    if (!trimmed.length) return 0;
    
    // Calcular media de valores recortados
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  getFinalBPM() {
    // Método para obtener BPM final más robusto
    if (this.bpmHistory.length < 4) {
      return 0;
    }
    
    // Ordenar y recortar para robustez
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    if (!finalSet.length) return 0;
    
    // Media de valores centrales
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  reset() {
    // Resetear completamente el estado
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
    this.lastProcessedPeakTime = 0;
    this.peakThresholdAdjuster = 1.0;
    this.stableDetectionCount = 0;
    this.adaptiveThresholdHistory = [];
    this.signalQualityHistory = [];
    this.beepDelayMs = 0;
    this.lastBpmUpdateTime = 0;
    this.peakIntervalConsistency = 0;
    this.detectionConfidence = 0;
    
    // Asegurar que el contexto de audio está activo
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume()
        .then(() => console.log("HeartBeatProcessor: Audio Context reactivado"))
        .catch(err => console.error("HeartBeatProcessor: Error reactivando Audio Context", err));
    }
    
    console.log("HeartBeatProcessor: Reset completo ejecutado");
  }

  getRRIntervals() {
    // Convertir BPM a intervalos RR en ms
    const intervals = this.bpmHistory.map(bpm => bpm > 0 ? 60000 / bpm : 0);
    
    return {
      intervals: intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
