
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Clase especializada para detección de patrones de arritmia en señales PPG reales
 * No utiliza simulación ni datos de prueba
 */
export class ArrhythmiaPatternDetector {
  // Buffer para análisis de patrones rítmicos
  private patternBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 25;
  
  // Umbrales para detección de arritmias
  private readonly PATTERN_THRESHOLD = 0.4;
  private readonly MIN_PATTERN_COUNT = 3;
  
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
  }
  
  /**
   * Detecta patrones característicos de arritmias
   * Busca secuencias de variaciones rítmicas significativas
   * @returns true si se detecta un patrón de arritmia
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_PATTERN_COUNT) {
      return false;
    }
    
    // Contar eventos por encima del umbral
    let abnormalCount = 0;
    for (const value of this.patternBuffer) {
      if (value > this.PATTERN_THRESHOLD) {
        abnormalCount++;
      }
    }
    
    // Verificar presencia de suficientes anomalías
    const abnormalRatio = abnormalCount / this.patternBuffer.length;
    
    // Verificar si hay suficientes anomalías en el patrón
    const isAbnormal = abnormalRatio > 0.3;
    
    return isAbnormal;
  }
  
  /**
   * Reinicia el buffer de patrones
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
  }
}
