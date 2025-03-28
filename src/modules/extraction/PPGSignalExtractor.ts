
/**
 * Extractor de señal PPG
 * Se encarga de extraer la señal fotopletismográfica sin procesamiento complejo
 */

interface PPGExtractionResult {
  rawValue: number;
  timestamp: number;
  signalStrength: number;
  fingerDetected: boolean;
}

export class PPGSignalExtractor {
  private recentValues: number[] = [];
  private readonly maxRecentValues: number = 20;
  private minSignalThreshold: number = 0.05;
  private stableCountThreshold: number = 5;
  private stableCount: number = 0;
  private baselineMean: number = 0;
  private baselineStdDev: number = 0;
  
  /**
   * Extrae información básica de la señal PPG
   * Corresponde a la obtención de la señal sin procesamiento avanzado
   */
  public extract(value: number): PPGExtractionResult {
    const now = Date.now();
    
    // Almacenar valores recientes
    this.recentValues.push(value);
    if (this.recentValues.length > this.maxRecentValues) {
      this.recentValues.shift();
    }
    
    // Calculamos un valor básico de fuerza de señal
    const signalStrength = this.calculateSignalStrength(value);
    
    // Detección básica de dedo (sin algoritmos complejos)
    let fingerDetected = false;
    
    // Si hay suficientes valores recientes, verificar si la señal es estable
    if (this.recentValues.length >= 10) {
      // Calcular media de valores recientes
      const mean = this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
      
      // Calcular desviación estándar
      const variance = this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Señal debe tener cierta variación pero no demasiada para ser una señal PPG válida
      const isValidStdDev = stdDev > 0.01 && stdDev < 0.5;
      
      // La media debe estar por encima de un umbral mínimo
      const hasMinimumSignal = Math.abs(mean) > this.minSignalThreshold;
      
      // Si cumple criterios, incrementar contador de estabilidad
      if (isValidStdDev && hasMinimumSignal) {
        this.stableCount = Math.min(this.stableCountThreshold + 5, this.stableCount + 1);
      } else {
        this.stableCount = Math.max(0, this.stableCount - 1);
      }
      
      // Señal debe ser estable por un tiempo mínimo
      fingerDetected = this.stableCount >= this.stableCountThreshold;
      
      // Actualizar línea base si la señal es estable
      if (fingerDetected) {
        this.baselineMean = mean;
        this.baselineStdDev = stdDev;
      }
    }
    
    return {
      rawValue: value,
      timestamp: now,
      signalStrength,
      fingerDetected
    };
  }

  /**
   * Calcula la fuerza de la señal (0-100)
   */
  private calculateSignalStrength(value: number): number {
    // Si no hay suficientes datos, devolver un valor bajo
    if (this.recentValues.length < 10) {
      return Math.min(100, Math.max(0, Math.abs(value) * 200));
    }
    
    // Calcular media y desviación estándar recientes
    const mean = this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
    const variance = this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Señal fuerte debe tener:
    // 1. Desviación estándar en un rango apropiado (ni muy baja ni muy alta)
    // 2. Valor medio por encima de un umbral
    
    // Calcular calidad basada en desviación estándar (mejor entre 0.05 y 0.2)
    let stdDevQuality = 0;
    if (stdDev >= 0.01 && stdDev <= 0.5) {
      if (stdDev < 0.05) {
        stdDevQuality = (stdDev - 0.01) / 0.04 * 50; // 0-50
      } else if (stdDev <= 0.2) {
        stdDevQuality = 50 + (0.2 - stdDev) / 0.15 * 50; // 50-100
      } else {
        stdDevQuality = 50 * (0.5 - stdDev) / 0.3; // 50-0
      }
    }
    
    // Calcular calidad basada en valor medio
    const meanQuality = Math.min(100, Math.abs(mean) * 300);
    
    // Combinar ambas métricas
    const quality = stdDevQuality * 0.7 + meanQuality * 0.3;
    
    return Math.min(100, Math.max(0, quality));
  }

  /**
   * Reinicia el extractor
   */
  public reset(): void {
    this.recentValues = [];
    this.stableCount = 0;
    this.baselineMean = 0;
    this.baselineStdDev = 0;
  }

  /**
   * Configura parámetros del extractor
   */
  public configure(config: {
    minSignalThreshold?: number;
    stableCountThreshold?: number;
    maxRecentValues?: number;
  }): void {
    if (config.minSignalThreshold !== undefined) {
      this.minSignalThreshold = config.minSignalThreshold;
    }
    
    if (config.stableCountThreshold !== undefined) {
      this.stableCountThreshold = config.stableCountThreshold;
    }
    
    if (config.maxRecentValues !== undefined) {
      this.maxRecentValues = config.maxRecentValues;
    }
  }
}
