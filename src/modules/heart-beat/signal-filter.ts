
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Filtro de señal para procesamiento de PPG
 */
export class SignalFilter {
  private readonly ALPHA_EMA = 0.3;
  private readonly WINDOW_SIZE_MA = 5;
  private readonly WINDOW_SIZE_MEDIAN = 3;
  
  private emaValue: number = 0;
  private movingAverageBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private baseline: number = 0;
  private readonly BASELINE_FACTOR = 0.995;
  
  constructor() {
    console.log("SignalFilter: Initialized");
  }
  
  /**
   * Aplica un filtro paso banda para eliminar ruido de alta y baja frecuencia
   */
  public applyBandpassFilter(value: number): number {
    // Aplicar filtro mediana para eliminar picos
    const medianValue = this.applyMedianFilter(value);
    
    // Aplicar promedio móvil para suavizar
    const maValue = this.applyMovingAverage(medianValue);
    
    // Aplicar EMA para suavizado adicional
    const emaValue = this.applyEMA(maValue);
    
    // Actualizar línea base
    this.baseline = this.BASELINE_FACTOR * this.baseline + (1 - this.BASELINE_FACTOR) * emaValue;
    
    // Normalizar señal restando línea base
    return emaValue - this.baseline;
  }
  
  /**
   * Aplica filtro mediana para eliminar valores atípicos
   */
  private applyMedianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.WINDOW_SIZE_MEDIAN) {
      this.medianBuffer.shift();
    }
    
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Aplica promedio móvil para suavizar la señal
   */
  private applyMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.WINDOW_SIZE_MA) {
      this.movingAverageBuffer.shift();
    }
    
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }
  
  /**
   * Aplica Exponential Moving Average para suavizado adicional
   */
  private applyEMA(value: number): number {
    if (this.emaValue === 0) {
      this.emaValue = value;
    } else {
      this.emaValue = this.ALPHA_EMA * value + (1 - this.ALPHA_EMA) * this.emaValue;
    }
    return this.emaValue;
  }
  
  /**
   * Reinicia el filtro
   */
  public reset(): void {
    this.emaValue = 0;
    this.movingAverageBuffer = [];
    this.medianBuffer = [];
    this.baseline = 0;
  }
}
