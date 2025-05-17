
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal filtering utilities for processing real PPG signals - versión mejorada
 * All methods work with real data only, no simulation
 * Implementación optimizada para señales PPG de mayor calidad
 */
export class SignalFilter {
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 5; // Aumentado para mejor filtrado
  private readonly LOW_PASS_ALPHA = 0.15; // Optimizado para PPG
  
  // Nuevos parámetros para filtrado avanzado
  private readonly HIGH_FREQ_CUTOFF = 0.25; // Coeficiente de filtro paso bajo
  private readonly ADAPTIVE_ALPHA_MIN = 0.05;
  private readonly ADAPTIVE_ALPHA_MAX = 0.35;
  private readonly BUTTERWORTH_ORDER = 2;
  
  // Estado para filtros avanzados
  private lastOutputs: number[] = [];
  private lastInputs: number[] = [];
  private readonly FILTER_STATE_SIZE = 4;
  
  /**
   * Método inicial para preparar el filtro
   */
  public initialize(): void {
    this.lastOutputs = new Array(this.FILTER_STATE_SIZE).fill(0);
    this.lastInputs = new Array(this.FILTER_STATE_SIZE).fill(0);
  }
  
  /**
   * Apply Moving Average filter to real values - implementación mejorada
   */
  public applySMAFilter(value: number, values: number[]): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (values.length < 2) {
      return value;
    }
    
    // Usar ventana triangular ponderada para mejor preservación de picos
    let weightedSum = value;
    let totalWeight = 1;
    
    const recentValues = values.slice(-windowSize);
    for (let i = 0; i < recentValues.length; i++) {
      const weight = (i + 1) / (recentValues.length + 1);
      weightedSum += recentValues[i] * weight;
      totalWeight += weight;
    }
    
    return weightedSum / totalWeight;
  }
  
  /**
   * Apply Exponential Moving Average filter to real data - versión adaptativa
   */
  public applyEMAFilter(value: number, values: number[], alpha?: number): number {
    if (values.length === 0) {
      return value;
    }
    
    // Si no se especifica alpha, usar el valor predeterminado
    let filterAlpha = alpha !== undefined ? alpha : this.LOW_PASS_ALPHA;
    
    // Optimización: adaptación dinámica basada en variación de señal
    if (values.length > 3 && alpha === undefined) {
      const lastThree = values.slice(-3);
      const range = Math.max(...lastThree) - Math.min(...lastThree);
      
      // Ajustar alpha basado en variación - menos filtrado con señal estable,
      // más filtrado con señal variable
      if (range < 0.01) {
        filterAlpha = this.ADAPTIVE_ALPHA_MIN; // Más filtrado para señales ruidosas
      } else if (range > 0.1) {
        filterAlpha = this.ADAPTIVE_ALPHA_MAX; // Menos filtrado para preservar detalles
      } else {
        // Interpolación lineal entre valores extremos
        filterAlpha = this.ADAPTIVE_ALPHA_MIN + 
          ((range - 0.01) * (this.ADAPTIVE_ALPHA_MAX - this.ADAPTIVE_ALPHA_MIN) / 0.09);
      }
    }
    
    const lastValue = values[values.length - 1];
    return filterAlpha * value + (1 - filterAlpha) * lastValue;
  }
  
  /**
   * Apply median filter to real data - ventana ampliada
   */
  public applyMedianFilter(value: number, values: number[]): number {
    if (values.length < 3) {
      return value;
    }
    
    // Usar ventana de mayor tamaño pero solo si hay suficientes valores
    const windowSize = Math.min(this.MEDIAN_WINDOW_SIZE, values.length);
    const valuesForMedian = [...values.slice(-windowSize), value];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Nuevo: Filtro pasa-banda Butterworth simplificado para señales PPG
   * Aplicación basada en coeficientes precomputados para orden 2
   */
  public applyButterworthBandpassFilter(value: number): number {
    // Coeficientes para filtro pasa-banda butterworth de orden 2
    // Frecuencias de corte aproximadas: 0.5Hz - 5Hz (30-300 BPM)
    const a = [1.0, -1.5, 0.5]; // Denominador
    const b = [0.25, 0, -0.25]; // Numerador
    
    // Actualizar buffer de entrada
    this.lastInputs.unshift(value);
    if (this.lastInputs.length > this.FILTER_STATE_SIZE) {
      this.lastInputs.pop();
    }
    
    // Calcular salida del filtro
    let output = 0;
    for (let i = 0; i < b.length && i < this.lastInputs.length; i++) {
      output += b[i] * this.lastInputs[i];
    }
    
    for (let i = 1; i < a.length && i < this.lastOutputs.length + 1; i++) {
      output -= a[i] * this.lastOutputs[i-1];
    }
    
    // Actualizar buffer de salida
    this.lastOutputs.unshift(output);
    if (this.lastOutputs.length > this.FILTER_STATE_SIZE) {
      this.lastOutputs.pop();
    }
    
    return output;
  }
  
  /**
   * Reiniciar estado del filtro
   */
  public reset(): void {
    this.lastOutputs = new Array(this.FILTER_STATE_SIZE).fill(0);
    this.lastInputs = new Array(this.FILTER_STATE_SIZE).fill(0);
  }
}
