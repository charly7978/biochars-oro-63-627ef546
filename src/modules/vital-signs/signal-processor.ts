
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';

/**
 * Procesador de señales optimizado para sensibilidad y medición real
 * - Algoritmos adaptados para detectar y procesar señales débiles
 * - Filtrado adaptativo sin simulación
 * - Capacidad de procesamiento mejorada para patrones fisiológicos reales
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Raw signal buffer for direct processing
  private rawPpgValues: number[] = [];
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - UMBRALES REDUCIDOS para mayor sensibilidad
  private readonly MIN_QUALITY_FOR_FINGER = 5; // Reducido drásticamente
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 1000; // ms
  private readonly MIN_SIGNAL_AMPLITUDE = 0.008; // Reducido 6x
  
  // Tracking variables
  private processingCount: number = 0;
  private processingStartTime: number = 0;
  private lastDetectedAmplitude: number = 0;
  
  // Diagnóstico extendido
  private lastFilteredValues: number[] = [];
  private filterStats = {
    inputRange: { min: Infinity, max: -Infinity },
    outputRange: { min: Infinity, max: -Infinity },
    noiseReduction: 0,
    signalPreservation: 0
  };
  
  /**
   * Constructor optimizado para sensibilidad y respuesta máxima
   */
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    
    // Usar umbral ultra-sensible para detección de dedo
    this.signalValidator = new SignalValidator(0.0015, 4);
    
    this.processingStartTime = Date.now();
    
    console.log("SignalProcessor: Inicializado con parámetros optimizados para sensibilidad máxima");
  }
  
  /**
   * Apply Moving Average filter with adaptive window size
   */
  public applySMAFilter(value: number): number {
    this.processingCount++;
    
    // Store raw value for direct processing
    this.rawPpgValues.push(value);
    if (this.rawPpgValues.length > 100) {
      this.rawPpgValues.shift();
    }
    
    // Determinar tamaño de ventana adaptativo - más pequeño para señales débiles
    let windowSize = 3; // Tamaño base reducido
    
    if (this.rawPpgValues.length >= 10) {
      const recentValues = this.rawPpgValues.slice(-10);
      const range = Math.max(...recentValues) - Math.min(...recentValues);
      
      // Ajustar ventana inversamente al rango (señales más débiles = ventana más pequeña)
      if (range > 0.1) {
        windowSize = 4;
      } else if (range < 0.02) {
        windowSize = 2; // Ventana mínima para preservar señales débiles
      }
    }
    
    // Logging periódico sin saturar consola
    if (this.processingCount % 30 === 0) {
      console.log("SignalProcessor: Procesando señal REAL con SMA adaptativo", {
        valorOriginal: value,
        ventanaAdaptativa: windowSize,
        rawBufferSize: this.rawPpgValues.length,
        filteredBufferSize: this.ppgValues.length
      });
    }
    
    // Aplicar filtro con ventana adaptativa
    return this.filter.applySMAFilter(value, this.ppgValues, windowSize);
  }
  
  /**
   * Apply Exponential Moving Average filter with optimized alpha
   */
  public applyEMAFilter(value: number, alpha?: number): number {
    // Determinar alpha adaptativo basado en características de señal
    let adaptiveAlpha = alpha || 0.3; // Valor base más alto para mayor respuesta
    
    if (this.rawPpgValues.length >= 10) {
      const recentValues = this.rawPpgValues.slice(-10);
      const range = Math.max(...recentValues) - Math.min(...recentValues);
      
      // Señales débiles necesitan alpha más grande para preservar información
      if (range < 0.02) {
        adaptiveAlpha = Math.min(0.5, adaptiveAlpha * 1.5);
      }
      // Señales ruidosas necesitan alpha más pequeño para filtrar ruido
      else if (range > 0.2) {
        adaptiveAlpha = Math.max(0.2, adaptiveAlpha * 0.8);
      }
    }
    
    return this.filter.applyEMAFilter(value, this.ppgValues, adaptiveAlpha);
  }
  
  /**
   * Apply median filter optimized for real signals
   */
  public applyMedianFilter(value: number): number {
    // Determinar tamaño de ventana para filtro mediano
    let windowSize = 3; // Base reducida para mejor respuesta
    
    if (this.rawPpgValues.length >= 10) {
      const noisySignal = this.isSignalNoisy();
      if (noisySignal) {
        windowSize = 5; // Ventana mayor para señales ruidosas
      }
    }
    
    return this.filter.applyMedianFilter(value, this.ppgValues, windowSize);
  }
  
  /**
   * Detectar si la señal es ruidosa
   */
  private isSignalNoisy(): boolean {
    if (this.rawPpgValues.length < 10) return false;
    
    const recentValues = this.rawPpgValues.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular suma de diferencias de primer orden (cambios abruptos)
    let abruptChanges = 0;
    for (let i = 1; i < recentValues.length; i++) {
      abruptChanges += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    
    // Normalizar por media
    const normalizedChanges = mean !== 0 ? abruptChanges / (mean * recentValues.length) : 0;
    
    // Umbral para considerarse ruidosa
    return normalizedChanges > 0.5;
  }
  
  /**
   * Get raw PPG values
   */
  public getRawPPGValues(): number[] {
    return [...this.rawPpgValues];
  }
  
  /**
   * Check if finger is detected with improved sensitivity
   */
  public isFingerDetected(): boolean {
    // Si ya tenemos confirmación previa, mantener detección
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Calcular amplitud para detección básica
    if (this.rawPpgValues.length >= 6) {
      const recentValues = this.rawPpgValues.slice(-6);
      this.lastDetectedAmplitude = Math.max(...recentValues) - Math.min(...recentValues);
      
      // Detección rápida con amplitud significativa
      if (this.lastDetectedAmplitude >= this.MIN_SIGNAL_AMPLITUDE * 3) {
        const runningTime = Date.now() - this.processingStartTime;
        
        // Si llevamos un tiempo ejecutando y hay buena amplitud, detectar inmediatamente
        if (runningTime > 1000) {
          return true;
        }
      }
    }
    
    // Usar validador de señal (más adaptable y sensible)
    return this.signalValidator.isFingerDetected();
  }
  
  /**
   * Procesar señal completa con filtrado adaptativo para señales débiles
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean, rawValue: number } {
    this.processingCount++;
    
    // Actualizar rango de entrada para diagnósticos
    this.filterStats.inputRange.min = Math.min(this.filterStats.inputRange.min, value);
    this.filterStats.inputRange.max = Math.max(this.filterStats.inputRange.max, value);
    
    // Store raw value primero
    this.rawPpgValues.push(value);
    if (this.rawPpgValues.length > 100) {
      this.rawPpgValues.shift();
    }
    
    // Track signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Filtrado multi-etapa optimizado para sensibilidad
    
    // 1. Filtro mediano para eliminar outliers (adaptativo)
    const medianFiltered = this.applyMedianFilter(value);
    
    // 2. Filtro paso bajo optimizado (EMA con alpha adaptativo)
    const lowPassFiltered = this.applyEMAFilter(medianFiltered, 0.4); // Alpha más alto para mejor respuesta
    
    // 3. Suavizado final (SMA adaptativo)
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Actualizar buffer de valores filtrados
    this.lastFilteredValues.push(smaFiltered);
    if (this.lastFilteredValues.length > 10) {
      this.lastFilteredValues.shift();
    }
    
    // Actualizar rango de salida para diagnósticos
    this.filterStats.outputRange.min = Math.min(this.filterStats.outputRange.min, smaFiltered);
    this.filterStats.outputRange.max = Math.max(this.filterStats.outputRange.max, smaFiltered);
    
    // Calculate noise level y calidad con umbrales adaptados
    this.quality.updateNoiseLevel(value, smaFiltered);
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Store the filtered value
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Check finger detection usando detección de patrones con umbral reducido
    const fingerDetected = this.isFingerDetected();
    
    // Calculate signal amplitude from filtered data
    let amplitude = 0;
    if (this.ppgValues.length > 6) {
      const recentValues = this.ppgValues.slice(-6);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Detección de amplitud con umbral adaptativo para mayor sensibilidad
    const adaptiveAmplitudeThreshold = Math.max(
      this.MIN_SIGNAL_AMPLITUDE * 0.5,
      Math.min(this.MIN_SIGNAL_AMPLITUDE, this.lastDetectedAmplitude * 0.3)
    );
    
    const hasValidAmplitude = amplitude >= adaptiveAmplitudeThreshold || 
                             this.lastDetectedAmplitude >= adaptiveAmplitudeThreshold;
    
    // Confirmar detección de dedo con criterios más sensibles
    if (fingerDetected && hasValidAmplitude && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Inicio potencial de detección de dedo", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude,
          adaptiveThreshold: adaptiveAmplitudeThreshold
        });
      }
      
      // Confirmar tras tiempo mínimo para evitar falsos positivos, pero con umbral temporal reducido
      if (this.fingerDetectionStartTime && 
         (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true;
        console.log("Signal processor: Detección de dedo CONFIRMADA", {
          time: new Date(now).toISOString(),
          method: "Detección de patrón rítmico",
          detectionTime: (now - this.fingerDetectionStartTime) / 1000,
          quality: qualityValue,
          amplitude,
          validatorConfidence: this.signalValidator.getFingerConfidence()
        });
      }
    } 
    else if (!fingerDetected || !hasValidAmplitude) {
      // Para pérdida de detección, usar umbral temporal mayor para evitar interrupciones
      const consistentLossThreshold = 4000; // ms - más tiempo para evitar pérdidas intermitentes
      const now = Date.now();
      
      if (this.fingerDetectionConfirmed && 
          this.fingerDetectionStartTime && 
          (now - this.fingerDetectionStartTime > consistentLossThreshold)) {
        
        console.log("Signal processor: Detección de dedo perdida", {
          hasValidPattern: fingerDetected,
          hasValidAmplitude,
          amplitude,
          adaptiveThreshold: adaptiveAmplitudeThreshold,
          quality: qualityValue,
          timeSinceDetection: this.fingerDetectionStartTime ? (now - this.fingerDetectionStartTime) : "N/A"
        });
        
        this.fingerDetectionConfirmed = false;
        this.fingerDetectionStartTime = null;
        this.rhythmBasedFingerDetection = false;
      }
    }
    
    // Calcular estadísticas de reducción de ruido
    if (this.rawPpgValues.length > 10 && this.lastFilteredValues.length > 5) {
      const rawVariance = this.calculateVariance(this.rawPpgValues.slice(-10));
      const filteredVariance = this.calculateVariance(this.lastFilteredValues);
      
      if (rawVariance > 0) {
        this.filterStats.noiseReduction = 1 - (filteredVariance / rawVariance);
      }
      
      const rawRange = Math.max(...this.rawPpgValues.slice(-10)) - Math.min(...this.rawPpgValues.slice(-10));
      const filteredRange = Math.max(...this.lastFilteredValues) - Math.min(...this.lastFilteredValues);
      
      if (rawRange > 0) {
        this.filterStats.signalPreservation = filteredRange / rawRange;
      }
    }
    
    // Log de resultados periódico para diagnóstico
    if (this.processingCount % 30 === 0) {
      console.log("SignalProcessor: Resultado de filtrado", {
        original: value,
        median: medianFiltered,
        ema: lowPassFiltered, 
        sma: smaFiltered,
        quality: qualityValue,
        fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed,
        amplitude,
        adaptiveThreshold: adaptiveAmplitudeThreshold,
        validatorConfidence: this.signalValidator.getFingerConfidence(),
        filterStats: this.filterStats
      });
    }
    
    return { 
      filteredValue: smaFiltered,
      rawValue: value,
      quality: qualityValue,
      fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed
    };
  }
  
  /**
   * Calcular varianza de array de valores
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Intentar calcular primero con valores filtrados para estabilidad
    const filteredBpm = this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
    
    // Si no funciona bien, probar con valores crudos que pueden tener picos más claros
    const rawBpm = this.rawPpgValues.length >= 30 ? 
      this.heartRateDetector.calculateHeartRate(this.rawPpgValues.slice(-30), sampleRate) : 0;
    
    // Usar el resultado más confiable
    const bpm = filteredBpm > 40 ? filteredBpm : (rawBpm > 40 ? rawBpm : 0);
    
    // Log para diagnóstico
    if (this.processingCount % 20 === 0) {
      console.log("Heart rate detection (REAL):", { 
        filteredBpm, 
        rawBpm,
        selectedBpm: bpm,
        rawBufferSize: this.rawPpgValues.length,
        filteredBufferSize: this.ppgValues.length,
        amplitude: this.lastDetectedAmplitude,
        sampleRate
      });
    }
    
    return bpm;
  }
  
  /**
   * Get the PPG values buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    super.reset();
    this.rawPpgValues = [];
    this.quality.reset();
    this.filter.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    this.processingCount = 0;
    this.processingStartTime = Date.now();
    this.lastDetectedAmplitude = 0;
    this.lastFilteredValues = [];
    
    // Reiniciar estadísticas de filtrado
    this.filterStats = {
      inputRange: { min: Infinity, max: -Infinity },
      outputRange: { min: Infinity, max: -Infinity },
      noiseReduction: 0,
      signalPreservation: 0
    };
    
    console.log("SignalProcessor: Reset completo de todos los componentes y buffers");
  }
  
  /**
   * Obtener estadísticas de diagnóstico
   */
  public getDiagnostics(): any {
    return {
      processingCount: this.processingCount,
      runningTime: (Date.now() - this.processingStartTime) / 1000,
      rawBufferSize: this.rawPpgValues.length,
      filteredBufferSize: this.ppgValues.length,
      lastDetectedAmplitude: this.lastDetectedAmplitude,
      fingerDetectionConfirmed: this.fingerDetectionConfirmed,
      rhythmBasedFingerDetection: this.rhythmBasedFingerDetection,
      filterStats: this.filterStats,
      validatorStats: this.signalValidator.getStats()
    };
  }
}
