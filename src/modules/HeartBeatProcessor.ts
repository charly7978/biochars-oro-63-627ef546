
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200; // Se mantiene amplio para no perder picos fuera de rango
  private readonly SIGNAL_THRESHOLD = 0.30; // Reducido para detectar señales más débiles
  private readonly MIN_CONFIDENCE = 0.55; // Reducido para aumentar sensibilidad
  private readonly DERIVATIVE_THRESHOLD = -0.02; // Ajustado para mejor detección
  private readonly MIN_PEAK_TIME_MS = 400; // Tiempo mínimo entre picos
  private readonly WARMUP_TIME_MS = 3000; 

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 3; 
  private readonly MOVING_AVERAGE_WINDOW = 3; 
  private readonly EMA_ALPHA = 0.4; 
  private readonly BASELINE_FACTOR = 1.0; 

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880; 
  private readonly BEEP_SECONDARY_FREQUENCY = 440; 
  private readonly BEEP_DURATION = 80; 
  private readonly BEEP_VOLUME = 0.9; 
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.12; // Ajustado para ser menos estricto
  private readonly LOW_SIGNAL_FRAMES = 10; // Aumentado para evitar resets prematuros
  private readonly MAX_NO_FINGER_FRAMES = 10; // Incrementado para mayor estabilidad
  private lowSignalCount = 0;
  private noFingerDetectedCount = 0;

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
    console.log("HeartBeatProcessor: Inicializado con nuevos parámetros", {
      signalThreshold: this.SIGNAL_THRESHOLD,
      minConfidence: this.MIN_CONFIDENCE,
      derivativeThreshold: this.DERIVATIVE_THRESHOLD
    });
  }

  private async initAudio() {
    try {
      // Inicializar AudioContext con una interacción explícita
      // Muchos navegadores requieren interacción del usuario antes de iniciar el audio
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Intentar resumir el contexto (puede requerir interacción del usuario)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Reproducir un sonido de prueba muy corto y bajo volumen
      this.playSimpleBeep(0.01, 50);
      console.log("HeartBeatProcessor: Audio Context inicializado correctamente:", this.audioContext.state);
    } catch (error) {
      console.error("HeartBeatProcessor: Error al inicializar AudioContext", error);
    }
  }

  // Método alternativo para intentar inicializar el audio después de interacción del usuario
  public async tryResumeAudioContext() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log("Audio Context resumido exitosamente:", this.audioContext.state);
      }
      
      // Prueba de sonido
      this.playSimpleBeep(0.01, 50);
      return true;
    } catch (error) {
      console.error("Error al resumir AudioContext:", error);
      return false;
    }
  }

  // Método simplificado para probar el audio
  private playSimpleBeep(volume: number = 0.1, duration: number = 50) {
    try {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      
      gainNode.gain.value = volume;
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
      
      console.log("Beep de prueba reproducido correctamente");
    } catch (error) {
      console.error("Error al reproducir beep de prueba:", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      // Verificar si el contexto está suspendido y tratar de resumirlo
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log("Audio Context resumido durante playBeep");
        } catch (resumeError) {
          console.error("No se pudo resumir AudioContext:", resumeError);
          return;
        }
      }

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
      console.log("Beep reproducido correctamente: " + new Date().toISOString());
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

  public processSignal(value: number, fingerDetected: boolean = false): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
    rrData: any;
  } {
    // Procesamiento condicionado a detección de dedo
    if (!fingerDetected) {
      this.noFingerDetectedCount++;
      
      // Permitir reinicio suave del procesador si no hay dedo por un tiempo
      if (this.noFingerDetectedCount >= this.MAX_NO_FINGER_FRAMES) {
        if (this.noFingerDetectedCount % 10 === 0) {
          console.log("HeartBeatProcessor: Sin dedo detectado durante " + this.noFingerDetectedCount + " frames");
        }
        // No reiniciar completamente, solo retornar valores nulos
        return {
          bpm: 0,
          confidence: 0,
          isPeak: false,
          filteredValue: value,
          arrhythmiaCount: 0,
          rrData: {
            intervals: [],
            lastPeakTime: null
          }
        };
      }
    } else {
      // Resetear contador si hay dedo
      this.noFingerDetectedCount = 0;
    }
    
    // Filtros sucesivos para mejorar la señal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Si no hay datos suficientes, no procesar
    if (this.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }

    // Cálculo de línea base con adaptación progresiva
    this.baseline = this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    
    // Auto-reset si la señal es muy débil
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue), fingerDetected);

    // Actualizar buffer para derivada
    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Calcular derivada suavizada para detección de picos
    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Detectar picos con umbral adaptativo
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    
    // Confirmar pico con validación adicional
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    // Si se confirma un pico, actualizar BPM y reproducir beep
    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        console.log(`Pico cardíaco detectado en: ${now}ms, último: ${this.previousPeakTime}ms, diferencia: ${timeSinceLastPeak}ms`);
        
        // Reproducir beep solo si el pico es de buena calidad
        if (confidence > 0.65) {
          this.playBeep(Math.min(0.9, confidence * 0.8));
          console.log(`Reproduciendo beep con volumen ${Math.min(0.9, confidence * 0.8)}`);
        }
        
        // Actualizar BPM solo si intervalo es fisiológicamente válido
        if (timeSinceLastPeak >= 300 && timeSinceLastPeak <= 1500) {
          this.updateBPM(timeSinceLastPeak);
          console.log(`BPM actualizado con intervalo: ${timeSinceLastPeak}ms`);
        }
      }
    }

    // Obtener BPM suavizado
    const currentBPM = this.getSmoothBPM();
    
    // Validar BPM dentro de rangos fisiológicos
    if (currentBPM > 0 && (currentBPM < this.MIN_BPM || currentBPM > this.MAX_BPM)) {
      console.log("HeartBeatProcessor: BPM fuera de rango fisiológico", {
        bpm: currentBPM,
        confianza: confidence
      });
      return {
        bpm: 0,
        confidence: confidence * 0.5, // Reducir confianza
        isPeak: isConfirmedPeak && !this.isInWarmup(),
        filteredValue: smoothed,
        arrhythmiaCount: 0,
        rrData: this.getRRIntervals()
      };
    }

    return {
      bpm: Math.round(currentBPM),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0,
      rrData: this.getRRIntervals()
    };
  }

  private autoResetIfSignalIsLow(amplitude: number, fingerDetected: boolean) {
    // Condición menos estricta para evitar resets falsos
    if (amplitude < this.LOW_SIGNAL_THRESHOLD || !fingerDetected) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
        if (this.lowSignalCount % 20 === 0) {
          console.log("HeartBeatProcessor: Señal baja o sin dedo - auto-reset", {
            amplitud: amplitude,
            umbral: this.LOW_SIGNAL_THRESHOLD,
            contadorFrames: this.lowSignalCount
          });
        }
      }
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 2); // Decremento más rápido
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

    // Evitar detecciones demasiado cercanas
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Criterios mejorados para detección de picos
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;

    // Cálculo de confianza mejorado
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );

    // Ponderación mejorada de confianza final
    const confidence = (amplitudeConfidence * 0.7 + derivativeConfidence * 0.3);

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Buffer para análisis de forma de pico
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Calcular media del buffer para comparación
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / this.peakConfirmationBuffer.length;
    
    // Confirmar pico solo si cumple múltiples criterios
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE && avgBuffer > this.SIGNAL_THRESHOLD) {
      if (this.peakConfirmationBuffer.length >= 3) {
        // Verificar que la señal esté descendiendo (confirmación de que pasamos el máximo)
        const len = this.peakConfirmationBuffer.length;
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = len >= 3 ? this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3] : true;
        
        if (goingDown1 && goingDown2) {
          this.lastConfirmedPeak = true;
          console.log(`Pico confirmado con confianza ${confidence.toFixed(2)}, valor: ${normalizedValue.toFixed(3)}`);
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    return false;
  }

  private updateBPM(interval: number) {
    // Calcular BPM instantáneo desde el intervalo RR
    const instantBPM = 60000 / interval;
    
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      // Añadir al historial con más peso para valores recientes
      this.bpmHistory.push(instantBPM);
      console.log(`Añadido BPM instantáneo: ${instantBPM.toFixed(1)}`);
      
      // Limitar tamaño de historia
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    } else {
      console.log(`BPM instantáneo rechazado (fuera de rango): ${instantBPM.toFixed(1)}`);
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Suavizado EMA para estabilidad
    this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    // Necesitamos al menos 2 valores para calcular un BPM válido
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Usar mediana recortada para mayor robustez
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Recortar extremos solo si hay suficientes valores
    let trimmed;
    if (sorted.length >= 5) {
      // Recortar 10% de cada extremo
      const cutSize = Math.floor(sorted.length * 0.1);
      trimmed = sorted.slice(cutSize, sorted.length - cutSize);
    } else {
      trimmed = sorted;
    }
    
    // Si no quedan valores después del recorte, usar toda la lista
    if (!trimmed.length) return 0;
    
    // Calcular promedio
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    console.log(`BPM actual calculado: ${avg.toFixed(1)} de ${this.bpmHistory.length} muestras`);
    
    return avg;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 5) {
      return 0;
    }
    
    // Similar al método calculateCurrentBPM pero con más peso en valores recientes
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (!finalSet.length) return 0;
    
    // Ponderación basada en posición (más peso a valores más recientes)
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < finalSet.length; i++) {
      const weight = i + 1; // Peso lineal
      weightedSum += finalSet[i] * weight;
      totalWeight += weight;
    }
    
    return Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);
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
    this.noFingerDetectedCount = 0;
    console.log("HeartBeatProcessor: reset completo");
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // Si no hay suficientes picos, retornar datos mínimos
    if (!this.lastPeakTime || !this.previousPeakTime) {
      return {
        intervals: [],
        lastPeakTime: this.lastPeakTime
      };
    }
    
    // Calcular intervalos RR a partir de bpmHistory
    const intervals: number[] = [];
    
    // Convertir BPM a intervalos RR (ms)
    for (const bpm of this.bpmHistory) {
      if (bpm > 0) {
        intervals.push(60000 / bpm);
      }
    }
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
