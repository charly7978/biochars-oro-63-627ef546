
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Clase especializada para detección de patrones de arritmia en señales PPG reales
 * Versión mejorada con mayor sensibilidad y robustez
 */
export class ArrhythmiaPatternDetector {
  // Buffer para análisis de patrones rítmicos
  private patternBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 24; // Aumentado para mejor análisis
  
  // Umbrales más sensibles para detección de arritmias
  private readonly PATTERN_THRESHOLD = 0.12; // Reducido para máxima sensibilidad
  private readonly MIN_PATTERN_COUNT = 1; // Reducido para detectar incluso una sola arritmia
  
  // Nuevos parámetros para análisis avanzado
  private readonly HIGH_VARIANCE_THRESHOLD = 0.12; // Umbral de varianza alta (reducido)
  private readonly SEQUENTIAL_ANOMALY_THRESHOLD = 0.18; // Umbral para anomalías secuenciales (reducido)
  private readonly MIN_BUFFER_FOR_DETECTION = 5; // Mínimo de muestras para detección (reducido)
  
  /**
   * Actualiza el buffer de patrones con nuevos valores
   * @param value Valor normalizado de variación RR (0-1)
   */
  public updatePatternBuffer(value: number): void {
    this.patternBuffer.push(value);
    
    // Mantener tamaño máximo
    if (this.patternBuffer.length > this.MAX_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Log values for debugging
    console.log("ArrhythmiaPatternDetector: Updated pattern buffer", {
      newValue: value,
      bufferSize: this.patternBuffer.length,
      recentValues: this.patternBuffer.slice(-5)
    });
  }
  
  /**
   * Detecta patrones característicos de arritmias con análisis multifactorial mejorado
   * Implementa métodos avanzados para detección de patrones irregulares
   * @returns true si se detecta un patrón de arritmia
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_BUFFER_FOR_DETECTION) {
      return false;
    }
    
    // 1. Análisis de frecuencia de anomalías
    let abnormalCount = 0;
    for (const value of this.patternBuffer) {
      if (value > this.PATTERN_THRESHOLD) {
        abnormalCount++;
      }
    }
    
    // Calcular ratio de anomalías
    const abnormalRatio = abnormalCount / this.patternBuffer.length;
    
    // 2. Análisis de varianza - detectar inestabilidad global
    const mean = this.patternBuffer.reduce((sum, val) => sum + val, 0) / this.patternBuffer.length;
    const variance = this.patternBuffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.patternBuffer.length;
    
    // 3. Análisis de anomalías secuenciales
    let sequentialAnomalies = 0;
    for (let i = 1; i < this.patternBuffer.length; i++) {
      if (this.patternBuffer[i] > this.SEQUENTIAL_ANOMALY_THRESHOLD &&
          this.patternBuffer[i-1] > this.SEQUENTIAL_ANOMALY_THRESHOLD) {
        sequentialAnomalies++;
      }
    }
    
    // 4. Análisis de patrones alternantes (latidos prematuros intercalados)
    let alternatingPattern = 0;
    for (let i = 1; i < this.patternBuffer.length - 1; i++) {
      if ((this.patternBuffer[i] > this.PATTERN_THRESHOLD && 
           this.patternBuffer[i-1] < this.PATTERN_THRESHOLD && 
           this.patternBuffer[i+1] < this.PATTERN_THRESHOLD) ||
          (this.patternBuffer[i] < this.PATTERN_THRESHOLD && 
           this.patternBuffer[i-1] > this.PATTERN_THRESHOLD && 
           this.patternBuffer[i+1] > this.PATTERN_THRESHOLD)) {
        alternatingPattern++;
      }
    }
    
    // 5. Decisión multi-criterio con umbrales más sensibles
    const isAbnormal = 
      abnormalRatio > 0.12 || // Frecuencia de anomalías (reducido aún más)
      variance > this.HIGH_VARIANCE_THRESHOLD || // Variabilidad excesiva
      sequentialAnomalies >= 1 || // Anomalías en secuencia (reducido)
      alternatingPattern >= 1; // Patrón alternante significativo (reducido)
    
    console.log("ArrhythmiaPatternDetector: Pattern analysis resultado", {
      abnormalCount,
      abnormalRatio,
      variance,
      sequentialAnomalies,
      alternatingPattern,
      isAbnormal,
      bufferSize: this.patternBuffer.length
    });
    
    return isAbnormal;
  }
  
  /**
   * Reinicia el buffer de patrones
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    console.log("ArrhythmiaPatternDetector: Pattern buffer reset");
  }
}
