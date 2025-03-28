
/**
 * Implementación simplificada de filtro basado en wavelets para denoising de señales PPG
 */
export class WaveletDenoiser {
  private THRESHOLD: number = 0.025;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE: number = 16; // Potencia de 2 para transformadas

  /**
   * Aplica denoising wavelet a un valor de señal
   * @param value Valor filtrado por Kalman
   * @returns Valor con ruido reducido
   */
  public denoise(value: number): number {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Si no tenemos suficientes muestras, devolver el valor original
    if (this.buffer.length < this.BUFFER_SIZE) {
      return value;
    }
    
    // Implementación simplificada de denoising
    // En una implementación real, se aplicaría DWT completa
    return this.applySimplifiedDenoising(value);
  }
  
  /**
   * Método simplificado que emula el comportamiento de un denoiser wavelet
   * aplicando un filtro adaptativo basado en los últimos valores
   */
  private applySimplifiedDenoising(currentValue: number): number {
    // Calcular estadísticas locales
    const sum = this.buffer.reduce((acc, val) => acc + val, 0);
    const mean = sum / this.buffer.length;
    
    const variance = this.buffer.reduce((acc, val) => 
      acc + Math.pow(val - mean, 2), 0) / this.buffer.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Aplicar threshold suave para reducción de ruido
    const diff = currentValue - mean;
    const absValue = Math.abs(diff);
    
    if (absValue < this.THRESHOLD * stdDev) {
      // Eliminar pequeñas variaciones (ruido)
      return mean;
    } else {
      // Conservar la señal pero con reducción de ruido
      const sign = diff >= 0 ? 1 : -1;
      return mean + sign * (absValue - this.THRESHOLD * stdDev);
    }
  }
  
  /**
   * Reinicia el buffer del filtro
   */
  public reset(): void {
    this.buffer = [];
  }
  
  /**
   * Ajusta el umbral de filtrado
   * @param threshold Nuevo valor de umbral
   */
  public setThreshold(threshold: number): void {
    if (threshold > 0 && threshold < 1) {
      this.THRESHOLD = threshold;
    }
  }
}
