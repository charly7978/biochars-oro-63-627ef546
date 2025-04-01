
import { MovementDetector } from '../motion/movement-detector';

/**
 * Configuraciones para la gestión de artefactos de movimiento
 */
export interface MotionArtifactConfig {
  windowSize: number;
  threshold: number;
  recoveryTime: number;
  adaptiveThreshold: boolean;
}

/**
 * Resultado del análisis de artefactos
 */
export interface ArtifactAnalysisResult {
  isArtifact: boolean;
  confidenceReduction: number;
  correctedValue?: number;
  originalValue: number;
}

/**
 * Gestor avanzado de artefactos de movimiento
 * Implementa múltiples técnicas para detección y corrección
 */
export class MotionArtifactManager {
  private readonly detector: MovementDetector;
  private readonly config: MotionArtifactConfig;
  private valueBuffer: number[] = [];
  private readonly DEFAULT_CONFIG: MotionArtifactConfig = {
    windowSize: 10,
    threshold: 3.5,
    recoveryTime: 1500,
    adaptiveThreshold: true
  };
  private readonly SENSITIVITY = 0.75; // Variable sólo lectura para constantes
  private lastArtifactTime: number = 0;
  private baselineValue: number | null = null;
  private adaptiveThresholdValue: number = 3.5;
  private isInRecoveryPhase: boolean = false;
  private recoveryStartTime: number = 0;
  private recoveryBuffer: number[] = [];
  private accelData: {x: number, y: number, z: number}[] = [];
  
  /**
   * Constructor del gestor de artefactos
   * @param config Configuración opcional
   */
  constructor(config?: Partial<MotionArtifactConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    this.detector = new MovementDetector();
    this.adaptiveThresholdValue = this.config.threshold;
  }
  
  /**
   * Procesa un nuevo valor y detecta/corrige artefactos
   * @param value Valor de señal PPG
   * @param timestamp Marca de tiempo actual
   * @param accelData Datos opcionales del acelerómetro
   * @returns Resultado del análisis
   */
  public processValue(
    value: number, 
    timestamp: number, 
    accelData?: {x: number, y: number, z: number}
  ): ArtifactAnalysisResult {
    // Almacenar valor original para referencia
    const originalValue = value;
    
    // Actualizar datos de acelerómetro si están disponibles
    if (accelData) {
      this.updateAccelerometerData(accelData);
    }
    
    // Actualizar buffer de valores
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this.config.windowSize) {
      this.valueBuffer.shift();
    }
    
    // Inicializar línea base si es necesario
    if (this.baselineValue === null && this.valueBuffer.length >= 3) {
      this.baselineValue = this.calculateMedian(this.valueBuffer);
    }
    
    // Actualización adaptativa del umbral si está habilitado
    if (this.config.adaptiveThreshold && this.valueBuffer.length >= 5) {
      this.updateAdaptiveThreshold();
    }
    
    // Verificar si estamos en fase de recuperación
    if (this.isInRecoveryPhase) {
      if (timestamp - this.recoveryStartTime >= this.config.recoveryTime) {
        // Fin de la fase de recuperación
        this.isInRecoveryPhase = false;
        this.recoveryBuffer = [];
      } else {
        // Seguimos en recuperación, aplicar filtrado más agresivo
        return this.handleRecoveryPhase(value, timestamp);
      }
    }
    
    // Detección de artefactos
    const isArtifact = this.detectArtifact(value, timestamp);
    
    if (isArtifact) {
      // Iniciar fase de recuperación
      this.isInRecoveryPhase = true;
      this.recoveryStartTime = timestamp;
      this.lastArtifactTime = timestamp;
      
      // Corrección del artefacto
      const correctedValue = this.correctArtifact(value);
      
      return {
        isArtifact: true,
        confidenceReduction: 0.5, // Reducción significativa de confianza
        correctedValue,
        originalValue
      };
    }
    
    // Actualizar línea base gradualmente si no hay artefacto
    if (this.baselineValue !== null) {
      this.baselineValue = this.baselineValue * 0.95 + value * 0.05;
    }
    
    return {
      isArtifact: false,
      confidenceReduction: 0,
      originalValue
    };
  }
  
  /**
   * Actualiza los datos del acelerómetro para detección de movimiento
   */
  private updateAccelerometerData(data: {x: number, y: number, z: number}): void {
    this.accelData.push(data);
    if (this.accelData.length > 20) {
      this.accelData.shift();
    }
    
    // Enviar datos al detector de movimiento
    this.detector.processAccelerometerData(data);
  }
  
  /**
   * Detecta si un valor es un artefacto basado en múltiples criterios
   */
  private detectArtifact(value: number, timestamp: number): boolean {
    // Comprobaciones de seguridad
    if (this.baselineValue === null || this.valueBuffer.length < 3) {
      return false;
    }
    
    // Calcular estadísticas del buffer
    const mean = this.calculateMean(this.valueBuffer);
    const stdDev = this.calculateStdDev(this.valueBuffer, mean);
    const zScore = Math.abs((value - mean) / (stdDev || 1));
    
    // Detectar movimiento significativo con acelerómetro si disponible
    const hasSignificantMovement = this.accelData.length > 0 && 
                                  this.detector.hasSignificantMovement();
    
    // Calcular tasa de cambio (derivada)
    let rateOfChange = 0;
    if (this.valueBuffer.length >= 2) {
      const prevValue = this.valueBuffer[this.valueBuffer.length - 2];
      rateOfChange = Math.abs(value - prevValue);
    }
    
    // Combinar criterios para detección de artefactos
    const isOutlier = zScore > this.adaptiveThresholdValue;
    const isRapidChange = rateOfChange > this.adaptiveThresholdValue * 1.5;
    const recentArtifact = timestamp - this.lastArtifactTime < 500;
    
    // Decisión final basada en múltiples factores
    return (isOutlier && isRapidChange) || 
           (hasSignificantMovement && (isOutlier || isRapidChange)) ||
           (recentArtifact && isOutlier);
  }
  
  /**
   * Actualiza el umbral adaptativo basado en la variabilidad de la señal
   */
  private updateAdaptiveThreshold(): void {
    const mean = this.calculateMean(this.valueBuffer);
    const stdDev = this.calculateStdDev(this.valueBuffer, mean);
    
    // Ajustar umbral basado en la variabilidad observada
    // Señales más variables necesitan umbrales más altos
    const variabilityFactor = Math.min(Math.max(stdDev / mean, 0.5), 2.0);
    const newThreshold = this.config.threshold * variabilityFactor;
    
    // Actualización suave del umbral
    this.adaptiveThresholdValue = this.adaptiveThresholdValue * 0.9 + newThreshold * 0.1;
    
    // Garantizar límites razonables
    this.adaptiveThresholdValue = Math.max(Math.min(this.adaptiveThresholdValue, 5.0), 2.0);
  }
  
  /**
   * Gestiona el procesamiento durante la fase de recuperación
   */
  private handleRecoveryPhase(value: number, timestamp: number): ArtifactAnalysisResult {
    // Almacenar valor en buffer de recuperación
    this.recoveryBuffer.push(value);
    
    // Calcular valor corregido usando filtrado de mediana
    let correctedValue = value;
    if (this.recoveryBuffer.length >= 3) {
      correctedValue = this.calculateMedian(this.recoveryBuffer.slice(-3));
    }
    
    // Calcular reducción de confianza basada en tiempo transcurrido en recuperación
    const timeInRecovery = timestamp - this.recoveryStartTime;
    const confidenceReduction = 0.5 * (1 - Math.min(timeInRecovery / this.config.recoveryTime, 1));
    
    return {
      isArtifact: true,
      confidenceReduction,
      correctedValue,
      originalValue: value
    };
  }
  
  /**
   * Corrige un valor identificado como artefacto
   */
  private correctArtifact(value: number): number {
    if (this.baselineValue === null) {
      return value;
    }
    
    // Usar técnicas de corrección, preferiblemente mediana de valores recientes
    if (this.valueBuffer.length >= 3) {
      const recentValues = this.valueBuffer.slice(-3);
      return this.calculateMedian(recentValues);
    }
    
    // Si no hay suficientes valores, usar la línea base
    return this.baselineValue;
  }
  
  /**
   * Calcula la media de un array de valores
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calcula la desviación estándar
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Calcula la mediana de un array de valores
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  /**
   * Reinicia el gestor de artefactos
   */
  public reset(): void {
    this.valueBuffer = [];
    this.baselineValue = null;
    this.adaptiveThresholdValue = this.config.threshold;
    this.isInRecoveryPhase = false;
    this.recoveryBuffer = [];
    this.accelData = [];
    this.detector.reset();
  }
  
  /**
   * Configura la sensibilidad del detector
   * @param sensitivity Valor entre 0 y 1
   */
  public setSensitivity(sensitivity: number): void {
    // Usar variable local en lugar de la constante de solo lectura
    const boundedSensitivity = Math.max(0, Math.min(1, sensitivity));
    
    // Ajustar umbral basado en sensibilidad
    // Mayor sensibilidad = umbral más bajo
    const thresholdRange = [2.0, 5.0]; // [min, max]
    const newThreshold = thresholdRange[1] - (thresholdRange[1] - thresholdRange[0]) * boundedSensitivity;
    
    // Actualizar configuración
    this.config.threshold = newThreshold;
    this.adaptiveThresholdValue = newThreshold;
  }
}
