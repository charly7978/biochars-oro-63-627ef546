
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Valida las señales para asegurar que son aptas para procesamiento
 * No usa simulaciones ni valores de referencia - solo análisis directo de señal
 */
export class SignalValidator {
  private readonly MIN_SIGNAL_AMPLITUDE: number;
  private readonly MIN_DATA_POINTS: number;
  private readonly MIN_SIGNAL_VALUE = 0.001;
  private readonly MAX_SIGNAL_VALUE = 1000;
  
  constructor(minAmplitude: number = 0.01, minDataPoints: number = 10) {
    this.MIN_SIGNAL_AMPLITUDE = minAmplitude;
    this.MIN_DATA_POINTS = minDataPoints;
  }
  
  /**
   * Valida si el valor de la señal es utilizable
   * @param value Valor de señal a validar
   */
  public isValidSignal(value: number): boolean {
    // Valor no puede ser NaN ni infinito
    if (isNaN(value) || !isFinite(value)) {
      return false;
    }
    
    // Valor debe estar dentro del rango esperado
    if (Math.abs(value) < this.MIN_SIGNAL_VALUE || Math.abs(value) > this.MAX_SIGNAL_VALUE) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Verifica si hay suficientes puntos de datos para análisis
   * @param values Arreglo de valores a comprobar
   */
  public hasEnoughData(values: number[]): boolean {
    if (!values || values.length < this.MIN_DATA_POINTS) {
      return false;
    }
    
    // Verificar si los valores son utilizables
    const validValues = values.filter(v => this.isValidSignal(v));
    return validValues.length >= this.MIN_DATA_POINTS;
  }
  
  /**
   * Verifica si la amplitud de la señal es suficiente
   * @param values Arreglo de valores a comprobar
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) {
      return false;
    }
    
    const minValue = Math.min(...values.slice(-15));
    const maxValue = Math.max(...values.slice(-15));
    const amplitude = maxValue - minValue;
    
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE;
  }
  
  /**
   * Registra resultados de validación para propósitos de depuración
   * @param isValid Si la señal es válida
   * @param amplitude Amplitud de la señal
   * @param values Valores analizados
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalValidator: Resultados de validación", {
      isValid,
      amplitude,
      minAmplitudRequerida: this.MIN_SIGNAL_AMPLITUDE,
      puntosDeDatos: values.length,
      minimoRequerido: this.MIN_DATA_POINTS,
      ultimosValores: values.slice(-5)
    });
  }
}
