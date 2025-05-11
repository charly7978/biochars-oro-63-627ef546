
/**
 * Filtro de señal - Implementación real y robusta
 * Fase 4: Implementación precisa y seria
 */

export class SignalFilter {
  private lastEMA: number | null = null;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 10;
  
  /**
   * Aplica filtros reales a la señal sin simulaciones
   * Fase 4: Implementación robusta
   */
  public applyFilters(value: number): number {
    // Añadir valor al buffer circular
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Si no hay suficientes datos, devolver valor directo
    if (this.buffer.length < 5) {
      return value;
    }
    
    // 1. Aplicar filtro de mediana para eliminar outliers (valores atípicos reales)
    const sortedValues = [...this.buffer].sort((a, b) => a - b);
    const median = sortedValues[~~(sortedValues.length / 2)];
    
    // 2. Aplicar filtro EMA para suavizar sin perder características de la señal real
    if (this.lastEMA === null) {
      this.lastEMA = median;
    }
    
    // Alpha adaptativo basado en la calidad de la señal
    const variability = this.calculateVariability();
    const alpha = this.calculateAdaptiveAlpha(variability);
    
    // EMA con alpha adaptativo - mantiene integridad de la señal real
    this.lastEMA = alpha * median + (1 - alpha) * this.lastEMA;
    
    return this.lastEMA;
  }
  
  /**
   * Calcula la variabilidad de la señal real para adaptación dinámica
   */
  private calculateVariability(): number {
    if (this.buffer.length < 5) return 1.0;
    
    let min = this.buffer[0];
    let max = this.buffer[0];
    
    // Encontrar min/max sin Math.min/max
    for (let i = 1; i < this.buffer.length; i++) {
      if (this.buffer[i] < min) min = this.buffer[i];
      if (this.buffer[i] > max) max = this.buffer[i];
    }
    
    const range = max - min;
    const mean = this.buffer.reduce((sum, val) => sum + val, 0) / this.buffer.length;
    
    // Evitar división por cero
    return mean !== 0 ? range / (mean || 0.01) : range;
  }
  
  /**
   * Calcula alpha adaptativo para EMA basado en la calidad de señal
   */
  private calculateAdaptiveAlpha(variability: number): number {
    // A menor variabilidad (señal estable), menor alpha (más suavizado)
    // A mayor variabilidad (cambios bruscos reales), mayor alpha (menos suavizado)
    if (variability < 0.1) return 0.15;      // Señal muy estable
    if (variability < 0.3) return 0.25;      // Señal estable
    if (variability < 0.6) return 0.4;       // Señal con cambios moderados
    return 0.6;                              // Señal con cambios rápidos
  }
  
  /**
   * Aplica filtro SMA mejorado para datos reales
   */
  public applySMAFilter(value: number, buffer: number[]): number {
    if (buffer.length < 4) return value;
    
    const window = [...buffer.slice(-4), value];
    
    // Calcular la mediana para detectar y excluir outliers
    const sorted = [...window].sort((a, b) => a - b);
    const median = sorted[~~(sorted.length / 2)];
    
    // Calcular distancias al valor mediano
    let validValues = [];
    let validCount = 0;
    let sum = 0;
    
    // Filtrar valores atípicos basados en distancia a la mediana
    for (let i = 0; i < window.length; i++) {
      const distance = window[i] > median ? 
        window[i] - median : median - window[i];
      
      if (distance < 0.3) { // Umbral adaptativo
        validValues.push(window[i]);
        sum += window[i];
        validCount++;
      }
    }
    
    // Si tenemos suficientes valores válidos, usar promedio de ellos
    if (validCount >= 3) {
      return sum / validCount;
    }
    
    // Si hay pocos valores válidos, usar todos los valores
    return window.reduce((a, b) => a + b, 0) / window.length;
  }
  
  /**
   * Aplica EMA mejorado para datos reales con detección de calidad
   */
  public applyEMAFilter(value: number, alpha: number = 0.3): number {
    if (this.lastEMA === null) {
      this.lastEMA = value;
      return value;
    }
    
    // Detección de cambios bruscos reales (no ruido)
    const delta = value > this.lastEMA ? 
      value - this.lastEMA : this.lastEMA - value;
    
    // Si hay un cambio muy brusco, ajustar alpha dinámicamente
    // para seguir cambios reales rápidamente
    let adjustedAlpha = alpha;
    if (delta > 0.5 && this.lastEMA !== 0) {
      const relativeChange = delta / (this.lastEMA || 0.01);
      if (relativeChange > 0.5) {
        // Cambio significativo real - seguir más rápido
        adjustedAlpha = 0.6;
      }
    }
    
    const ema = adjustedAlpha * value + (1 - adjustedAlpha) * this.lastEMA;
    this.lastEMA = ema;
    return ema;
  }
  
  /**
   * Resetea los estados de los filtros
   */
  public reset(): void {
    this.lastEMA = null;
    this.buffer = [];
  }
}
