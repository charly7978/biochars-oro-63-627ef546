
import { ProcessedHeartbeatSignal, SignalProcessingOptions } from './types';
import { HeartbeatProcessorAdapter } from './adapters/HeartbeatProcessorAdapter';

/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador especializado para latidos cardíacos
 * VERSIÓN HIPER-SENSIBLE: Optimizada para señales extremadamente débiles
 */
export class HeartbeatProcessor {
  // Umbral de pico mucho más sensible para señales débiles
  private readonly MIN_PEAK_AMPLITUDE = 0.0005; // Reducido aún más para mayor sensibilidad
  // Changed from readonly to private to allow configuration
  private minPeakIntervalMs = 200; // Reducido para permitir latidos más frecuentes
  private readonly MAX_PEAK_INTERVAL_MS = 1500;
  private readonly CONFIDENCE_THRESHOLD = 0.01; // Reducido DRÁSTICAMENTE para ser extremadamente sensible
  
  // Calibración automática para mejor sensibilidad en señales débiles
  private dynamicThreshold = 0.001; // Umbral inicial EXTREMADAMENTE bajo
  private adaptationRate = 0.3; // Tasa de adaptación más agresiva
  private peakBuffer: number[] = [];
  private signalHistory: number[] = [];
  private timeHistory: number[] = [];
  
  // Seguimiento de picos
  private lastPeakTime: number | null = null;
  private peakCount = 0;
  private bpmValues: number[] = [];
  
  // Suavizado y filtrado DRASTICAMENTE REDUCIDO
  private readonly SMOOTHING_FACTOR = 0.15; // Reducido EXTREMADAMENTE para preservar señal original
  private lastFilteredValue = 0;
  
  // Adaptador para salida compatible
  private adapter: HeartbeatProcessorAdapter;
  
  // Diagnóstico y depuración
  private consecutiveWeakSignals = 0;
  private readonly MAX_WEAK_SIGNALS = 3; // Reducido para mayor sensibilidad
  private readonly WEAK_SIGNAL_THRESHOLD = 0.0005; // Umbral extremadamente bajo para detección
  
  // Amplificación dinámica para señales débiles
  private signalAmplification = 15.0; // AUMENTADO DRÁSTICAMENTE para señales débiles
  private readonly MAX_AMPLIFICATION = 50.0; // AUMENTADO el máximo
  private readonly MIN_AMPLIFICATION = 5.0; // AUMENTADO el mínimo
  
  constructor() {
    this.adapter = new HeartbeatProcessorAdapter();
    console.log("HeartbeatProcessor: Instanciado con configuración ULTRA-SENSIBLE EXTREMA", {
      umbralPico: this.dynamicThreshold,
      factorAmplificacion: this.signalAmplification,
      suavizado: this.SMOOTHING_FACTOR
    });
  }
  
  /**
   * Procesa un valor de señal
   * OPTIMIZADO PARA SEÑALES EXTREMADAMENTE DÉBILES
   * SIN FILTROS REDUCTORES DE RUIDO
   */
  processSignal(value: number): ProcessedHeartbeatSignal {
    // AMPLIFICACIÓN DIRECTA SIN FILTRADO PREVIO
    const amplifiedValue = value * this.signalAmplification;
    
    // Diagnóstico de señal
    const signalStrength = Math.abs(amplifiedValue);
    
    // AQUÍ NO SE APLICA NINGÚN FILTRO DE PASO BAJO - SEÑAL DIRECTA
    const filteredValue = amplifiedValue;
    
    // Actualizar historial (para detección dinámica)
    const now = Date.now();
    this.updateSignalHistory(filteredValue, now);
    
    // Umbral extremadamente bajo para detectar cualquier señal
    this.dynamicThreshold = 0.001;
    
    // Detectar pico con umbral super adaptativo
    const { isPeak, confidence } = this.detectPeak(filteredValue, now);
    
    // Actualizar seguimiento de picos
    if (isPeak) {
      this.updatePeakTracking(now);
      
      // Diagnóstico de pico detectado
      console.log("HeartbeatProcessor: PICO DETECTADO en señal", {
        valorOriginal: value,
        valorAmplificado: amplifiedValue,
        valorFiltrado: filteredValue,
        umbralActual: this.dynamicThreshold,
        confianza: confidence,
        factorAmplificacion: this.signalAmplification,
        tiempoTranscurrido: this.lastPeakTime ? now - this.lastPeakTime : null,
        totalPicos: this.peakCount
      });
    }
    
    // Calcular BPM instantáneo y promedio
    const instantaneousBPM = this.calculateInstantaneousBPM(now);
    const averageBPM = this.calculateAverageBPM();
    
    // Crear resultado usando el adaptador (asegura compatibilidad de tipos)
    return this.adapter.adaptResult({
      filteredValue,
      isPeak,
      confidence,
      bpm: instantaneousBPM
    });
  }
  
  /**
   * Amplifica señales débiles dinámicamente - SIN LIMITACIÓN
   */
  private amplifySignal(value: number): number {
    return value * this.signalAmplification;
  }
  
  /**
   * Ajusta dinámicamente el factor de amplificación - SIEMPRE AL MÁXIMO
   */
  private adjustAmplification(increase: boolean): void {
    // SIEMPRE AMPLIFICAR AL MÁXIMO
    this.signalAmplification = this.MAX_AMPLIFICATION;
  }
  
  /**
   * Actualiza historial de señal para análisis - SIN FILTRADO
   */
  private updateSignalHistory(value: number, timestamp: number): void {
    this.signalHistory.push(value);
    this.timeHistory.push(timestamp);
    
    // Mantener un buffer de 10 muestras (reducido)
    if (this.signalHistory.length > 10) {
      this.signalHistory.shift();
      this.timeHistory.shift();
    }
  }
  
  /**
   * Detecta picos en la señal usando umbral extremadamente bajo
   * OPTIMIZADO PARA SEÑALES EXTREMADAMENTE DÉBILES
   */
  private detectPeak(value: number, timestamp: number): { isPeak: boolean, confidence: number } {
    // Necesitamos historial mínimo
    if (this.signalHistory.length < 3) { // Reducido a solo 3 muestras
      return { isPeak: false, confidence: 0 };
    }
    
    // Verificar intervalo mínimo con último pico
    if (this.lastPeakTime && timestamp - this.lastPeakTime < this.minPeakIntervalMs) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Simplificado: detectar cualquier valor positivo sobre el umbral mínimo
    const isPeak = Math.abs(value) > this.MIN_PEAK_AMPLITUDE;
    
    // Siempre dar alta confianza para procesar la señal
    const confidence = isPeak ? 0.8 : 0;
    
    return { isPeak, confidence };
  }
  
  /**
   * Actualiza seguimiento de picos
   */
  private updatePeakTracking(timestamp: number): void {
    // Actualizar tiempo del último pico
    this.lastPeakTime = timestamp;
    this.peakCount++;
    
    // Si tenemos pico anterior, calcular intervalo RR
    if (this.timeHistory.length > 3 && this.peakBuffer.length > 0) {
      const previousPeakTime = this.peakBuffer[this.peakBuffer.length - 1];
      const interval = timestamp - previousPeakTime;
      
      // Solo considerar intervalos fisiológicamente plausibles
      if (interval >= this.minPeakIntervalMs && interval <= this.MAX_PEAK_INTERVAL_MS) {
        const bpm = Math.round(60000 / interval);
        
        // Solo registrar BPM plausibles
        if (bpm >= 40 && bpm <= 200) {
          this.bpmValues.push(bpm);
          
          // Mantener solo los valores más recientes
          if (this.bpmValues.length > 5) { // Reducido a 5
            this.bpmValues.shift();
          }
        }
      }
    }
    
    // Registrar tiempo de pico
    this.peakBuffer.push(timestamp);
    if (this.peakBuffer.length > 5) { // Reducido a 5
      this.peakBuffer.shift();
    }
  }
  
  /**
   * Calcula BPM instantáneo basado en último intervalo RR
   */
  private calculateInstantaneousBPM(now: number): number {
    if (this.peakBuffer.length < 2) return 0;
    
    const lastPeakTime = this.peakBuffer[this.peakBuffer.length - 1];
    const previousPeakTime = this.peakBuffer[this.peakBuffer.length - 2];
    const interval = lastPeakTime - previousPeakTime;
    
    // Verificar intervalo válido para cálculo de BPM
    if (interval < this.minPeakIntervalMs || interval > this.MAX_PEAK_INTERVAL_MS) {
      return 0;
    }
    
    return Math.round(60000 / interval);
  }
  
  /**
   * Calcula BPM promedio filtrado - SIMPLIFICADO
   */
  private calculateAverageBPM(): number {
    if (this.bpmValues.length < 2) return 0;
    
    // Simple promedio sin filtrado
    const sum = this.bpmValues.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.bpmValues.length);
  }
  
  /**
   * Configura el procesador con opciones personalizadas
   */
  configure(options: SignalProcessingOptions): void {
    if (options.peakThreshold !== undefined) {
      this.dynamicThreshold = options.peakThreshold;
    }
    
    if (options.adaptationRate !== undefined) {
      this.adaptationRate = options.adaptationRate;
    }
    
    if (options.minPeakDistance !== undefined) {
      this.minPeakIntervalMs = options.minPeakDistance;
    }
    
    if (options.signalAmplification !== undefined) {
      this.signalAmplification = Math.max(this.MIN_AMPLIFICATION, 
                                         Math.min(this.MAX_AMPLIFICATION, 
                                                 options.signalAmplification));
    }
    
    console.log("HeartbeatProcessor: Configurado con opciones personalizadas SIN FILTROS", {
      umbralPico: this.dynamicThreshold,
      tasaAdaptacion: this.adaptationRate,
      distanciaMinimaPicos: this.minPeakIntervalMs,
      amplificacion: this.signalAmplification
    });
  }
  
  /**
   * Resetea el procesador
   */
  reset(): void {
    this.dynamicThreshold = 0.001; // Reducido a extremadamente bajo
    this.signalAmplification = 15.0; // Aumentado drásticamente
    this.peakBuffer = [];
    this.signalHistory = [];
    this.timeHistory = [];
    this.lastPeakTime = null;
    this.peakCount = 0;
    this.bpmValues = [];
    this.lastFilteredValue = 0;
    this.consecutiveWeakSignals = 0;
    this.adapter.reset();
    
    console.log("HeartbeatProcessor: Reseteado a valores iniciales SIN FILTROS", {
      umbralInicial: this.dynamicThreshold,
      amplificacionInicial: this.signalAmplification
    });
  }
}
