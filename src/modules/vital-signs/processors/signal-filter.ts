
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal filtering utilities for processing real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced with better filtering techniques for cleaner signal extraction
 */
export class SignalFilter {
  // Ventanas de filtrado optimizadas basadas en la literatura médica
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 5; // Aumentado para mejor filtrado de outliers
  private readonly LOW_PASS_ALPHA = 0.15; // Ajustado para mejor balance entre respuesta y suavizado
  private readonly BUTTERWORTH_CUTOFF = 0.1; // Normalizado a frecuencia de muestreo
  
  // Coeficientes de filtro Butterworth pre-calculados (filtro de paso bajo de 2º orden)
  private readonly BUTTERWORTH_B = [0.0201, 0.0402, 0.0201];
  private readonly BUTTERWORTH_A = [1.0000, -1.5610, 0.6414];
  
  // Buffer para filtros que requieren historial
  private butterworthInputHistory: number[] = [0, 0];
  private butterworthOutputHistory: number[] = [0, 0];
  
  /**
   * Apply Moving Average filter to real values
   * Optimizado para mayor eficiencia computacional
   */
  public applySMAFilter(value: number, values: number[]): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (values.length < windowSize) {
      return value;
    }
    
    // Utilizamos solo los valores más recientes para el cálculo
    const recentValues = values.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   * Implementación más eficiente y estable
   */
  public applyEMAFilter(value: number, values: number[], alpha: number = this.LOW_PASS_ALPHA): number {
    if (values.length === 0) {
      return value;
    }
    
    const lastValue = values[values.length - 1];
    
    // Protección contra NaN y valores extremos
    if (isNaN(value) || !isFinite(value)) {
      return lastValue;
    }
    
    // Limitación de cambios excesivos para proteger contra outliers
    const maxChange = Math.abs(lastValue) * 0.5;
    if (Math.abs(value - lastValue) > maxChange) {
      value = lastValue + (value > lastValue ? maxChange : -maxChange);
    }
    
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter to real data
   * Más efectivo para eliminar ruido impulsivo
   */
  public applyMedianFilter(value: number, values: number[]): number {
    if (values.length < this.MEDIAN_WINDOW_SIZE) {
      return value;
    }
    
    // Usando solo los valores más recientes + el valor actual
    const valuesForMedian = [...values.slice(-this.MEDIAN_WINDOW_SIZE), value];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Apply Butterworth low-pass filter (2nd order)
   * Implementación optimizada para procesamiento en tiempo real
   * Superior a EMA para preservar características de la señal PPG
   */
  public applyButterworthFilter(value: number): number {
    // Protección contra NaN y valores extremos
    if (isNaN(value) || !isFinite(value)) {
      return 0;
    }
    
    // Implementación directa de ecuación en diferencias del filtro IIR
    let outputValue = 
      this.BUTTERWORTH_B[0] * value + 
      this.BUTTERWORTH_B[1] * this.butterworthInputHistory[0] + 
      this.BUTTERWORTH_B[2] * this.butterworthInputHistory[1] - 
      this.BUTTERWORTH_A[1] * this.butterworthOutputHistory[0] - 
      this.BUTTERWORTH_A[2] * this.butterworthOutputHistory[1];
    
    // Actualizar historiales para la próxima muestra
    this.butterworthInputHistory[1] = this.butterworthInputHistory[0];
    this.butterworthInputHistory[0] = value;
    this.butterworthOutputHistory[1] = this.butterworthOutputHistory[0];
    this.butterworthOutputHistory[0] = outputValue;
    
    return outputValue;
  }
  
  /**
   * Apply combined filter pipeline for optimal PPG signal quality
   * Combina varios filtros para maximizar la extracción de señal
   */
  public applyFilterPipeline(value: number, values: number[]): number {
    // 1. Median filter para eliminar outliers
    const medianFiltered = this.applyMedianFilter(value, values);
    
    // 2. SMA para suavizado inicial
    const smaFiltered = this.applySMAFilter(medianFiltered, values);
    
    // 3. Butterworth para preservar la forma de onda PPG
    const butterworthFiltered = this.applyButterworthFilter(smaFiltered);
    
    // 4. EMA final para estabilizar
    const emaFiltered = this.applyEMAFilter(butterworthFiltered, values, this.LOW_PASS_ALPHA * 0.8);
    
    return emaFiltered;
  }
  
  /**
   * Resetea los filtros que mantienen estado
   */
  public reset(): void {
    this.butterworthInputHistory = [0, 0];
    this.butterworthOutputHistory = [0, 0];
  }
}
