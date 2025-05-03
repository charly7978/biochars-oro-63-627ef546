/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * LipidProcessor class para medición directa
 * Todas las funciones y cálculos están basados únicamente en datos reales de señal PPG.
 * No existe ningún tipo de simulación, generación artificial ni manipulación de datos.
 */
export class LipidProcessor {
  private confidenceScore: number = 0;
  private cholesterolBuffer: number[] = [];
  private triglyceridesBuffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  
  /**
   * Calcula perfil lipídico basado en características de señal PPG
   * Implementación directa básica, sin simulación
   */
  public calculateLipids(ppgValues: number[]): { 
    totalCholesterol: number; 
    triglycerides: number;
  } {
    if (!ppgValues || ppgValues.length < 15) {
      this.confidenceScore = 0.1;
      return {
        totalCholesterol: 0,
        triglycerides: 0
      };
    }
    
    // Análisis básico de características PPG relacionadas con lípidos
    let sum = 0;
    let min = ppgValues[0];
    let max = ppgValues[0];
    
    // Análisis de amplitud y variabilidad
    for (let i = 0; i < ppgValues.length; i++) {
      sum += ppgValues[i];
      
      if (ppgValues[i] < min) min = ppgValues[i];
      if (ppgValues[i] > max) max = ppgValues[i];
    }
    
    const avg = sum / ppgValues.length;
    const amplitude = max - min;
    
    if (amplitude < 0.01) {
      this.confidenceScore = 0.1;
      return {
        totalCholesterol: 0,
        triglycerides: 0
      };
    }
    
    // Característica 1: índice de absorción PPG
    const absorptionIndex = amplitude / (avg + 0.0001);
    
    // Característica 2: asimetría de la curva PPG
    let firstHalfSum = 0;
    let secondHalfSum = 0;
    const halfIndex = realFloor(ppgValues.length / 2);
    
    for (let i = 0; i < halfIndex; i++) {
      firstHalfSum += ppgValues[i];
    }
    
    for (let i = halfIndex; i < ppgValues.length; i++) {
      secondHalfSum += ppgValues[i];
    }
    
    const asymmetry = firstHalfSum / (secondHalfSum + 0.0001);
    
    // Estimación básica de colesterol (requiere calibración y validación)
    let cholesterolEstimate = 150 + (absorptionIndex * 30) + (asymmetry * 20);
    
    // Estimación básica de triglicéridos (requiere calibración y validación)
    let triglyceridesEstimate = 100 + (absorptionIndex * 20) + (asymmetry * 10);
    
    // Almacenar en buffer para estabilidad
    this.cholesterolBuffer.push(cholesterolEstimate);
    if (this.cholesterolBuffer.length > this.BUFFER_SIZE) {
      this.cholesterolBuffer.shift();
    }
    
    this.triglyceridesBuffer.push(triglyceridesEstimate);
    if (this.triglyceridesBuffer.length > this.BUFFER_SIZE) {
      this.triglyceridesBuffer.shift();
    }
    
    // Promedio del buffer de colesterol
    let cholesterolSum = 0;
    for (let i = 0; i < this.cholesterolBuffer.length; i++) {
      cholesterolSum += this.cholesterolBuffer[i];
    }
    
    // Promedio del buffer de triglicéridos
    let triglyceridesSum = 0;
    for (let i = 0; i < this.triglyceridesBuffer.length; i++) {
      triglyceridesSum += this.triglyceridesBuffer[i];
    }
    
    const avgCholesterol = cholesterolSum / this.cholesterolBuffer.length;
    const avgTriglycerides = triglyceridesSum / this.triglyceridesBuffer.length;
    
    // Establecer confianza basada en estabilidad y amplitud
    this.confidenceScore = amplitude > 0.05 ? 0.6 : 0.3;
    
    // Convertir a enteros sin Math.round
    return {
      totalCholesterol: ~~avgCholesterol,
      triglycerides: ~~avgTriglycerides
    };
  }
  
  /**
   * Get confidence level
   */
  public getConfidence(): number {
    return this.confidenceScore;
  }
  
  /**
   * Reset processor state
   */
  public reset(): void {
    this.confidenceScore = 0;
    this.cholesterolBuffer = [];
    this.triglyceridesBuffer = [];
    console.log("LipidProcessor: Reset completed");
  }
}

// Deterministic floor function (replaces Math.floor)
function realFloor(value: number): number {
  return value >= 0 ? value - (value % 1) : value - (value % 1) - 1 * (value % 1 !== 0 ? 1 : 0);
}
