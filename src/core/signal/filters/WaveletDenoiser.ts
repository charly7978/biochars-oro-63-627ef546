
/**
 * Implementación de un filtro de denoise basado en wavelets
 * Ofrece mejor eliminación de ruido que el filtro Kalman, preservando mejor
 * las características morfológicas de la señal PPG
 */
export class WaveletDenoiser {
  private signalBuffer: number[] = [];
  private readonly BUFFER_SIZE = 64; // Potencia de 2 para transformada wavelet
  private readonly THRESHOLD = 0.025; // Umbral para soft thresholding
  
  constructor() {
    // Inicializar buffer con ceros
    this.signalBuffer = new Array(this.BUFFER_SIZE).fill(0);
  }
  
  /**
   * Aplica denoising wavelet a la señal PPG
   * @param value Valor actual de la señal
   * @returns Señal filtrada
   */
  public denoise(value: number): number {
    // Añadir nuevo valor al buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Si no tenemos suficientes datos, devolver el valor original
    if (this.signalBuffer.length < this.BUFFER_SIZE) {
      return value;
    }
    
    // Realizar transformada wavelet discreta (DWT) - Haar wavelet simple
    const dwt = this.discreteWaveletTransform(this.signalBuffer);
    
    // Aplicar soft thresholding a los coeficientes (eliminar ruido)
    const denoised = this.softThreshold(dwt);
    
    // Realizar transformada inversa (IDWT)
    const reconstructed = this.inverseWaveletTransform(denoised);
    
    // Devolver el último valor reconstruido
    return reconstructed[reconstructed.length - 1];
  }
  
  /**
   * Implementación básica de la Transformada Wavelet Discreta usando Haar
   * @param signal Señal de entrada
   * @returns Coeficientes wavelet
   */
  private discreteWaveletTransform(signal: number[]): number[] {
    const n = signal.length;
    if (n === 1) return signal;
    
    // Asegurar que la longitud es potencia de 2
    if ((n & (n - 1)) !== 0) {
      throw new Error("La longitud del buffer debe ser potencia de 2 para DWT");
    }
    
    const result = new Array(n).fill(0);
    const half = n / 2;
    
    // Calcular coeficientes de aproximación y detalle
    for (let i = 0; i < half; i++) {
      const idx = i * 2;
      // Coeficientes de aproximación (lowpass)
      result[i] = (signal[idx] + signal[idx + 1]) / Math.SQRT2;
      // Coeficientes de detalle (highpass)
      result[i + half] = (signal[idx] - signal[idx + 1]) / Math.SQRT2;
    }
    
    // Recursivamente aplicar DWT a los coeficientes de aproximación
    if (half > 1) {
      const approx = result.slice(0, half);
      const transformedApprox = this.discreteWaveletTransform(approx);
      for (let i = 0; i < half; i++) {
        result[i] = transformedApprox[i];
      }
    }
    
    return result;
  }
  
  /**
   * Aplicar soft thresholding a los coeficientes wavelet para eliminar ruido
   * @param coefficients Coeficientes wavelet
   * @returns Coeficientes con threshold aplicado
   */
  private softThreshold(coefficients: number[]): number[] {
    const n = coefficients.length;
    const half = n / 2;
    const result = [...coefficients];
    
    // Aplicar thresholding solo a los coeficientes de detalle (alta frecuencia)
    // Los coeficientes de aproximación (bajas frecuencias) se mantienen intactos
    for (let i = half; i < n; i++) {
      const val = coefficients[i];
      const absVal = Math.abs(val);
      
      if (absVal <= this.THRESHOLD) {
        // Valores por debajo del umbral se eliminan (ruido)
        result[i] = 0;
      } else {
        // Valores por encima del umbral se reducen (soft thresholding)
        result[i] = (val > 0 ? 1 : -1) * (absVal - this.THRESHOLD);
      }
    }
    
    return result;
  }
  
  /**
   * Transformada wavelet inversa para reconstruir la señal
   * @param coefficients Coeficientes wavelet
   * @returns Señal reconstruida
   */
  private inverseWaveletTransform(coefficients: number[]): number[] {
    const n = coefficients.length;
    if (n === 1) return coefficients;
    
    const half = n / 2;
    const result = new Array(n).fill(0);
    
    // Si hay más de un nivel, reconstruir primero los niveles inferiores
    if (half > 1) {
      const approxCoeffs = coefficients.slice(0, half);
      const reconstructedApprox = this.inverseWaveletTransform(approxCoeffs);
      for (let i = 0; i < half; i++) {
        coefficients[i] = reconstructedApprox[i];
      }
    }
    
    // Reconstruir la señal a partir de coeficientes de aproximación y detalle
    for (let i = 0; i < half; i++) {
      const approx = coefficients[i];
      const detail = coefficients[i + half];
      
      // Reconstrucción inversa de Haar
      result[i * 2] = (approx + detail) / Math.SQRT2;
      result[i * 2 + 1] = (approx - detail) / Math.SQRT2;
    }
    
    return result;
  }
  
  /**
   * Reinicia el filtro
   */
  public reset(): void {
    this.signalBuffer = new Array(this.BUFFER_SIZE).fill(0);
  }
}
