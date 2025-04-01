
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
  private readonly MIN_PEAK_AMPLITUDE = 0.0035; // Reducido a 0.35% para detectar señales muy débiles
  private readonly MIN_PEAK_INTERVAL_MS = 250; // Revisado para permitir latidos más frecuentes
  private readonly MAX_PEAK_INTERVAL_MS = 1500;
  private readonly CONFIDENCE_THRESHOLD = 0.10; // Reducido para ser más sensible
  
  // Calibración automática para mejor sensibilidad en señales débiles
  private dynamicThreshold = 0.008; // Comenzar con un umbral bajo
  private adaptationRate = 0.15; // Tasa de adaptación del umbral
  private peakBuffer: number[] = [];
  private signalHistory: number[] = [];
  private timeHistory: number[] = [];
  
  // Seguimiento de picos
  private lastPeakTime: number | null = null;
  private peakCount = 0;
  private bpmValues: number[] = [];
  
  // Suavizado y filtrado
  private readonly SMOOTHING_FACTOR = 0.3; // Mayor suavizado para señales débiles
  private lastFilteredValue = 0;
  
  // Adaptador para salida compatible
  private adapter: HeartbeatProcessorAdapter;
  
  // Diagnóstico y depuración
  private consecutiveWeakSignals = 0;
  private readonly MAX_WEAK_SIGNALS = 12; // Aumentar para mayor estabilidad con señales débiles
  private readonly WEAK_SIGNAL_THRESHOLD = 0.004; // Umbral muy bajo para detectar débiles
  
  constructor() {
    this.adapter = new HeartbeatProcessorAdapter();
    console.log("HeartbeatProcessor: Instanciado con configuración HIPER-SENSIBLE");
  }
  
  /**
   * Procesa un valor de señal
   * OPTIMIZADO PARA SEÑALES EXTREMADAMENTE DÉBILES
   */
  processSignal(value: number): ProcessedHeartbeatSignal {
    // Diagnóstico de señal débil
    const signalStrength = Math.abs(value);
    if (signalStrength < this.WEAK_SIGNAL_THRESHOLD) {
      this.consecutiveWeakSignals++;
      
      // Registrar para depuración cada 10 muestras
      if (this.consecutiveWeakSignals % 10 === 0) {
        console.log("HeartbeatProcessor: Señal EXTREMADAMENTE débil", {
          valor: value,
          intensidadAbsoluta: signalStrength,
          umbralMinimo: this.WEAK_SIGNAL_THRESHOLD,
          señalesDebilesSeguidas: this.consecutiveWeakSignals,
          umbralActualPicos: this.dynamicThreshold
        });
      }
    } else {
      // Reducir contador de señales débiles
      this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 2);
    }
    
    // Aplicar filtro de paso bajo para señales débiles
    const filteredValue = this.applyLowPassFilter(value);
    
    // Actualizar historial (para detección dinámica)
    const now = Date.now();
    this.updateSignalHistory(filteredValue, now);
    
    // Actualizar umbral dinámico (más sensible para señales débiles)
    this.updateDynamicThreshold();
    
    // Detectar pico con umbral adaptativo
    const { isPeak, confidence } = this.detectPeak(filteredValue, now);
    
    // Actualizar seguimiento de picos
    if (isPeak) {
      this.updatePeakTracking(now);
      
      // Diagnóstico de pico detectado
      console.log("HeartbeatProcessor: PICO DETECTADO en señal", {
        valorFiltrado: filteredValue,
        umbralActual: this.dynamicThreshold,
        confianza: confidence,
        tiempoTranscurrido: this.lastPeakTime ? now - this.lastPeakTime : null,
        totalPicos: this.peakCount,
        bpm: this.calculateInstantaneousBPM(now)
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
   * Filtro de paso bajo más agresivo para señales débiles
   */
  private applyLowPassFilter(value: number): number {
    // Determinar factor dinámico de suavizado basado en la fuerza de señal
    const signalStrength = Math.abs(value);
    
    // Más suavizado para señales extremadamente débiles
    let smoothingFactor = this.SMOOTHING_FACTOR;
    
    if (signalStrength < 0.01) {
      smoothingFactor = 0.15; // Más suavizado para señales muy débiles
    }
    
    // Aplicar filtro con factor dinámico
    this.lastFilteredValue = 
      value * smoothingFactor + this.lastFilteredValue * (1 - smoothingFactor);
    
    return this.lastFilteredValue;
  }
  
  /**
   * Actualiza historial de señal para análisis
   */
  private updateSignalHistory(value: number, timestamp: number): void {
    this.signalHistory.push(value);
    this.timeHistory.push(timestamp);
    
    // Mantener un buffer de 30 muestras (aproximadamente 1 segundo a 30 fps)
    if (this.signalHistory.length > 30) {
      this.signalHistory.shift();
      this.timeHistory.shift();
    }
  }
  
  /**
   * Actualiza umbral dinámico basado en historial de señal
   * OPTIMIZADO PARA SEÑALES DÉBILES
   */
  private updateDynamicThreshold(): void {
    if (this.signalHistory.length < 10) return;
    
    // Optimización: más sensible para señales débiles
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Para señales extremadamente débiles, usar umbral absoluto muy bajo
    if (range < 0.02) {
      // Reducir umbral para señales muy débiles
      this.dynamicThreshold = Math.max(0.0025, this.dynamicThreshold * 0.9);
      return;
    }
    
    // Calcular nuevo umbral dinámico como % del rango (más bajo para señales débiles)
    const newThreshold = range * 0.15; // 15% del rango como umbral
    
    // Actualizar gradualmente
    this.dynamicThreshold = 
      (1 - this.adaptationRate) * this.dynamicThreshold + 
      this.adaptationRate * newThreshold;
    
    // Asegurar umbral mínimo para detectar señales extremadamente débiles
    this.dynamicThreshold = Math.max(0.0035, this.dynamicThreshold);
  }
  
  /**
   * Detecta picos en la señal usando umbral dinámico
   * OPTIMIZADO PARA SEÑALES EXTREMADAMENTE DÉBILES
   */
  private detectPeak(value: number, timestamp: number): { isPeak: boolean, confidence: number } {
    // Necesitamos historial mínimo
    if (this.signalHistory.length < 5) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Verificar intervalo mínimo con último pico
    if (this.lastPeakTime && timestamp - this.lastPeakTime < this.MIN_PEAK_INTERVAL_MS) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Buffer de valores para detectar pico local
    const recentValues = this.signalHistory.slice(-5);
    const currentValue = recentValues[recentValues.length - 1];
    const previousValue = recentValues[recentValues.length - 2] || 0;
    
    // Condiciones para pico:
    // 1. Valor actual mayor que umbral
    const aboveThreshold = Math.abs(currentValue) > this.dynamicThreshold ||
                          (this.consecutiveWeakSignals > 10 && Math.abs(currentValue) > this.WEAK_SIGNAL_THRESHOLD);
    
    // 2. Señal en punto de inflexión
    const isPeaking = currentValue < previousValue && 
                     previousValue > (recentValues[recentValues.length - 3] || 0);
    
    // 3. Verificación adicional para evitar falsos positivos
    const isLocalMaximum = previousValue === Math.max(...recentValues);
    
    // Determinar si es un pico - CRITERIOS MÁS SENSIBLES
    const isPeak = aboveThreshold && (isPeaking || isLocalMaximum);
    
    // Calcular nivel de confianza
    let confidence = 0;
    
    if (isPeak) {
      // Calcular confianza basada en amplitud relativa
      const minValue = Math.min(...this.signalHistory.slice(-10));
      const maxValue = Math.max(...this.signalHistory.slice(-10));
      const range = maxValue - minValue;
      
      // Para señales débiles, calcular confianza normalizada al rango
      if (range > 0) {
        const normalizedAmplitude = (previousValue - minValue) / range;
        confidence = Math.min(1, normalizedAmplitude * 1.5); // Boost para confianza
      } else {
        // Si no hay rango, confianza mínima pero suficiente para registrar
        confidence = 0.15;
      }
      
      // Para señales extremadamente débiles, asignar confianza mínima
      if (this.consecutiveWeakSignals > 8) {
        confidence = Math.max(0.15, confidence * 0.8);
      }
    }
    
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
    if (this.timeHistory.length > 5 && this.peakBuffer.length > 0) {
      const previousPeakTime = this.peakBuffer[this.peakBuffer.length - 1];
      const interval = timestamp - previousPeakTime;
      
      // Solo considerar intervalos fisiológicamente plausibles
      if (interval >= this.MIN_PEAK_INTERVAL_MS && interval <= this.MAX_PEAK_INTERVAL_MS) {
        const bpm = Math.round(60000 / interval);
        
        // Solo registrar BPM plausibles
        if (bpm >= 40 && bpm <= 200) {
          this.bpmValues.push(bpm);
          
          // Mantener solo los valores más recientes
          if (this.bpmValues.length > 10) {
            this.bpmValues.shift();
          }
        }
      }
    }
    
    // Registrar tiempo de pico
    this.peakBuffer.push(timestamp);
    if (this.peakBuffer.length > 10) {
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
    if (interval < this.MIN_PEAK_INTERVAL_MS || interval > this.MAX_PEAK_INTERVAL_MS) {
      return 0;
    }
    
    return Math.round(60000 / interval);
  }
  
  /**
   * Calcula BPM promedio filtrado
   */
  private calculateAverageBPM(): number {
    if (this.bpmValues.length < 3) return 0;
    
    // Filtrar outliers
    const sortedBPM = [...this.bpmValues].sort((a, b) => a - b);
    const filteredBPM = sortedBPM.slice(
      Math.floor(sortedBPM.length * 0.1),
      Math.ceil(sortedBPM.length * 0.9)
    );
    
    if (filteredBPM.length === 0) return 0;
    
    // Calcular promedio
    const sum = filteredBPM.reduce((a, b) => a + b, 0);
    return Math.round(sum / filteredBPM.length);
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
      this.MIN_PEAK_INTERVAL_MS = options.minPeakDistance;
    }
    
    console.log("HeartbeatProcessor: Configurado con opciones personalizadas", {
      umbralPico: this.dynamicThreshold,
      tasaAdaptacion: this.adaptationRate,
      distanciaMinimaPicos: this.MIN_PEAK_INTERVAL_MS
    });
  }
  
  /**
   * Resetea el procesador
   */
  reset(): void {
    this.dynamicThreshold = 0.008;
    this.peakBuffer = [];
    this.signalHistory = [];
    this.timeHistory = [];
    this.lastPeakTime = null;
    this.peakCount = 0;
    this.bpmValues = [];
    this.lastFilteredValue = 0;
    this.consecutiveWeakSignals = 0;
    this.adapter.reset();
    
    console.log("HeartbeatProcessor: Reseteado a valores iniciales");
  }
}
