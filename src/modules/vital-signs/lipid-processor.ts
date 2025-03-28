
/**
 * Procesador de Lípidos
 * Simula estimación del perfil lipídico basado en signos vitales
 */
export class LipidProcessor {
  private readonly CHOLESTEROL_BASELINE = 170;
  private readonly TRIGLYCERIDES_BASELINE = 120;
  private readonly MAX_ADJUSTMENT = 50;
  private lastCholesterolEstimates: number[] = [];
  private lastTriglyceridesEstimates: number[] = [];
  private readonly BUFFER_SIZE = 5;

  /**
   * Estimar perfil lipídico a partir de signos vitales
   * Nota: Esta es una simulación - el perfil lipídico real no puede medirse con precisión solo desde PPG
   */
  public estimateLipids(spo2: number, heartRate: number, ppgValues: number[]): {
    totalCholesterol: number;
    triglycerides: number;
  } {
    // Si no tenemos entradas válidas, devolver valores base
    if (spo2 === 0 || heartRate === 0 || ppgValues.length < 30) {
      return {
        totalCholesterol: this.CHOLESTEROL_BASELINE,
        triglycerides: this.TRIGLYCERIDES_BASELINE
      };
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
    
    // Simular variaciones del perfil lipídico basadas en parámetros de entrada
    
    // Frecuencia cardíaca más alta podría correlacionarse con actividad metabólica
    const hrFactor = Math.max(-15, Math.min(15, (heartRate - 70) * 0.5));
    
    // SpO2 más bajo puede indicar problemas metabólicos
    const spo2Factor = Math.max(-10, Math.min(10, (98 - spo2) * 1.5));
    
    // Características de la señal pueden indicar salud vascular
    const varFactor = Math.max(-10, Math.min(10, (stdDev - 0.1) * 80));
    const ampFactor = Math.max(-10, Math.min(10, (amplitude - 0.5) * 40));
    
    // Calcular estimaciones crudas
    const rawCholesterol = this.CHOLESTEROL_BASELINE + hrFactor + spo2Factor + varFactor;
    const rawTriglycerides = this.TRIGLYCERIDES_BASELINE + hrFactor + spo2Factor + ampFactor;
    
    // Añadir aleatoriedad para simular variaciones naturales
    const cholNoise = Math.random() * 10 - 5; // -5 a +5
    const trigNoise = Math.random() * 8 - 4;  // -4 a +4
    
    // Aplicar restricciones para mantener valores en rangos realistas
    const cholEstimate = Math.max(140, Math.min(240, rawCholesterol + cholNoise));
    const trigEstimate = Math.max(80, Math.min(200, rawTriglycerides + trigNoise));
    
    // Suavizar con estimaciones previas
    this.lastCholesterolEstimates.push(cholEstimate);
    this.lastTriglyceridesEstimates.push(trigEstimate);
    
    if (this.lastCholesterolEstimates.length > this.BUFFER_SIZE) {
      this.lastCholesterolEstimates.shift();
      this.lastTriglyceridesEstimates.shift();
    }
    
    // Promediar las estimaciones recientes
    const smoothedCholesterol = 
      this.lastCholesterolEstimates.reduce((a, b) => a + b, 0) / 
      this.lastCholesterolEstimates.length;
    
    const smoothedTriglycerides = 
      this.lastTriglyceridesEstimates.reduce((a, b) => a + b, 0) / 
      this.lastTriglyceridesEstimates.length;
    
    return {
      totalCholesterol: Math.round(smoothedCholesterol),
      triglycerides: Math.round(smoothedTriglycerides)
    };
  }
  
  /**
   * Reiniciar el procesador
   */
  public reset(): void {
    this.lastCholesterolEstimates = [];
    this.lastTriglyceridesEstimates = [];
  }
}
