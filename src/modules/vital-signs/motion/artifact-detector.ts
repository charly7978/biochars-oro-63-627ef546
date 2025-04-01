
import { MovementDetector } from './movement-detector';
import { SignalMathUtils } from './signal-math-utils';
import { AccelerometerData } from './types';

/**
 * Detector de artefactos de señal basado en análisis estadístico
 */
export class ArtifactDetector {
  private readonly detector: MovementDetector;
  private valueBuffer: number[] = [];
  private accelData: AccelerometerData[] = [];
  private lastArtifactTime: number = 0;
  private baselineValue: number | null = null;
  private adaptiveThresholdValue: number = 3.5;
  private readonly maxBufferSize: number;
  
  constructor(threshold: number, maxBufferSize: number = 10) {
    this.detector = new MovementDetector();
    this.adaptiveThresholdValue = threshold;
    this.maxBufferSize = maxBufferSize;
  }
  
  /**
   * Actualiza los datos del acelerómetro para detección de movimiento
   */
  public updateAccelerometerData(data: AccelerometerData): boolean {
    this.accelData.push(data);
    if (this.accelData.length > 20) {
      this.accelData.shift();
    }
    
    // Enviar datos al detector de movimiento
    return this.detector.processAccelerometerData(data);
  }
  
  /**
   * Actualiza el buffer de valores
   */
  public updateValueBuffer(value: number): void {
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this.maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Inicializar línea base si es necesario
    if (this.baselineValue === null && this.valueBuffer.length >= 3) {
      this.baselineValue = SignalMathUtils.calculateMedian(this.valueBuffer);
    }
  }
  
  /**
   * Actualiza el umbral adaptativo basado en la variabilidad de la señal
   */
  public updateAdaptiveThreshold(baseThreshold: number): void {
    if (this.valueBuffer.length < 5) return;
    
    const mean = SignalMathUtils.calculateMean(this.valueBuffer);
    const stdDev = SignalMathUtils.calculateStdDev(this.valueBuffer, mean);
    
    // Ajustar umbral basado en la variabilidad observada
    // Señales más variables necesitan umbrales más altos
    const variabilityFactor = Math.min(Math.max(stdDev / mean, 0.5), 2.0);
    const newThreshold = baseThreshold * variabilityFactor;
    
    // Actualización suave del umbral
    this.adaptiveThresholdValue = this.adaptiveThresholdValue * 0.9 + newThreshold * 0.1;
    
    // Garantizar límites razonables
    this.adaptiveThresholdValue = Math.max(Math.min(this.adaptiveThresholdValue, 5.0), 2.0);
  }
  
  /**
   * Detecta si un valor es un artefacto basado en múltiples criterios
   */
  public detectArtifact(value: number, timestamp: number): boolean {
    // Comprobaciones de seguridad
    if (this.baselineValue === null || this.valueBuffer.length < 3) {
      return false;
    }
    
    // Calcular estadísticas del buffer
    const mean = SignalMathUtils.calculateMean(this.valueBuffer);
    const stdDev = SignalMathUtils.calculateStdDev(this.valueBuffer, mean);
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
    const isArtifact = (isOutlier && isRapidChange) || 
           (hasSignificantMovement && (isOutlier || isRapidChange)) ||
           (recentArtifact && isOutlier);
    
    if (isArtifact) {
      this.lastArtifactTime = timestamp;
    }
    
    return isArtifact;
  }
  
  /**
   * Corrige un valor identificado como artefacto
   */
  public correctArtifact(value: number): number {
    if (this.baselineValue === null) {
      return value;
    }
    
    // Usar técnicas de corrección, preferiblemente mediana de valores recientes
    if (this.valueBuffer.length >= 3) {
      const recentValues = this.valueBuffer.slice(-3);
      return SignalMathUtils.calculateMedian(recentValues);
    }
    
    // Si no hay suficientes valores, usar la línea base
    return this.baselineValue;
  }
  
  /**
   * Actualiza la línea base con el nuevo valor
   */
  public updateBaseline(value: number): void {
    if (this.baselineValue !== null) {
      this.baselineValue = this.baselineValue * 0.95 + value * 0.05;
    }
  }
  
  /**
   * Obtiene el valor actual del umbral adaptativo
   */
  public getAdaptiveThresholdValue(): number {
    return this.adaptiveThresholdValue;
  }
  
  /**
   * Establece el valor del umbral adaptativo
   */
  public setAdaptiveThresholdValue(value: number): void {
    this.adaptiveThresholdValue = value;
  }
  
  /**
   * Obtiene el buffer de valores actual
   */
  public getValueBuffer(): number[] {
    return [...this.valueBuffer];
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.valueBuffer = [];
    this.baselineValue = null;
    this.accelData = [];
    this.lastArtifactTime = 0;
    this.detector.reset();
  }
}
