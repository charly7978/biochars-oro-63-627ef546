
/**
 * Procesador de Glucosa
 * Simula estimación de glucosa basada en señales vitales
 */
export class GlucoseProcessor {
  private readonly GLUCOSE_BASELINE = 85;
  private readonly MAX_ADJUSTMENT = 30;
  private lastEstimates: number[] = [];
  private readonly BUFFER_SIZE = 5;

  /**
   * Estimar glucosa a partir de signos vitales
   * Nota: Esta es una simulación - la glucosa real no puede medirse con precisión solo desde PPG
   */
  public estimateGlucose(spo2: number, heartRate: number, ppgValues: number[]): number {
    // Si no tenemos entradas válidas, devolver un valor base normal
    if (spo2 === 0 || heartRate === 0 || ppgValues.length < 30) {
      return this.GLUCOSE_BASELINE;
    }

    // Calcular características de la señal
    const max = Math.max(...ppgValues);
    const min = Math.min(...ppgValues);
    const amplitude = max - min;
    const mean = ppgValues.reduce((a, b) => a + b, 0) / ppgValues.length;
    
    // Calcular variación de la señal
    let squaredDiffs = 0;
    for (const val of ppgValues) {
      squaredDiffs += Math.pow(val - mean, 2);
    }
    const variance = squaredDiffs / ppgValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Simular variaciones de glucosa basadas en parámetros de entrada
    // Frecuencia cardíaca más alta tiende a correlacionarse con glucosa más alta
    const hrFactor = Math.max(-10, Math.min(10, (heartRate - 70) * 0.2));
    
    // SpO2 más bajo a menudo se correlaciona con problemas metabólicos
    const spo2Factor = Math.max(-5, Math.min(5, (98 - spo2) * 0.5));
    
    // La variabilidad de la señal puede indicar actividad metabólica
    const varFactor = Math.max(-5, Math.min(5, (stdDev - 0.1) * 40));
    
    // Calcular estimación cruda
    const rawEstimate = this.GLUCOSE_BASELINE + hrFactor + spo2Factor + varFactor;
    
    // Añadir aleatoriedad para simular variaciones naturales
    const noise = Math.random() * 4 - 2; // -2 a +2
    
    // Aplicar restricciones para mantener valores en rango realista
    const estimate = Math.max(70, Math.min(140, rawEstimate + noise));
    
    // Suavizar con estimaciones previas
    this.lastEstimates.push(estimate);
    if (this.lastEstimates.length > this.BUFFER_SIZE) {
      this.lastEstimates.shift();
    }
    
    // Promediar las estimaciones recientes
    const smoothedEstimate = this.lastEstimates.reduce((a, b) => a + b, 0) / this.lastEstimates.length;
    
    return Math.round(smoothedEstimate);
  }
  
  /**
   * Reiniciar el procesador
   */
  public reset(): void {
    this.lastEstimates = [];
  }
}
