
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador avanzado de señal cardíaca
 * Se encarga del procesamiento especializado de picos/latidos
 */
import { ProcessedHeartbeatSignal, SignalProcessor, SignalProcessingOptions } from './types';
import { AdaptivePredictor, createAdaptivePredictor } from './utils/adaptive-predictor';

/**
 * Clase para el procesamiento avanzado de señales cardíacas
 */
export class HeartbeatProcessor implements SignalProcessor<ProcessedHeartbeatSignal> {
  // Almacenamiento de valores y picos
  private values: number[] = [];
  private rawValues: number[] = []; // Almacenamiento de valores originales sin procesar
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  
  // Detección de picos
  private lastPeakTime: number | null = null;
  private lastPeakValue: number = 0;
  private peakThreshold: number = 0.2;
  private minPeakDistance: number = 250; // ms
  
  // Configuración
  private adaptiveToPeakHistory: boolean = true;
  private dynamicThresholdFactor: number = 0.6;
  
  // Predictive modeling and adaptive control - configuración más conservadora
  private adaptivePredictor: AdaptivePredictor;
  private useAdaptiveControl: boolean = true;
  private qualityEnhancedByPrediction: boolean = true;
  private predictionWeight: number = 0.3; // Reducido de valor más alto para menor influencia
  private correctionThreshold: number = 0.7; // Umbral más alto para aplicar correcciones
  private signalEnhancementAmount: number = 0.5; // Limitador para la mejora de señal (0-1)
  
  // Transparencia y auditoría
  private wasValueEnhanced: boolean = false;
  private enhancementAmount: number = 0;
  private dataManipulationLog: Array<{
    timestamp: number,
    originalValue: number,
    enhancedValue: number,
    enhancementType: string,
    enhancementAmount: number
  }> = [];
  
  constructor() {
    this.adaptivePredictor = createAdaptivePredictor();
  }
  
  /**
   * Procesa un valor y detecta picos cardíacos con algoritmos avanzados
   * Modificado para ser más transparente y conservador en la manipulación
   */
  public processSignal(value: number): ProcessedHeartbeatSignal {
    const timestamp = Date.now();
    
    // Almacenar el valor original sin procesar
    this.rawValues.push(value);
    if (this.rawValues.length > 30) {
      this.rawValues.shift();
    }
    
    // Configurar valores por defecto de transparencia
    this.wasValueEnhanced = false;
    this.enhancementAmount = 0;
    
    // Apply adaptive prediction and control if enabled - ahora más conservador
    let enhancedValue = value;
    let predictionQuality = 0;
    
    if (this.useAdaptiveControl) {
      const prediction = this.adaptivePredictor.processValue(value);
      predictionQuality = prediction.signalQuality;
      
      // Usar valor filtrado del predictor solo si la calidad es suficiente
      // y limitado por el factor de mejora para reducir la manipulación
      if (predictionQuality > this.correctionThreshold) {
        // Calcular la diferencia entre el valor original y el predicho
        const difference = prediction.filteredValue - value;
        
        // Aplicar solo un porcentaje de la corrección basado en la configuración
        const limitedDifference = difference * this.signalEnhancementAmount;
        
        // Aplicar la corrección limitada
        enhancedValue = value + limitedDifference;
        
        // Registrar la mejora para transparencia
        this.wasValueEnhanced = true;
        this.enhancementAmount = Math.abs(limitedDifference / (Math.abs(value) + 0.001));
        
        // Registrar para auditoría
        this.dataManipulationLog.push({
          timestamp,
          originalValue: value,
          enhancedValue,
          enhancementType: 'adaptive_prediction',
          enhancementAmount: this.enhancementAmount
        });
        
        // Limitar el tamaño del log
        if (this.dataManipulationLog.length > 100) {
          this.dataManipulationLog.shift();
        }
      }
    }
    
    // Almacenar valor final en buffer
    this.values.push(enhancedValue);
    if (this.values.length > 30) {
      this.values.shift();
    }
    
    // Comprobar si es un posible pico
    let isPeak = false;
    let peakConfidence = 0;
    let instantaneousBPM: number | null = null;
    let rrInterval: number | null = null;
    
    // Verificar condiciones para detección de pico
    if (this.isPotentialPeak(enhancedValue, timestamp)) {
      // Verificar si es un pico válido con análisis de forma de onda
      const { isValidPeak, confidence } = this.validatePeak(enhancedValue);
      
      if (isValidPeak) {
        isPeak = true;
        peakConfidence = confidence;
        
        // Calcular intervalo RR si hay un pico anterior
        if (this.lastPeakTime !== null) {
          rrInterval = timestamp - this.lastPeakTime;
          
          // Calcular BPM instantáneo a partir del intervalo RR
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            
            // Solo almacenar intervalos RR de calidad suficiente
            if (peakConfidence > 0.6) { // Umbral más alto para reducir falsos positivos
              this.rrIntervals.push(rrInterval);
              if (this.rrIntervals.length > 10) {
                this.rrIntervals.shift();
              }
            }
          }
        }
        
        // Actualizar referencias del pico
        this.lastPeakTime = timestamp;
        this.lastPeakValue = enhancedValue;
        this.peakTimes.push(timestamp);
        
        // Limitar el historial de tiempos de picos
        if (this.peakTimes.length > 10) {
          this.peakTimes.shift();
        }
        
        // Adaptar el umbral basado en el historial de picos
        if (this.adaptiveToPeakHistory && this.values.length > 10) {
          this.adaptThreshold();
        }
      }
    }
    
    // Calcular variabilidad del ritmo cardíaco solo con datos de calidad
    const heartRateVariability = this.calculateHRV();
    
    // Enhance confidence with prediction quality if enabled - más conservador
    if (this.qualityEnhancedByPrediction && this.useAdaptiveControl && predictionQuality > 50) {
      // Usar un peso menor para la calidad de predicción
      peakConfidence = 0.85 * peakConfidence + 0.15 * (predictionQuality / 100);
    }
    
    return {
      timestamp,
      value: enhancedValue,
      rawValue: value, // Incluir el valor original para transparencia
      isPeak,
      peakConfidence,
      instantaneousBPM,
      rrInterval,
      heartRateVariability,
      // Añadir información de transparencia
      enhancementMetadata: {
        wasEnhanced: this.wasValueEnhanced,
        enhancementAmount: this.enhancementAmount,
        predictionQuality: predictionQuality / 100,
        adaptiveControlEnabled: this.useAdaptiveControl
      }
    };
  }
  
  /**
   * Verifica si un valor cumple las condiciones básicas para ser un pico
   */
  private isPotentialPeak(value: number, timestamp: number): boolean {
    // Aplicar umbral y distancia mínima entre picos
    const timeSinceLastPeak = this.lastPeakTime ? timestamp - this.lastPeakTime : Number.MAX_VALUE;
    
    if (value < this.peakThreshold || timeSinceLastPeak < this.minPeakDistance) {
      return false;
    }
    
    // Verificar si es un máximo local (mayor que valores anteriores y posteriores)
    if (this.values.length < 3) return false;
    
    const recent = this.values.slice(-3);
    return recent[1] > recent[0] && recent[1] >= value;
  }
  
  /**
   * Valida un pico usando análisis de forma de onda
   * Criterios más estrictos para reducir falsos positivos
   */
  private validatePeak(value: number): { isValidPeak: boolean, confidence: number } {
    if (this.values.length < 5) {
      return { isValidPeak: false, confidence: 0 };
    }
    
    // Comprobar la forma de onda alrededor del potencial pico
    const segment = this.values.slice(-5);
    
    // Verificar patrón ascendente-descendente típico de un latido cardíaco real
    // Criterios más estrictos para validación
    const hasCardiacPattern = 
      segment[0] < segment[1] && 
      segment[1] < segment[2] && 
      segment[2] > segment[3] && 
      segment[3] > segment[4];
    
    if (!hasCardiacPattern) {
      return { isValidPeak: false, confidence: 0 };
    }
    
    // Calcular la prominencia del pico (diferencia con valores circundantes)
    const prominence = Math.min(
      segment[2] - segment[0],
      segment[2] - segment[4]
    );
    
    // Normalizar la prominencia para obtener la confianza (0-1)
    const confidence = Math.min(1, prominence / (this.peakThreshold * 2));
    
    // Umbral más alto para reducir falsos positivos
    const confidenceThreshold = 0.6; // Aumentado de 0.5
    
    return { 
      isValidPeak: confidence > confidenceThreshold,
      confidence 
    };
  }
  
  /**
   * Adapta el umbral de detección basado en el historial de picos
   */
  private adaptThreshold(): void {
    if (this.values.length < 10) return;
    
    // Calcular la media y desviación estándar de los valores recientes
    const recent = this.values.slice(-20);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    let variance = 0;
    for (const val of recent) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= recent.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Ajustar umbral basado en la distribución de la señal
    // Adaptación más gradual
    const targetThreshold = mean + (stdDev * this.dynamicThresholdFactor);
    
    // Adaptar más lentamente (20% en lugar de reemplazo completo)
    this.peakThreshold = 0.8 * this.peakThreshold + 0.2 * targetThreshold;
    
    // Limitar a valores razonables
    this.peakThreshold = Math.max(0.1, Math.min(0.8, this.peakThreshold));
  }
  
  /**
   * Calcula la variabilidad del ritmo cardíaco (HRV)
   * Solo usa intervalos RR de alta calidad
   */
  private calculateHRV(): number | null {
    // Se requieren más intervalos para un cálculo confiable
    if (this.rrIntervals.length < 4) return null;
    
    // Filtrar valores extremos (eliminar el 10% superior e inferior)
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    const filteredIntervals = sortedIntervals.slice(
      Math.floor(sortedIntervals.length * 0.1),
      Math.ceil(sortedIntervals.length * 0.9)
    );
    
    // Si quedan muy pocos después del filtrado, no calcular
    if (filteredIntervals.length < 3) return null;
    
    // Método RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < filteredIntervals.length; i++) {
      const diff = filteredIntervals[i] - filteredIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (filteredIntervals.length - 1));
  }
  
  /**
   * Configura el procesador con opciones personalizadas
   */
  public configure(options: SignalProcessingOptions): void {
    if (options.amplificationFactor !== undefined) {
      // Limitar el factor de amplificación a valores más conservadores
      this.dynamicThresholdFactor = Math.max(0.3, Math.min(0.7, options.amplificationFactor / 2));
    }
    
    if (options.filterStrength !== undefined) {
      // Ajustar la distancia mínima entre picos según la fuerza de filtrado
      this.minPeakDistance = 250 + (options.filterStrength * 75); // Reducido el factor de 100 a 75
    }
    
    // Configure adaptive control options
    if (options.useAdaptiveControl !== undefined) {
      this.useAdaptiveControl = options.useAdaptiveControl;
    }
    
    if (options.qualityEnhancedByPrediction !== undefined) {
      this.qualityEnhancedByPrediction = options.qualityEnhancedByPrediction;
    }
    
    // Nuevas opciones para control más fino
    if (options.predictionWeight !== undefined) {
      this.predictionWeight = Math.max(0.1, Math.min(0.5, options.predictionWeight));
    }
    
    if (options.correctionThreshold !== undefined) {
      this.correctionThreshold = Math.max(0.5, Math.min(0.9, options.correctionThreshold));
    }
    
    if (options.signalEnhancementAmount !== undefined) {
      this.signalEnhancementAmount = Math.max(0.2, Math.min(0.8, options.signalEnhancementAmount));
    }
  }
  
  /**
   * Reinicia el procesador y todos sus buffers
   */
  public reset(): void {
    this.values = [];
    this.rawValues = [];
    this.peakTimes = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.lastPeakValue = 0;
    this.peakThreshold = 0.2;
    this.dataManipulationLog = [];
    this.wasValueEnhanced = false;
    this.enhancementAmount = 0;
    
    // Reset adaptive predictor
    this.adaptivePredictor.reset();
  }
  
  /**
   * Get the state of the adaptive predictor for debugging
   */
  public getAdaptivePredictorState(): any {
    return this.adaptivePredictor.getState();
  }
  
  /**
   * Get manipulation statistics for transparency
   */
  public getManipulationStats(): {
    enhancedValuesCount: number,
    averageEnhancementAmount: number,
    manipulationLog: Array<{timestamp: number, originalValue: number, enhancedValue: number, enhancementType: string, enhancementAmount: number}>
  } {
    const enhancedValues = this.dataManipulationLog.filter(entry => entry.enhancementAmount > 0);
    const avgAmount = enhancedValues.length > 0 
      ? enhancedValues.reduce((sum, entry) => sum + entry.enhancementAmount, 0) / enhancedValues.length 
      : 0;
    
    return {
      enhancedValuesCount: enhancedValues.length,
      averageEnhancementAmount: avgAmount,
      manipulationLog: this.dataManipulationLog.slice(-20) // Últimas 20 entradas
    };
  }
  
  /**
   * Get access to raw values buffer for transparency
   */
  public getRawValues(): number[] {
    return [...this.rawValues];
  }
}

/**
 * Crea una nueva instancia del procesador de señal cardíaca
 */
export function createHeartbeatProcessor(): HeartbeatProcessor {
  return new HeartbeatProcessor();
}
