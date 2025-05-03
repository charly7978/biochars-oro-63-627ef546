
/**
 * Implementación de filtros para señales PPG.
 * NO usa funciones Math, solo operaciones directas.
 */
export class SignalFilter {
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 3;
  private readonly LOW_PASS_ALPHA = 0.2;
  
  // Valores históricos
  private smaValues: number[] = [];
  private emaValues: number[] = [];

  /**
   * Aplica filtro de media móvil simple (SMA) a valor real
   */
  public applySMAFilter(value: number, values: number[] = []): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    // Si se pasan valores, usarlos directamente
    const bufferToUse = values.length > 0 ? values : this.smaValues;
    
    if (bufferToUse.length < windowSize) {
      // Si no hay suficientes valores para promediar
      if (values.length === 0) this.smaValues.push(value);
      return value;
    }
    
    // Tomar los valores más recientes
    const recentValues = bufferToUse.slice(-windowSize);
    
    // Calcular la suma sin usar reduce
    let sum = 0;
    for (let i = 0; i < recentValues.length; i++) {
      sum += recentValues[i];
    }
    
    // Añadir el valor actual
    sum += value;
    
    // Si estamos manteniendo estado interno, actualizar
    if (values.length === 0) {
      this.smaValues.push(value);
      if (this.smaValues.length > windowSize * 3) {
        this.smaValues.shift(); // Limitar tamaño del buffer
      }
    }
    
    // Devolver el promedio
    return sum / (recentValues.length + 1);
  }
  
  /**
   * Aplica filtro de media móvil exponencial (EMA) a valor real
   */
  public applyEMAFilter(value: number, values: number[] = [], alpha: number = this.LOW_PASS_ALPHA): number {
    // Si se pasan valores explícitamente, usarlos directamente
    const bufferToUse = values.length > 0 ? values : this.emaValues;
    
    if (bufferToUse.length === 0) {
      // Si no hay valores anteriores, devolver el actual
      if (values.length === 0) this.emaValues.push(value);
      return value;
    }
    
    // Obtener el último valor
    const lastValue = bufferToUse[bufferToUse.length - 1];
    
    // Calcular EMA: alpha * current + (1 - alpha) * last
    const result = alpha * value + (1 - alpha) * lastValue;
    
    // Si estamos manteniendo estado interno, actualizar
    if (values.length === 0) {
      this.emaValues.push(result);
      if (this.emaValues.length > 20) {
        this.emaValues.shift(); // Limitar tamaño del buffer
      }
    }
    
    return result;
  }
  
  /**
   * Aplica filtro de mediana a valor real
   */
  public applyMedianFilter(value: number, values: number[] = []): number {
    const windowSize = this.MEDIAN_WINDOW_SIZE;
    
    // Si no hay suficientes valores, devolver el actual
    if (values.length < windowSize - 1) {
      return value;
    }
    
    // Crear array con valores recientes más el actual
    const valuesForMedian = [...values.slice(-windowSize + 1), value];
    
    // Ordenar valores (burbuja simple)
    for (let i = 0; i < valuesForMedian.length; i++) {
      for (let j = 0; j < valuesForMedian.length - 1; j++) {
        if (valuesForMedian[j] > valuesForMedian[j + 1]) {
          // Intercambiar valores
          const temp = valuesForMedian[j];
          valuesForMedian[j] = valuesForMedian[j + 1];
          valuesForMedian[j + 1] = temp;
        }
      }
    }
    
    // Tomar valor central
    return valuesForMedian[~~(valuesForMedian.length / 2)];
  }
  
  /**
   * Reset del estado de filtros
   */
  public reset(): void {
    this.smaValues = [];
    this.emaValues = [];
  }
}
