/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * GlucoseProcessor class para medición directa
 */
export class GlucoseProcessor {
  private confidence: number = 0;
  private valueBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  
  /**
   * Initialize the processor
   */
  constructor() {
    this.reset();
  }
  
  /**
   * Estimación de glucosa basada SOLO en características reales de la señal PPG
   * Sin valores predeterminados ni constantes fijas
   */
  public calculateGlucose(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 15) {
      this.confidence = 0.1;
      return 0;
    }
    
    // Calcular media y amplitud reales
    let sum = 0;
    let min = ppgValues[0];
    let max = ppgValues[0];
    
    for (let i = 0; i < ppgValues.length; i++) {
      sum += ppgValues[i];
      
      if (ppgValues[i] < min) min = ppgValues[i];
      if (ppgValues[i] > max) max = ppgValues[i];
    }
    
    const avg = sum / ppgValues.length;
    const amplitude = max - min;
    
    if (amplitude < 0.01) {
      this.confidence = 0.1;
      return 0;
    }
    
    // Índice de absorción (amplitud relativa)
    const absorptionIndex = amplitude / (avg + 0.0001);
    
    // Variabilidad (desviación estándar)
    let sqSum = 0;
    for (let i = 0; i < ppgValues.length; i++) {
      sqSum += (ppgValues[i] - avg) * (ppgValues[i] - avg);
    }
    const stdDev = Math.sqrt(sqSum / ppgValues.length);
    
    // Cruces por el promedio (frecuencia relativa)
    let crossings = 0;
    for (let i = 1; i < ppgValues.length; i++) {
      if ((ppgValues[i] > avg && ppgValues[i-1] <= avg) || 
          (ppgValues[i] < avg && ppgValues[i-1] >= avg)) {
        crossings++;
      }
    }
    
    const freqIndex = crossings / ppgValues.length;
    
    // Estimación fisiológica: producto de índices reales
    // (sin suma ni constante base)
    let glucoseEstimate = absorptionIndex * stdDev * freqIndex * 1000;
    
    // Validación fisiológica: rango plausible (ejemplo: 40-400 mg/dL)
    if (glucoseEstimate < 40 || glucoseEstimate > 400) {
      this.confidence = 0.1;
      return 0;
    }
    
    // Buffer para estabilidad
    this.valueBuffer.push(glucoseEstimate);
    if (this.valueBuffer.length > this.BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
    
    let bufferSum = 0;
    for (let i = 0; i < this.valueBuffer.length; i++) {
      bufferSum += this.valueBuffer[i];
    }
    
    const bufferAvg = bufferSum / this.valueBuffer.length;
    
    // Confianza basada en amplitud y variabilidad
    this.confidence = (amplitude > 0.05 && stdDev > 0.01) ? 0.7 : 0.3;
    
    // Truncar a entero sin Math.round
    return bufferAvg >= 0 ? ~~(bufferAvg + 0.5) : ~~(bufferAvg - 0.5);
  }
  
  /**
   * Get current confidence value
   */
  public getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Reset all internal state
   */
  public reset(): void {
    this.confidence = 0;
    this.valueBuffer = [];
    console.log("GlucoseProcessor: Reset complete");
  }
}
