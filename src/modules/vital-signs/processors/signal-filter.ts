
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
  
  // Nuevo: Filtro mejorado para cardio-óptica (pan-tompkins adaptado)
  private readonly CARDIO_OPTICAL_WINDOW = 12;
  private readonly DERIVATIVE_WINDOW = 5;
  
  // Buffer para filtros que requieren historial
  private butterworthInputHistory: number[] = [0, 0];
  private butterworthOutputHistory: number[] = [0, 0];
  
  // Historial para derivadas y análisis morfológico
  private valueHistory: number[] = [];
  private derivativeHistory: number[] = [];
  private secondDerivativeHistory: number[] = [];
  
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
    
    // 5. Actualizar historiales para análisis morfológico
    this.updateMorphologicalHistory(emaFiltered);
    
    return emaFiltered;
  }
  
  /**
   * Nuevo: Filtrado adaptado del algoritmo Pan-Tompkins para señales PPG
   * Implementa un filtrado más específico para las características cardio-ópticas
   */
  public applyCardioOpticalFilter(value: number, values: number[]): number {
    // Requiere suficiente historial para análisis
    if (values.length < this.CARDIO_OPTICAL_WINDOW) {
      return this.applyFilterPipeline(value, values);
    }
    
    // 1. Filtrado inicial como en el pipeline estándar
    const baselineFiltered = this.applyFilterPipeline(value, values);
    
    // 2. Análisis de morfología y derivadas para realzar componentes cardíacos
    const recentValues = [...values.slice(-this.CARDIO_OPTICAL_WINDOW), baselineFiltered];
    
    // 3. Cálculo adaptativo basado en derivadas para refuerzo de componentes cardíacos
    const firstDerivative = this.calculateFirstDerivative(recentValues);
    const secondDerivative = this.calculateSecondDerivative(firstDerivative);
    
    // 4. Refuerzo de características morfológicas utilizando derivadas
    // Para PPG, queremos enfatizar las pendientes de subida y puntos de inflexión
    let morphologicalEnhancement = 0;
    
    if (firstDerivative.length > 0 && secondDerivative.length > 0) {
      // Realce basado en pendiente positiva (subida) - característica principal del pulso PPG
      const risingEdgeFactor = Math.max(0, firstDerivative[firstDerivative.length - 1]);
      
      // Refuerzo basado en punto de inflexión (cambio de curvatura) - característica de forma
      const inflectionFactor = -Math.min(0, secondDerivative[secondDerivative.length - 1]);
      
      // Ponderación adaptativa basada en características morfológicas
      morphologicalEnhancement = 
        baselineFiltered * 0.85 + 
        risingEdgeFactor * 0.1 + 
        inflectionFactor * 0.05;
    } else {
      morphologicalEnhancement = baselineFiltered;
    }
    
    // 5. Filtrado final y normalización
    return morphologicalEnhancement;
  }
  
  /**
   * Actualiza el historial para análisis morfológico
   */
  private updateMorphologicalHistory(value: number): void {
    // Mantener historial de valores para cálculos de derivada
    this.valueHistory.push(value);
    if (this.valueHistory.length > this.CARDIO_OPTICAL_WINDOW) {
      this.valueHistory.shift();
    }
    
    // Actualizar derivadas si hay suficientes valores
    if (this.valueHistory.length > this.DERIVATIVE_WINDOW) {
      const newDeriv = this.calculateSingleDerivative(this.valueHistory);
      this.derivativeHistory.push(newDeriv);
      
      if (this.derivativeHistory.length > this.DERIVATIVE_WINDOW) {
        this.derivativeHistory.shift();
      }
      
      // Actualizar segunda derivada si hay suficientes valores
      if (this.derivativeHistory.length > this.DERIVATIVE_WINDOW) {
        const newSecondDeriv = this.calculateSingleDerivative(this.derivativeHistory);
        this.secondDerivativeHistory.push(newSecondDeriv);
        
        if (this.secondDerivativeHistory.length > this.DERIVATIVE_WINDOW) {
          this.secondDerivativeHistory.shift();
        }
      }
    }
  }
  
  /**
   * Calcula la primera derivada de un conjunto de valores
   */
  private calculateFirstDerivative(values: number[]): number[] {
    const result: number[] = [];
    
    // Algoritmo de tres puntos para mejor precisión en PPG
    for (let i = 2; i < values.length - 2; i++) {
      const derivative = (values[i+1] - values[i-1]) / 2;
      result.push(derivative);
    }
    
    return result;
  }
  
  /**
   * Calcula la segunda derivada a partir de la primera
   */
  private calculateSecondDerivative(firstDerivative: number[]): number[] {
    const result: number[] = [];
    
    for (let i = 1; i < firstDerivative.length - 1; i++) {
      const derivative = firstDerivative[i+1] - firstDerivative[i-1];
      result.push(derivative);
    }
    
    return result;
  }
  
  /**
   * Calcula un solo valor de derivada a partir de un conjunto de valores
   */
  private calculateSingleDerivative(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Usar los últimos valores para el cálculo
    const len = values.length;
    return (values[len-1] - values[len-3]) / 2;
  }
  
  /**
   * Resetea los filtros que mantienen estado
   */
  public reset(): void {
    this.butterworthInputHistory = [0, 0];
    this.butterworthOutputHistory = [0, 0];
    this.valueHistory = [];
    this.derivativeHistory = [];
    this.secondDerivativeHistory = [];
  }
}
