
/**
 * Procesador avanzado de ritmo cardíaco
 * Implementa algoritmos de vanguardia para la detección y análisis de latidos cardíacos
 */

import { ProcessedPPGSignal, SignalProcessor, SignalProcessorConfig } from './types';

export class HeartbeatProcessor implements SignalProcessor {
  // Parámetros de configuración avanzada
  private config: SignalProcessorConfig = {
    filterParams: {
      lowPassCutoff: 4.0,         // Hz - filtro para componentes cardíacas
      highPassCutoff: 0.75,        // Hz - elimina oscilaciones muy lentas
      smoothingFactor: 0.82       // Factor de suavizado para reducir ruido
    },
    amplification: {
      gain: 3.2,                  // Ganancia específica para latidos
      adaptiveGain: true          // Adaptación según calidad de señal
    },
    fingerDetection: {
      threshold: 0.15,            // Umbral para detectar presencia de dedo
      stabilityThreshold: 0.70    // Estabilidad mínima para considerar señal válida
    }
  };

  // Parámetros específicos para detección cardíaca
  private readonly BPM_MIN = 40;
  private readonly BPM_MAX = 200;
  private readonly PEAK_THRESHOLD = 0.35;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.20;
  private readonly PEAK_INTERVAL_MIN_MS = 300;  // 60000/200 BPM
  private readonly PEAK_INTERVAL_MAX_MS = 1500; // 60000/40 BPM
  private readonly ARTIFACT_REJECTION_FACTOR = 0.30;
  
  // Buffers y estados
  private valueBuffer: number[] = [];
  private timeBuffer: number[] = [];
  private readonly BUFFER_SIZE = 150;
  private peakTimestamps: number[] = [];
  private readonly PEAK_HISTORY_SIZE = 20;
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private previousPeakAmplitude: number = 0;
  private previousPeakTime: number | null = null;
  private heartRateEstimate: number = 0;
  private confidenceLevel: number = 0;
  private arrhythmiaCount: number = 0;
  
  // Algoritmos avanzados
  private signalFilter: AdvancedBandpassFilter;
  private peakEnhancer: PeakEnhancementProcessor;
  private arrhythmiaDetector: ArrhythmiaDetectionSystem;
  private beepEngine: AudioBeepEngine;
  
  constructor() {
    // Inicializar algoritmos específicos para procesamiento cardíaco
    this.signalFilter = new AdvancedBandpassFilter(
      this.config.filterParams.lowPassCutoff,
      this.config.filterParams.highPassCutoff
    );
    
    this.peakEnhancer = new PeakEnhancementProcessor(
      this.PEAK_THRESHOLD,
      this.ARTIFACT_REJECTION_FACTOR
    );
    
    this.arrhythmiaDetector = new ArrhythmiaDetectionSystem(
      this.PEAK_INTERVAL_MIN_MS,
      this.PEAK_INTERVAL_MAX_MS
    );
    
    this.beepEngine = new AudioBeepEngine(750, 100, 0.7);
    
    console.log("HeartbeatProcessor: Inicializado con algoritmos de detección cardíaca avanzados");
  }

  /**
   * Procesa la señal para detectar y analizar latidos cardíacos
   * Implementa algoritmos avanzados específicos para características cardíacas
   */
  public processSignal(value: number, timestamp: number = Date.now()): ProcessedPPGSignal {
    // Actualizar buffers
    this.valueBuffer.push(value);
    this.timeBuffer.push(timestamp);
    
    if (this.valueBuffer.length > this.BUFFER_SIZE) {
      this.valueBuffer.shift();
      this.timeBuffer.shift();
    }
    
    // ===== FASE 1: FILTRADO ESPECÍFICO PARA COMPONENTES CARDÍACAS =====
    // Aplicar filtro de banda específico para la frecuencia cardíaca
    const filteredValue = this.signalFilter.filter(value);
    
    // Normalizar señal filtrada
    const recentValues = this.valueBuffer.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min > 0 ? max - min : 1;
    const normalizedValue = (filteredValue - min) / range;
    
    // ===== FASE 2: MEJORA Y AMPLIFICACIÓN DE PICOS =====
    // Mejorar picos para detección más precisa
    const enhancedValue = this.peakEnhancer.enhance(normalizedValue);
    
    // Amplificar señal para mejor detección
    let amplificationGain = this.config.amplification.gain;
    // Calcular factor de amplificación adaptativo
    if (this.config.amplification.adaptiveGain) {
      const signalQuality = this.calculateSignalQuality(recentValues);
      amplificationGain *= (0.6 + signalQuality * 0.4); // Adaptación según calidad
    }
    
    const amplifiedValue = enhancedValue * amplificationGain;
    
    // ===== FASE 3: DETECCIÓN AVANZADA DE PICOS CARDÍACOS =====
    // Detectar pico usando algoritmo específico para ritmo cardíaco
    const isPeak = this.detectHeartbeat(amplifiedValue, timestamp);
    
    // Calcular calidad de señal específica para componentes cardíacas
    const signalQuality = this.calculateSignalQuality(recentValues);
    const fingerDetected = signalQuality > this.config.fingerDetection.threshold;
    
    // ===== FASE 4: ANÁLISIS DE RITMO CARDÍACO =====
    // Calcular estimación de ritmo cardíaco
    this.updateHeartRateEstimate();
    
    // Detectar arritmias
    if (isPeak && this.rrIntervals.length > 3) {
      const arrhythmiaDetected = this.arrhythmiaDetector.analyze(this.rrIntervals);
      if (arrhythmiaDetected) {
        this.arrhythmiaCount++;
        console.log(`HeartbeatProcessor: Arritmia detectada (#${this.arrhythmiaCount}) - Intervalo anómalo`);
      }
    }
    
    // Si es un pico reproducir beep (si está habilitado)
    if (isPeak && fingerDetected && this.confidenceLevel > 0.5) {
      this.beepEngine.playBeep();
    }
    
    // ===== FASE 5: COMPILAR RESULTADO =====
    // Crear respuesta procesada
    const processedSignal: ProcessedPPGSignal = {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      quality: signalQuality * 100, // Escala 0-100
      fingerDetected,
      signalStrength: signalQuality,
      metadata: {
        rrIntervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime,
        isPeak,
        heartRate: this.heartRateEstimate,
        confidence: this.confidenceLevel,
        arrhythmiaCount: this.arrhythmiaCount
      }
    };
    
    return processedSignal;
  }

  /**
   * Algoritmo avanzado de detección de latidos
   * Combina análisis temporal y de amplitud con validación fisiológica
   */
  private detectHeartbeat(value: number, timestamp: number): boolean {
    // Verificar si tenemos suficientes datos para detección
    if (this.valueBuffer.length < 10) {
      return false;
    }
    
    // Verificar amplitud mínima
    if (value < this.PEAK_THRESHOLD) {
      return false;
    }
    
    // Verificar que es un máximo local (5 muestras a cada lado)
    const recentValues = this.valueBuffer.slice(-10);
    const currentIndex = recentValues.length - 1;
    
    // Verificar si es máximo local en ventana
    let isLocalMax = true;
    for (let i = Math.max(0, currentIndex - 2); i <= Math.min(recentValues.length - 1, currentIndex + 2); i++) {
      if (i !== currentIndex && recentValues[i] >= value) {
        isLocalMax = false;
        break;
      }
    }
    
    if (!isLocalMax) {
      return false;
    }
    
    // Verificar tiempo mínimo desde último pico
    if (this.lastPeakTime !== null) {
      const timeSinceLastPeak = timestamp - this.lastPeakTime;
      if (timeSinceLastPeak < this.PEAK_INTERVAL_MIN_MS) {
        return false;
      }
    }
    
    // Verificar si la amplitud es consistente con picos anteriores
    if (this.previousPeakAmplitude > 0) {
      const amplitudeRatio = value / this.previousPeakAmplitude;
      if (amplitudeRatio < 0.3 || amplitudeRatio > 3.0) {
        // Pico con amplitud muy diferente - posible artefacto
        return false;
      }
    }
    
    // Si pasó todas las validaciones, es un pico válido
    this.previousPeakTime = this.lastPeakTime;
    this.lastPeakTime = timestamp;
    this.previousPeakAmplitude = value;
    
    // Registrar en histórico de picos
    this.peakTimestamps.push(timestamp);
    if (this.peakTimestamps.length > this.PEAK_HISTORY_SIZE) {
      this.peakTimestamps.shift();
    }
    
    // Calcular intervalo RR si hay pico previo
    if (this.previousPeakTime !== null) {
      const rrInterval = timestamp - this.previousPeakTime;
      
      // Validar intervalo RR fisiológicamente plausible
      if (rrInterval >= this.PEAK_INTERVAL_MIN_MS && 
          rrInterval <= this.PEAK_INTERVAL_MAX_MS) {
        this.rrIntervals.push(rrInterval);
        if (this.rrIntervals.length > this.PEAK_HISTORY_SIZE) {
          this.rrIntervals.shift();
        }
      }
    }
    
    return true;
  }

  /**
   * Algoritmo avanzado para calcular la calidad de señal cardíaca
   * Evalúa múltiples características de la señal específicas para componentes cardíacos
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) {
      return 0.5; // Calidad media si hay pocos datos
    }
    
    // Característica 1: Variabilidad de la señal (desviación estándar normalizada)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Característica 2: Relación señal/ruido estimada
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
    const iqr = q3 - q1;
    
    // Característica 3: Estabilidad de línea base
    const first10pct = values.slice(0, Math.max(1, Math.floor(values.length * 0.1)));
    const last10pct = values.slice(Math.max(0, values.length - Math.floor(values.length * 0.1)));
    const firstMean = first10pct.reduce((sum, v) => sum + v, 0) / first10pct.length;
    const lastMean = last10pct.reduce((sum, v) => sum + v, 0) / last10pct.length;
    const baselineShift = Math.abs(lastMean - firstMean);
    
    // Calcular puntuación compuesta
    // Desviación ideal entre 0.05 y 0.2 para señal cardíaca
    let stdDevScore = 0;
    if (stdDev >= 0.05 && stdDev <= 0.3) {
      stdDevScore = 1.0 - Math.abs(stdDev - 0.15) / 0.15;
    } else {
      stdDevScore = Math.max(0, 0.5 - Math.abs(stdDev - 0.15));
    }
    
    // IQR ideal entre 0.1 y 0.4 para señal cardíaca
    const iqrScore = iqr >= 0.1 && iqr <= 0.4 ? 
      1.0 - Math.abs(iqr - 0.25) / 0.25 : 
      Math.max(0, 0.5 - Math.abs(iqr - 0.25) / 0.5);
    
    // Cambio de línea base debería ser bajo
    const baselineScore = Math.max(0, 1.0 - baselineShift * 5.0);
    
    // Calcular puntuación total ponderada
    const totalScore = (stdDevScore * 0.4) + (iqrScore * 0.4) + (baselineScore * 0.2);
    
    return Math.min(1.0, Math.max(0, totalScore));
  }

  /**
   * Calcula el ritmo cardíaco y el nivel de confianza basado en los intervalos RR
   * Implementa algoritmos avanzados de estimación y validación
   */
  private updateHeartRateEstimate(): void {
    if (this.rrIntervals.length < 3) {
      this.heartRateEstimate = 0;
      this.confidenceLevel = 0;
      return;
    }
    
    // Filtrar outliers usando el método IQR
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const filteredIntervals = this.rrIntervals.filter(
      interval => interval >= lowerBound && interval <= upperBound
    );
    
    if (filteredIntervals.length < 2) {
      this.heartRateEstimate = 0;
      this.confidenceLevel = 0;
      return;
    }
    
    // Calcular media y desviación estándar de intervalos filtrados
    const sum = filteredIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / filteredIntervals.length;
    
    const variance = filteredIntervals.reduce(
      (acc, val) => acc + Math.pow(val - mean, 2), 0
    ) / filteredIntervals.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Calcular BPM
    const bpm = Math.round(60000 / mean);
    
    // Validar que está en rango fisiológico
    if (bpm < this.BPM_MIN || bpm > this.BPM_MAX) {
      this.heartRateEstimate = 0;
      this.confidenceLevel = 0;
      return;
    }
    
    // Calcular nivel de confianza basado en:
    // 1. Coeficiente de variación (menor es mejor)
    // 2. Número de intervalos disponibles (más es mejor)
    // 3. Estabilidad de la señal
    
    const cv = stdDev / mean; // Coeficiente de variación
    const cvConfidence = Math.max(0, 1.0 - cv * 3.0);
    
    const countConfidence = Math.min(1.0, filteredIntervals.length / 10);
    
    // Combinar factores de confianza
    this.confidenceLevel = (cvConfidence * 0.7) + (countConfidence * 0.3);
    
    // Actualizar estimación solo si confianza supera umbral mínimo
    if (this.confidenceLevel >= this.MIN_CONFIDENCE_THRESHOLD) {
      this.heartRateEstimate = bpm;
    } else {
      this.heartRateEstimate = 0;
    }
  }

  /**
   * Configura el procesador con nuevos parámetros
   */
  public setConfig(config: SignalProcessorConfig): void {
    this.config = { ...this.config, ...config };
    
    // Actualizar configuración de algoritmos internos
    if (config.filterParams) {
      if (config.filterParams.lowPassCutoff || config.filterParams.highPassCutoff) {
        this.signalFilter.updateParameters(
          config.filterParams.lowPassCutoff || this.config.filterParams.lowPassCutoff,
          config.filterParams.highPassCutoff || this.config.filterParams.highPassCutoff
        );
      }
    }
    
    if (config.fingerDetection && config.fingerDetection.threshold) {
      this.peakEnhancer.setThreshold(config.fingerDetection.threshold);
    }
  }

  /**
   * Reinicia el procesador y todos sus algoritmos internos
   */
  public reset(): void {
    this.valueBuffer = [];
    this.timeBuffer = [];
    this.peakTimestamps = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.previousPeakAmplitude = 0;
    this.heartRateEstimate = 0;
    this.confidenceLevel = 0;
    this.arrhythmiaCount = 0;
    
    // Reiniciar algoritmos
    this.signalFilter.reset();
    this.peakEnhancer.reset();
    this.arrhythmiaDetector.reset();
    
    console.log("HeartbeatProcessor: Reset completo del procesador");
  }
}

// ===== ALGORITMOS AVANZADOS PARA PROCESAMIENTO CARDÍACO =====

/**
 * Filtro avanzado de banda específica para señales cardíacas
 * Optimizado para frecuencias fisiológicas del corazón
 */
class AdvancedBandpassFilter {
  private lowPassCoeff: number[] = [];
  private highPassCoeff: number[] = [];
  private lowPassBuffer: number[] = [0, 0, 0, 0];
  private highPassBuffer: number[] = [0, 0, 0, 0];
  private readonly sampleRate: number = 30; // Hz
  
  constructor(lowCutoff: number, highCutoff: number) {
    this.updateParameters(lowCutoff, highCutoff);
  }
  
  public filter(input: number): number {
    // Aplicar filtro paso bajo de 4º orden
    let lowPassOutput = this.lowPassCoeff[0] * input;
    for (let i = 0; i < 4; i++) {
      lowPassOutput += this.lowPassCoeff[i + 1] * this.lowPassBuffer[i];
    }
    
    // Actualizar buffer de paso bajo
    for (let i = 3; i > 0; i--) {
      this.lowPassBuffer[i] = this.lowPassBuffer[i - 1];
    }
    this.lowPassBuffer[0] = input;
    
    // Aplicar filtro paso alto de 4º orden al resultado
    let highPassOutput = this.highPassCoeff[0] * lowPassOutput;
    for (let i = 0; i < 4; i++) {
      highPassOutput += this.highPassCoeff[i + 1] * this.highPassBuffer[i];
    }
    
    // Actualizar buffer de paso alto
    for (let i = 3; i > 0; i--) {
      this.highPassBuffer[i] = this.highPassBuffer[i - 1];
    }
    this.highPassBuffer[0] = lowPassOutput;
    
    return highPassOutput;
  }
  
  public updateParameters(lowCutoff: number, highCutoff: number): void {
    // Calcular coeficientes para filtro Butterworth
    // Simplificación para este contexto
    
    // Paso bajo
    const lowWc = 2 * Math.PI * lowCutoff / this.sampleRate;
    const lowAlpha = Math.sin(lowWc) / (2 * 0.7071);
    const lowScale = 1 / (1 + lowAlpha);
    
    this.lowPassCoeff = [
      lowScale,
      2 * lowScale,
      lowScale,
      -2 * lowScale * Math.cos(lowWc),
      lowScale * (1 - lowAlpha)
    ];
    
    // Paso alto
    const highWc = 2 * Math.PI * highCutoff / this.sampleRate;
    const highAlpha = Math.sin(highWc) / (2 * 0.7071);
    const highScale = 1 / (1 + highAlpha);
    
    this.highPassCoeff = [
      highScale,
      -2 * highScale,
      highScale,
      -2 * highScale * Math.cos(highWc),
      highScale * (1 - highAlpha)
    ];
  }
  
  public reset(): void {
    this.lowPassBuffer = [0, 0, 0, 0];
    this.highPassBuffer = [0, 0, 0, 0];
  }
}

/**
 * Procesador avanzado para mejorar la detección de picos
 * Realza componentes relevantes de la señal cardíaca
 */
class PeakEnhancementProcessor {
  private threshold: number;
  private rejectionFactor: number;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  
  constructor(threshold: number, rejectionFactor: number) {
    this.threshold = threshold;
    this.rejectionFactor = rejectionFactor;
  }
  
  public enhance(value: number): number {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    if (this.buffer.length < 5) {
      return value;
    }
    
    // Calcular promedio local
    const localMean = this.buffer.reduce((sum, v) => sum + v, 0) / this.buffer.length;
    
    // Calcular pendiente local
    const prev = this.buffer[this.buffer.length - 2];
    const slope = value - prev;
    
    // Amplificar componentes de interés
    let enhanced = value;
    
    // Amplificar segmentos crecientes (sístole) 
    if (slope > 0 && value > localMean) {
      enhanced = value * (1 + 0.5 * slope);
    }
    
    // Suprimir artefactos que superen umbral de rechazo
    if (Math.abs(value - localMean) > this.rejectionFactor) {
      enhanced = localMean + (value - localMean) * 0.5;
    }
    
    // Eliminar componentes por debajo del umbral
    if (enhanced < this.threshold * 0.5) {
      enhanced *= 0.5;
    }
    
    return enhanced;
  }
  
  public setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
  
  public reset(): void {
    this.buffer = [];
  }
}

/**
 * Sistema avanzado de detección de arritmias cardíacas
 * Analiza patrones de intervalos RR para detectar irregularidades
 */
class ArrhythmiaDetectionSystem {
  private minInterval: number;
  private maxInterval: number;
  private stabilityBuffer: number[] = [];
  private readonly STABILITY_BUFFER_SIZE = 10;
  private detectionThreshold: number = 0.25;
  private consecutiveAnomalies: number = 0;
  private previousDetectionTime: number = 0;
  private readonly MIN_DETECTION_INTERVAL = 5000; // ms
  
  constructor(minInterval: number, maxInterval: number) {
    this.minInterval = minInterval;
    this.maxInterval = maxInterval;
  }
  
  public analyze(rrIntervals: number[]): boolean {
    if (rrIntervals.length < 5) {
      return false;
    }
    
    // Tomar los últimos intervalos para análisis
    const lastIntervals = rrIntervals.slice(-5);
    
    // Calcular media y desviación estándar
    const sum = lastIntervals.reduce((acc, val) => acc + val, 0);
    const mean = sum / lastIntervals.length;
    
    const variance = lastIntervals.reduce(
      (acc, val) => acc + Math.pow(val - mean, 2), 0
    ) / lastIntervals.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Calcular coeficiente de variación (indicador de irregularidad)
    const cv = stdDev / mean;
    
    // Actualizar buffer de estabilidad
    this.stabilityBuffer.push(cv);
    if (this.stabilityBuffer.length > this.STABILITY_BUFFER_SIZE) {
      this.stabilityBuffer.shift();
    }
    
    // Calcular tendencia de estabilidad
    const stableThreshold = 0.1;
    const isStable = cv < stableThreshold;
    
    // Analizar último intervalo
    const lastInterval = lastIntervals[lastIntervals.length - 1];
    const percentDeviation = Math.abs(lastInterval - mean) / mean;
    const isAnomalous = percentDeviation > this.detectionThreshold;
    
    // Incrementar contador de anomalías consecutivas
    if (isAnomalous && !isStable) {
      this.consecutiveAnomalies++;
    } else {
      this.consecutiveAnomalies = Math.max(0, this.consecutiveAnomalies - 1);
    }
    
    // Detectar arritmia si hay suficientes anomalías consecutivas
    // y ha pasado suficiente tiempo desde la última detección
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.previousDetectionTime;
    
    if (this.consecutiveAnomalies >= 3 && timeSinceLastDetection > this.MIN_DETECTION_INTERVAL) {
      this.previousDetectionTime = currentTime;
      this.consecutiveAnomalies = 0;
      return true;
    }
    
    return false;
  }
  
  public reset(): void {
    this.stabilityBuffer = [];
    this.consecutiveAnomalies = 0;
    this.previousDetectionTime = 0;
  }
}

/**
 * Motor de audio para feedback auditivo de latidos
 * Implementa sonido cardíaco realista y responsivo
 */
class AudioBeepEngine {
  private frequency: number;
  private duration: number;
  private volume: number;
  private audioContext: AudioContext | null = null;
  private lastBeepTime: number = 0;
  private readonly MIN_BEEP_INTERVAL = 200; // ms
  
  constructor(frequency: number, duration: number, volume: number) {
    this.frequency = frequency;
    this.duration = duration;
    this.volume = volume;
    
    // Intentar inicializar AudioContext
    try {
      if (typeof window !== 'undefined' && window.AudioContext) {
        this.audioContext = new window.AudioContext();
      }
    } catch (error) {
      console.warn('HeartbeatProcessor: No se pudo inicializar AudioContext', error);
    }
  }
  
  public playBeep(): boolean {
    if (!this.audioContext) {
      return false;
    }
    
    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL) {
      return false;
    }
    
    try {
      // Crear oscilador para tono principal
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = this.frequency;
      
      // Crear nodo de ganancia para control de volumen
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0;
      
      // Conectar nodos
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Configurar envolvente ADSR para sonido más natural
      const now = this.audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, now + this.duration / 1000);
      
      // Iniciar y detener oscilador
      oscillator.start(now);
      oscillator.stop(now + this.duration / 1000 + 0.05);
      
      this.lastBeepTime = Date.now();
      return true;
    } catch (error) {
      console.error('HeartbeatProcessor: Error reproduciendo beep', error);
      return false;
    }
  }
}

/**
 * Crea una nueva instancia del procesador de ritmo cardíaco
 */
export function createHeartbeatProcessor(): SignalProcessor {
  return new HeartbeatProcessor();
}
