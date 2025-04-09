
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Optimizador con feedback bidireccional para mejorar la precisión de las mediciones
 * Solo utiliza datos reales sin simulación o manipulación artificial
 */
export class FeedbackOptimizer {
  // Historial de calidad de señal para adaptación de algoritmos
  private qualityHistory: number[] = [];
  // Historial de feedback de mediciones para ajuste bidireccional
  private feedbackHistory: FeedbackData[] = [];
  // Pesos adaptativos para diferentes canales de señal
  private channelWeights = {
    filtered: 0.6,
    raw: 0.4
  };
  // Contador de ciclos de optimización
  private optimizationCycles: number = 0;
  // Umbral de calidad para aceptar mediciones
  private qualityThreshold: number = 30;
  
  constructor() {
    console.log("FeedbackOptimizer: Inicializado para procesamiento adaptativo bidireccional");
  }
  
  /**
   * Optimiza la señal PPG utilizando técnicas adaptativas
   * basadas en calidad de señal y rendimiento histórico
   */
  public optimize(
    filteredValues: number[], 
    rawValues: number[], 
    signalQuality: number
  ): OptimizationResult {
    this.optimizationCycles++;
    this.qualityHistory.push(signalQuality);
    
    // Mantener historial de calidad limitado
    if (this.qualityHistory.length > 20) {
      this.qualityHistory.shift();
    }
    
    // Ajustar pesos de canales basados en calidad histórica
    this.adjustChannelWeights();
    
    // Obtener las partes más recientes y relevantes de las señales
    const recentFilteredValues = filteredValues.slice(-30);
    const recentRawValues = rawValues.slice(-30);
    
    // Aplicar optimización adaptativa basada en pesos de canales
    const optimizedValues: number[] = [];
    const minLength = Math.min(recentFilteredValues.length, recentRawValues.length);
    
    for (let i = 0; i < minLength; i++) {
      const optimizedValue = (recentFilteredValues[i] * this.channelWeights.filtered) + 
                             (recentRawValues[i] * this.channelWeights.raw);
      optimizedValues.push(optimizedValue);
    }
    
    // Calcular calidad de la optimización
    const avgQuality = this.calculateAverageQuality();
    const trendFactor = this.calculateQualityTrend();
    const optimizationQuality = Math.min(100, avgQuality * (1 + trendFactor));
    
    // Log de optimización cada 10 ciclos
    if (this.optimizationCycles % 10 === 0) {
      console.log("FeedbackOptimizer: Optimización completada", {
        ciclo: this.optimizationCycles,
        calidadSeñal: signalQuality,
        calidadPromedio: avgQuality,
        calidadOptimización: optimizationQuality,
        tendenciaCalidad: trendFactor,
        pesosCanales: this.channelWeights
      });
    }
    
    return {
      optimizedValues,
      channelWeights: { ...this.channelWeights },
      optimizationQuality,
      signalQuality
    };
  }
  
  /**
   * Proporciona feedback de mediciones para ajustar algoritmos
   * de forma bidireccional
   */
  public provideFeedback(feedback: FeedbackData): void {
    this.feedbackHistory.push(feedback);
    
    // Mantener historial de feedback limitado
    if (this.feedbackHistory.length > 15) {
      this.feedbackHistory.shift();
    }
    
    // Adaptar umbral de calidad basado en consistencia de mediciones
    this.adaptQualityThreshold(feedback);
    
    // Log de feedback recibido
    console.log("FeedbackOptimizer: Feedback recibido", {
      spo2Consistency: feedback.spo2.consistency,
      bpConsistency: feedback.bloodPressure.consistency,
      signalQuality: feedback.signalQuality,
      nuevoUmbralCalidad: this.qualityThreshold
    });
  }
  
  /**
   * Adapta el umbral de calidad basado en la consistencia de mediciones
   */
  private adaptQualityThreshold(feedback: FeedbackData): void {
    // Si las mediciones son consistentes, podemos ser más exigentes
    if (feedback.spo2.consistency === 'high' && feedback.bloodPressure.consistency === 'high') {
      this.qualityThreshold = Math.min(60, this.qualityThreshold + 1);
    } 
    // Si las mediciones son inconsistentes, bajamos el umbral para mayor sensibilidad
    else if (feedback.spo2.consistency === 'low' || feedback.bloodPressure.consistency === 'low') {
      this.qualityThreshold = Math.max(20, this.qualityThreshold - 1);
    }
  }
  
  /**
   * Ajusta los pesos de los canales basados en calidad histórica
   */
  private adjustChannelWeights(): void {
    // Si tenemos suficiente historial
    if (this.qualityHistory.length > 5 && this.feedbackHistory.length > 3) {
      const recentQuality = this.qualityHistory.slice(-5);
      const recentFeedback = this.feedbackHistory.slice(-3);
      
      // Verificar si las mediciones recientes tienen alta consistencia
      const consistencyCount = recentFeedback.filter(
        f => f.spo2.consistency === 'high' || f.bloodPressure.consistency === 'high'
      ).length;
      
      // Calculamos la calidad media reciente
      const avgRecentQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
      
      // Ajustar pesos basados en tendencias de calidad y consistencia
      if (avgRecentQuality > 50 && consistencyCount >= 2) {
        // Con buena calidad y alta consistencia, favorecemos señal filtrada
        this.channelWeights.filtered = Math.min(0.8, this.channelWeights.filtered + 0.01);
        this.channelWeights.raw = 1 - this.channelWeights.filtered;
      } else if (avgRecentQuality < 40 || consistencyCount === 0) {
        // Con calidad pobre o baja consistencia, aumentamos el peso de datos crudos
        this.channelWeights.raw = Math.min(0.6, this.channelWeights.raw + 0.01);
        this.channelWeights.filtered = 1 - this.channelWeights.raw;
      }
    }
  }
  
  /**
   * Calcula la calidad promedio basada en historial
   */
  private calculateAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 50;
    return this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length;
  }
  
  /**
   * Calcula la tendencia de calidad (mejorando o empeorando)
   */
  private calculateQualityTrend(): number {
    if (this.qualityHistory.length < 10) return 0;
    
    const olderHalf = this.qualityHistory.slice(0, 5);
    const newerHalf = this.qualityHistory.slice(-5);
    
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const newerAvg = newerHalf.reduce((a, b) => a + b, 0) / newerHalf.length;
    
    // Devuelve un valor entre -0.2 y 0.2 indicando tendencia
    return Math.max(-0.2, Math.min(0.2, (newerAvg - olderAvg) / 100));
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.qualityHistory = [];
    this.feedbackHistory = [];
    this.channelWeights = {
      filtered: 0.6,
      raw: 0.4
    };
    this.optimizationCycles = 0;
    this.qualityThreshold = 30;
    console.log("FeedbackOptimizer: Reiniciado completamente");
  }
}

/**
 * Interfaz para datos de feedback
 */
export interface FeedbackData {
  spo2: {
    value: number;
    consistency: 'low' | 'medium' | 'high';
  };
  bloodPressure: {
    value: { systolic: number; diastolic: number };
    consistency: 'low' | 'medium' | 'high';
  };
  signalQuality: number;
  timestamp: number;
}

/**
 * Interfaz para resultados de optimización
 */
export interface OptimizationResult {
  optimizedValues: number[];
  channelWeights: {
    filtered: number;
    raw: number;
  };
  optimizationQuality: number;
  signalQuality: number;
}
