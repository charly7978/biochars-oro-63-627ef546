
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Validador de señal PPG para asegurar mediciones basadas solo en datos reales
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;
  private readonly minSignalStrength: number = 0.005; // Reducido para mayor sensibilidad

  constructor(minAmplitude: number = 0.005, minDataPoints: number = 10) {
    this.minAmplitude = minAmplitude;
    this.minDataPoints = minDataPoints;
  }
  
  /**
   * Verifica si un valor individual es una señal válida
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) > this.minSignalStrength;
  }
  
  /**
   * Verifica si tenemos suficientes datos para análisis
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente para análisis confiable
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    // Tomar solo los últimos valores para análisis
    const recentValues = values.slice(-15);
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.minAmplitude;
  }
  
  /**
   * Registra los resultados de validación para depuración
   */
  public logValidationResults(
    isValid: boolean, 
    amplitude: number, 
    values: number[]
  ): void {
    if (!isValid) {
      console.log("SignalValidator: Señal no válida", {
        amplitud: amplitude,
        umbralMinimo: this.minAmplitude,
        longitudDatos: values.length,
        ultimosValores: values.slice(-5)
      });
    }
  }
}
