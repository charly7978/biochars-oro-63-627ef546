
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculator for confidence levels of measurements
 * Works with real data only, no simulation
 */
export class ConfidenceCalculator {
  private readonly MIN_CONFIDENCE_THRESHOLD: number;
  
  /**
   * Create a new confidence calculator
   */
  constructor(minConfidenceThreshold: number = 0.15) {
    this.MIN_CONFIDENCE_THRESHOLD = minConfidenceThreshold;
  }
  
  /**
   * Calculate overall confidence from individual metrics
   */
  public calculateOverallConfidence(glucoseConfidence: number, lipidsConfidence: number): number {
    return (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);
  }
  
  /**
   * Check if confidence meets the threshold
   */
  public meetsThreshold(confidence: number): boolean {
    return confidence > this.MIN_CONFIDENCE_THRESHOLD;
  }
  
  /**
   * Get current confidence threshold
   */
  public getConfidenceThreshold(): number {
    return this.MIN_CONFIDENCE_THRESHOLD;
  }
}

