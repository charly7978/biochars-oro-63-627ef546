
/**
 * Analyzes signal quality based on medical-grade standards
 */
export class SignalQualityAnalyzer {
  private readonly QUALITY_BUFFER_SIZE = 20;
  private qualityHistory: number[] = [];
  
  /**
   * Calculate signal quality based on various metrics
   * @param filteredValue - The filtered signal value
   * @param rawValue - The raw signal value
   * @returns Quality score from 0-100
   */
  public assessQuality(filteredValue: number, rawValue: number): number {
    // Si la señal es demasiado débil, devuelve calidad mínima
    if (Math.abs(filteredValue) < 0.02) { // Reducido el umbral de señal débil
      console.log("SignalQualityAnalyzer: Signal too weak", { filteredValue });
      return 10; // En lugar de 0, damos una calidad mínima para ayudar con la detección
    }
    
    // Añadir a historial de calidad
    this.qualityHistory.push(filteredValue);
    if (this.qualityHistory.length > this.QUALITY_BUFFER_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Necesitamos suficientes puntos de datos para un análisis significativo
    if (this.qualityHistory.length < 5) {
      console.log("SignalQualityAnalyzer: Initial data collection", { 
        historyLength: this.qualityHistory.length 
      });
      return 30; // Calidad mínima durante la recolección inicial de datos (aumentada)
    }
    
    // Calcular métricas - estabilidad, rango, ruido
    const recent = this.qualityHistory.slice(-5);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    
    // Calcular variaciones entre muestras consecutivas
    const variations: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      variations.push(Math.abs(recent[i] - recent[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    
    // Calcular calidad basada en propiedades de la señal
    const stabilityScore = Math.max(0, 100 - (avgVariation * 600)); // Menos sensible a la variación
    const rangeScore = range > 0.01 && range < 0.8 ? 100 : 50; // Rango más amplio aceptable
    
    // Puntaje combinado ponderado por importancia
    const qualityScore = (stabilityScore * 0.6) + (rangeScore * 0.4);
    
    // Reportar para debugging (ocasionalmente)
    if (Math.random() < 0.05) {
      console.log("SignalQualityAnalyzer: Quality assessment", {
        qualityScore,
        stabilityScore,
        rangeScore,
        avgVariation,
        range
      });
    }
    
    return Math.min(100, Math.max(0, qualityScore));
  }
  
  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.qualityHistory = [];
  }
}
