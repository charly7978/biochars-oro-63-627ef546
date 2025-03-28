
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Procesador de señal para filtrado y amplificación
 * Solo utiliza datos reales sin simulación
 */
export class SignalProcessor {
  private readonly SMA_WINDOW_SIZE = 10;
  private smaBuffer: number[] = [];
  private ppgValues: number[] = [];
  
  /**
   * Aplica un filtro de Media Móvil Simple (SMA) a la señal PPG real
   */
  public applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW_SIZE) {
      this.smaBuffer.shift();
    }
    
    // Calcular promedio de ventana móvil
    const filteredValue = this.smaBuffer.reduce((a, b) => a + b, 0) / this.smaBuffer.length;
    return filteredValue;
  }
  
  /**
   * Obtiene los valores PPG procesados
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Reinicia el procesador de señal
   */
  public reset(): void {
    this.smaBuffer = [];
    this.ppgValues = [];
  }
}
