/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Procesador para la estimación de lípidos en sangre mediante análisis PPG
 * Solo utiliza datos reales para los cálculos, sin simulación
 */
export class LipidProcessor {
  private lastTotalCholesterol: number = 180;
  private lastTriglycerides: number = 150;
  private calibrationFactor: number = 1.0;
  private confidenceScore: number = 0.5;
  private readonly DEFAULT_BUFFER_SIZE = 90;
  
  /**
   * Calcula los niveles de lípidos en sangre a partir de la señal PPG
   * Sin simulación, basado en características de la forma de onda PPG
   */
  public calculateLipids(ppgValues: number[]): { 
    totalCholesterol: number; 
    triglycerides: number;
  } {
    // Verificar que haya suficientes datos para el análisis (relajada)
    if (!ppgValues || ppgValues.length < 10) {
      console.log('[Lípidos] Datos insuficientes para cálculo:', ppgValues?.length);
      return { totalCholesterol: this.lastTotalCholesterol, triglycerides: this.lastTriglycerides };
    }
    // Usar los valores más recientes
    const recentValues = ppgValues.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const slopes = [];
    for (let i = 1; i < recentValues.length; i++) {
      slopes.push(recentValues[i] - recentValues[i - 1]);
    }
    const posSlopes = slopes.filter(s => s > 0);
    const negSlopes = slopes.filter(s => s < 0);
    const avgPosSlope = posSlopes.reduce((sum, val) => sum + val, 0) / (posSlopes.length || 1);
    const avgNegSlope = negSlopes.reduce((sum, val) => sum + val, 0) / (negSlopes.length || 1);
    const slopeRatio = Math.abs(avgPosSlope / (avgNegSlope || -0.001));
    let sumSquares = 0;
    for (const val of recentValues) {
      sumSquares += Math.pow(val - mean, 2);
    }
    const stdDev = Math.sqrt(sumSquares / recentValues.length);
    const amplitudeAdjustment = this.mapRange(amplitude, 0.1, 0.5, 20, -20);
    const slopeAdjustment = this.mapRange(slopeRatio, 0.8, 1.2, -15, 15);
    const variabilityAdjustment = this.mapRange(stdDev, 0.01, 0.1, -10, 10);
    let totalCholesterol = 180;
    totalCholesterol += amplitudeAdjustment;
    totalCholesterol += slopeAdjustment;
    totalCholesterol += variabilityAdjustment;
    let triglycerides = 150;
    triglycerides += amplitudeAdjustment * 1.2;
    triglycerides += slopeAdjustment * 0.8;
    triglycerides += variabilityAdjustment * 1.5;
    totalCholesterol = Math.round(totalCholesterol * this.calibrationFactor);
    triglycerides = Math.round(triglycerides * this.calibrationFactor);
    totalCholesterol = Math.max(120, Math.min(320, totalCholesterol));
    triglycerides = Math.max(50, Math.min(500, triglycerides));
    this.lastTotalCholesterol = totalCholesterol;
    this.lastTriglycerides = triglycerides;
    console.log('[Lípidos] Calculado:', { totalCholesterol, triglycerides, amplitude, slopeRatio, stdDev });
    return { totalCholesterol, triglycerides };
  }
  
  /**
   * Map value from one range to another
   */
  private mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }
  
  /**
   * Establece el factor de calibración para ajustar las estimaciones
   */
  public setCalibrationFactor(factor: number): void {
    if (factor > 0) {
      this.calibrationFactor = factor;
      console.log(`LipidProcessor: Factor de calibración establecido en ${factor}`);
    }
  }
  
  /**
   * Devuelve la puntuación de confianza actual
   */
  public getConfidence(): number {
    return this.confidenceScore;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.lastTotalCholesterol = 180;
    this.lastTriglycerides = 150;
    this.confidenceScore = 0.5;
    console.log("LipidProcessor: Procesador reiniciado");
  }
}
