
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculadora de confianza para mediciones fisiológicas
 * Utiliza solo mediciones directas sin simulación o manipulación
 */
export class ConfidenceCalculator {
  private readonly confidenceThreshold: number;
  private adaptiveThreshold: number;
  private confidenceHistory: number[] = [];
  
  constructor(initialThreshold: number = 0.5) {
    this.confidenceThreshold = initialThreshold;
    this.adaptiveThreshold = initialThreshold;
    console.log("ConfidenceCalculator: Iniciado con umbral", initialThreshold);
  }
  
  /**
   * Calcula la confianza general basada en múltiples métricas
   * de confianza específicas y calidad de optimización
   */
  public calculateOverallConfidence(
    glucoseConfidence: number,
    lipidsConfidence: number,
    optimizationQuality?: number
  ): number {
    // Pesos para diferentes componentes
    const weights = {
      glucose: 0.3,
      lipids: 0.3,
      optimization: 0.4
    };
    
    // Si no hay calidad de optimización, redistribuir pesos
    let normalizedOptimizationQuality = 0;
    if (!optimizationQuality) {
      weights.glucose = 0.5;
      weights.lipids = 0.5;
      weights.optimization = 0;
    } else {
      // Normalizar calidad de optimización a escala 0-1
      normalizedOptimizationQuality = Math.min(1, optimizationQuality / 100);
    }
    
    // Calcular confianza ponderada
    const overallConfidence = 
      (glucoseConfidence * weights.glucose) +
      (lipidsConfidence * weights.lipids) +
      (normalizedOptimizationQuality * weights.optimization);
    
    // Ajustar umbral adaptativo basado en historial reciente
    this.updateAdaptiveThreshold(overallConfidence);
    
    // Registrar para fines de diagnóstico
    if (this.confidenceHistory.length % 10 === 0) {
      console.log("ConfidenceCalculator: Confianza calculada", {
        glucoseConfidence,
        lipidsConfidence,
        optimizationQuality,
        overall: overallConfidence,
        adaptiveThreshold: this.adaptiveThreshold
      });
    }
    
    return overallConfidence;
  }
  
  /**
   * Verifica si un valor de confianza cumple con el umbral requerido
   */
  public meetsThreshold(confidence: number): boolean {
    return confidence >= this.adaptiveThreshold;
  }
  
  /**
   * Obtiene el umbral de confianza actual
   */
  public getConfidenceThreshold(): number {
    return this.adaptiveThreshold;
  }
  
  /**
   * Actualiza el umbral adaptativo basado en historial de confianza
   */
  private updateAdaptiveThreshold(currentConfidence: number): void {
    // Añadir al historial
    this.confidenceHistory.push(currentConfidence);
    
    // Limitar tamaño del historial
    if (this.confidenceHistory.length > 20) {
      this.confidenceHistory.shift();
    }
    
    // Si tenemos suficientes datos, ajustar umbral
    if (this.confidenceHistory.length >= 10) {
      const recentAverage = this.confidenceHistory
        .slice(-10)
        .reduce((sum, conf) => sum + conf, 0) / 10;
      
      // Ajustar umbral: más estricto si confianza alta, más permisivo si baja
      if (recentAverage > this.adaptiveThreshold + 0.1) {
        // La confianza es consistentemente alta, podemos ser más exigentes
        this.adaptiveThreshold = Math.min(
          this.confidenceThreshold + 0.2, 
          this.adaptiveThreshold + 0.01
        );
      } else if (recentAverage < this.adaptiveThreshold - 0.1) {
        // La confianza es consistentemente baja, seamos más permisivos
        this.adaptiveThreshold = Math.max(
          this.confidenceThreshold - 0.1,
          this.adaptiveThreshold - 0.01
        );
      }
    }
  }
}
