
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Sistema avanzado de cálculo de confianza con métodos adaptativos
 * Implementa un enfoque completamente nuevo para análisis de datos reales
 */
export class ConfidenceCalculator {
  private readonly confidenceThreshold: number;
  private adaptiveThreshold: number;
  private confidenceHistory: number[] = [];
  private variationHistory: number[] = [];
  private signalQualityWeights = {
    amplitude: 0.4,
    stability: 0.3,
    consistency: 0.3
  };
  
  constructor(initialThreshold: number = 0.5) {
    this.confidenceThreshold = initialThreshold;
    this.adaptiveThreshold = initialThreshold;
    console.log("ConfidenceCalculator: Instancia renovada con umbral", initialThreshold);
  }
  
  /**
   * Algoritmo completamente renovado para cálculo de confianza
   * Usa un enfoque multimétrico con ponderación dinámica
   */
  public calculateOverallConfidence(
    glucoseConfidence: number,
    lipidsConfidence: number,
    optimizationQuality?: number,
    signalAmplitude?: number
  ): number {
    // Nuevos pesos adaptativos basados en historial
    const weights = this.calculateAdaptiveWeights(
      glucoseConfidence, 
      lipidsConfidence, 
      optimizationQuality
    );
    
    // Calcular valor base con sistema de ponderación renovado
    let overallConfidence = 
      (glucoseConfidence * weights.glucose) +
      (lipidsConfidence * weights.lipids);
    
    // Integrar calidad de optimización de manera adaptativa
    if (typeof optimizationQuality === 'number') {
      // Normalización mejorada con escala no lineal
      const normalizedOptimizationQuality = this.normalizeOptimizationQuality(optimizationQuality);
      overallConfidence = (overallConfidence * (1 - weights.optimization)) + 
                          (normalizedOptimizationQuality * weights.optimization);
    }
    
    // Considerar amplitud de señal si está disponible
    if (typeof signalAmplitude === 'number') {
      const amplitudeConfidence = this.calculateAmplitudeConfidence(signalAmplitude);
      overallConfidence = (overallConfidence * 0.85) + (amplitudeConfidence * 0.15);
    }
    
    // Suavizado temporal con varianza limitada para estabilidad
    overallConfidence = this.applyTemporalSmoothing(overallConfidence);
    
    // Ajustar umbral adaptativo con nuevo algoritmo de pronóstico
    this.updateAdaptiveThreshold(overallConfidence);
    
    // Registro con periodicidad adaptativa
    if (this.confidenceHistory.length % 10 === 0) {
      console.log("ConfidenceCalculator: Nuevo algoritmo aplicado", {
        glucoseConfidence,
        lipidsConfidence,
        optimizationQuality,
        signalAmplitude,
        weights,
        overall: overallConfidence,
        adaptiveThreshold: this.adaptiveThreshold
      });
    }
    
    return overallConfidence;
  }
  
  /**
   * Método renovado para validación de umbral de confianza
   */
  public meetsThreshold(confidence: number): boolean {
    // Algoritmo mejorado con validación secundaria de variabilidad
    const meetsAdaptiveThreshold = confidence >= this.adaptiveThreshold;
    
    // Si la confianza está cerca del umbral, considerar tendencia
    if (Math.abs(confidence - this.adaptiveThreshold) < 0.08) {
      const trend = this.calculateConfidenceTrend();
      if (trend > 0.05 && confidence >= this.adaptiveThreshold * 0.95) {
        return true;
      }
    }
    
    return meetsAdaptiveThreshold;
  }
  
  /**
   * Obtiene el umbral de confianza actual
   */
  public getConfidenceThreshold(): number {
    return this.adaptiveThreshold;
  }
  
  /**
   * Nuevo método para normalización no lineal de calidad de optimización
   * @private
   */
  private normalizeOptimizationQuality(quality: number): number {
    // Curva sigmoidal para enfatizar valores medios y atenuar extremos
    const normalized = 1 / (1 + Math.exp(-0.05 * (quality - 50)));
    return Math.min(1, normalized * 1.05);
  }
  
  /**
   * Nuevo método para calcular pesos adaptativos basados en historial
   * @private
   */
  private calculateAdaptiveWeights(
    glucoseConfidence: number,
    lipidsConfidence: number,
    optimizationQuality?: number
  ): { glucose: number, lipids: number, optimization: number } {
    // Análisis de consistencia histórica
    const glucoseConsistency = this.calculateMetricConsistency('glucose');
    const lipidsConsistency = this.calculateMetricConsistency('lipids');
    
    // Ajustar pesos según consistencia (favorece métricas más estables)
    let glucoseWeight = 0.3 + (glucoseConsistency * 0.1);
    let lipidsWeight = 0.3 + (lipidsConsistency * 0.1);
    
    // Ajuste de peso para optimización
    let optimizationWeight = 0.4;
    
    // Sin optimización, redistribuir pesos proporcionalmente
    if (typeof optimizationQuality !== 'number') {
      const totalWeight = glucoseWeight + lipidsWeight;
      glucoseWeight = glucoseWeight / totalWeight;
      lipidsWeight = lipidsWeight / totalWeight;
      optimizationWeight = 0;
    } else {
      // Normalizar para que sumen 1
      const totalWeight = glucoseWeight + lipidsWeight + optimizationWeight;
      glucoseWeight = glucoseWeight / totalWeight;
      lipidsWeight = lipidsWeight / totalWeight;
      optimizationWeight = optimizationWeight / totalWeight;
    }
    
    return {
      glucose: glucoseWeight,
      lipids: lipidsWeight,
      optimization: optimizationWeight
    };
  }
  
  /**
   * Nuevo método para análisis de consistencia de métricas
   * @private
   */
  private calculateMetricConsistency(metricType: 'glucose' | 'lipids'): number {
    if (this.confidenceHistory.length < 5) return 0.5;
    
    // Último tercio del historial para análisis de consistencia reciente
    const recentHistory = this.confidenceHistory.slice(-Math.min(5, Math.floor(this.confidenceHistory.length / 3)));
    
    // Calcular variación
    let variation = 0;
    for (let i = 1; i < recentHistory.length; i++) {
      variation += Math.abs(recentHistory[i] - recentHistory[i-1]);
    }
    variation /= (recentHistory.length - 1);
    
    // Inversamente proporcional a la variación (menor variación = mayor consistencia)
    return Math.max(0, Math.min(1, 1 - variation * 5));
  }
  
  /**
   * Nuevo método para calcular confianza basada en amplitud de señal
   * @private
   */
  private calculateAmplitudeConfidence(amplitude: number): number {
    // Umbral mínimo para señal utilizable
    const minAmplitude = 0.05;
    const optimalAmplitude = 0.3;
    
    if (amplitude < minAmplitude) {
      return 0;
    } else if (amplitude <= optimalAmplitude) {
      // Escala lineal hasta amplitud óptima
      return (amplitude - minAmplitude) / (optimalAmplitude - minAmplitude);
    } else {
      // Escala logarítmica para amplitudes altas (evitar saturación)
      return Math.min(1, 1 - (Math.log(amplitude/optimalAmplitude) * 0.2));
    }
  }
  
  /**
   * Método mejorado para suavizado temporal con validación de varianza
   * @private
   */
  private applyTemporalSmoothing(currentConfidence: number): number {
    // Agregar al historial
    this.confidenceHistory.push(currentConfidence);
    
    // Limitar tamaño del historial para rendimiento
    if (this.confidenceHistory.length > 30) {
      this.confidenceHistory.shift();
    }
    
    // Con suficiente historial, aplicar suavizado
    if (this.confidenceHistory.length >= 3) {
      // Calcular varianza reciente
      const recentValues = this.confidenceHistory.slice(-3);
      const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const variance = recentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentValues.length;
      
      // Registrar varianza para análisis de tendencias
      this.variationHistory.push(variance);
      if (this.variationHistory.length > 10) {
        this.variationHistory.shift();
      }
      
      // Aplicar suavizado inversamente proporcional a la varianza
      // Mayor varianza = menos suavizado para responder rápido a cambios
      const smoothingFactor = Math.min(0.7, Math.max(0.2, 1 - variance * 10));
      
      // Ponderar con valores anteriores
      let smoothedValue = currentConfidence;
      
      for (let i = 1; i <= Math.min(3, this.confidenceHistory.length - 1); i++) {
        const weight = smoothingFactor * Math.pow(0.6, i);
        smoothedValue = (smoothedValue * (1 - weight)) + 
                        (this.confidenceHistory[this.confidenceHistory.length - 1 - i] * weight);
      }
      
      return smoothedValue;
    }
    
    return currentConfidence;
  }
  
  /**
   * Calcula la tendencia reciente de confianza
   * @private
   */
  private calculateConfidenceTrend(): number {
    if (this.confidenceHistory.length < 5) return 0;
    
    const recentValues = this.confidenceHistory.slice(-5);
    let sumDiffs = 0;
    
    for (let i = 1; i < recentValues.length; i++) {
      sumDiffs += recentValues[i] - recentValues[i-1];
    }
    
    return sumDiffs / (recentValues.length - 1);
  }
  
  /**
   * Método totalmente rediseñado para umbral adaptativo
   * @private
   */
  private updateAdaptiveThreshold(currentConfidence: number): void {
    // Con suficiente historial, ajustar umbral con algoritmo predictivo
    if (this.confidenceHistory.length >= 15) {
      // Dividir historial en segmentos para análisis avanzado
      const olderSegment = this.confidenceHistory.slice(0, 5);
      const middleSegment = this.confidenceHistory.slice(5, 10);
      const recentSegment = this.confidenceHistory.slice(-5);
      
      // Analizar promedios por segmento
      const olderAvg = olderSegment.reduce((sum, conf) => sum + conf, 0) / olderSegment.length;
      const middleAvg = middleSegment.reduce((sum, conf) => sum + conf, 0) / middleSegment.length;
      const recentAvg = recentSegment.reduce((sum, conf) => sum + conf, 0) / recentSegment.length;
      
      // Análisis de tendencia ponderado (más peso a datos recientes)
      const shortTermTrend = recentAvg - middleAvg;
      const longTermTrend = middleAvg - olderAvg;
      
      // Calcular ajuste predictivo basado en tendencias
      let adjustment = 0;
      
      if (shortTermTrend > 0 && longTermTrend > 0) {
        // Tendencia consistentemente positiva: aumentar umbral gradualmente
        adjustment = Math.min(0.02, shortTermTrend * 0.15);
      } else if (shortTermTrend < 0 && longTermTrend < 0) {
        // Tendencia consistentemente negativa: disminuir umbral gradualmente
        adjustment = Math.max(-0.015, shortTermTrend * 0.1);
      } else if (Math.abs(shortTermTrend) > 0.1) {
        // Cambio brusco reciente: ajuste moderado en dirección del cambio
        adjustment = Math.sign(shortTermTrend) * 0.01;
      }
      
      // Aplicar ajuste con limitaciones para estabilidad
      const predictedThreshold = this.adaptiveThreshold + adjustment;
      
      // Limitar rango de umbral adaptativo
      this.adaptiveThreshold = Math.max(
        this.confidenceThreshold - 0.15,
        Math.min(this.confidenceThreshold + 0.25, predictedThreshold)
      );
    }
  }
}
