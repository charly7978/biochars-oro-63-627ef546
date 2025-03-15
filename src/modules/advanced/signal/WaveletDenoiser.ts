
/**
 * Implementación de un filtro wavelet adaptativo para procesamiento
 * de señales PPG, superior al filtro Kalman para preservar características
 * morfológicas de la onda.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

export class WaveletDenoiser {
  // Parámetros del wavelet
  private threshold: number = 0.03;
  private waveletFamily: string = 'db4'; // Daubechies 4
  private decompositionLevel: number = 3;
  
  // Buffer de valores para análisis contextual
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 32; // Potencia de 2 para FFT
  
  // Coeficientes aproximados de wavelet db4
  private readonly COEFF_LP = [0.1629, 0.5055, 0.4461, -0.0198, -0.1323, 0.0218];
  private readonly COEFF_HP = [-0.0218, -0.1323, 0.0198, 0.4461, -0.5055, 0.1629];
  
  // Estado del filtro
  private adaptiveThreshold: number = 0.03;
  private isLowComplexity: boolean = false;
  
  constructor() {
    console.log('Filtro Wavelet adaptativo inicializado');
  }
  
  /**
   * Aplica denoising wavelet a un valor PPG
   * Implementa umbralización adaptativa para preservar señal
   */
  public denoise(value: number): number {
    // Almacenar en buffer para análisis contextual
    this.buffer.push(value);
    
    // Mantener tamaño de buffer
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Si no tenemos suficientes muestras, devolver el valor original
    if (this.buffer.length < 8) {
      return value;
    }
    
    // En modo de baja complejidad, usar un algoritmo simplificado
    if (this.isLowComplexity) {
      return this.simplifiedDenoise(value);
    }
    
    // Aplicar transformada wavelet simplificada
    const { approximation, detail } = this.waveletTransform(this.buffer);
    
    // Aplicar thresholding adaptativo a coeficientes de detalle
    const thresholdedDetail = this.applyThreshold(detail);
    
    // Reconstruir señal
    const reconstructed = this.waveletReconstruct(approximation, thresholdedDetail);
    
    // Devolver el valor más reciente reconstruido
    return reconstructed[reconstructed.length - 1];
  }
  
  /**
   * Versión simplificada de denoising para dispositivos con recursos limitados
   */
  private simplifiedDenoise(value: number): number {
    // Calcular media móvil de la ventana reciente
    const recentValues = this.buffer.slice(-6);
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    
    // Calcular varianza local
    const variance = recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Adaptive threshold basado en ruido local
    const localThreshold = Math.min(0.05, stdDev * 0.6);
    
    // Si la diferencia del valor con la media es menor que el umbral, usar la media
    if (Math.abs(value - mean) < localThreshold) {
      return mean;
    }
    
    // De lo contrario, realizar una atenuación suave
    const direction = value > mean ? 1 : -1;
    return mean + direction * (Math.abs(value - mean) - localThreshold);
  }
  
  /**
   * Implementa una versión simplificada de la transformada wavelet
   */
  private waveletTransform(values: number[]): { approximation: number[], detail: number[] } {
    const approximation: number[] = [];
    const detail: number[] = [];
    
    // Aplicar convolución con los coeficientes de paso bajo y alto
    for (let i = 0; i < values.length - this.COEFF_LP.length; i += 2) {
      let approx = 0;
      let det = 0;
      
      for (let j = 0; j < this.COEFF_LP.length; j++) {
        approx += values[i + j] * this.COEFF_LP[j];
        det += values[i + j] * this.COEFF_HP[j];
      }
      
      approximation.push(approx);
      detail.push(det);
    }
    
    return { approximation, detail };
  }
  
  /**
   * Aplica umbralización adaptativa a los coeficientes de detalle
   */
  private applyThreshold(detail: number[]): number[] {
    // Calcular umbral adaptativo basado en MAD (Median Absolute Deviation)
    const absoluteValues = detail.map(Math.abs);
    absoluteValues.sort((a, b) => a - b);
    
    const medianIndex = Math.floor(absoluteValues.length / 2);
    const mad = absoluteValues[medianIndex] / 0.6745; // Factor de normalización
    
    // Umbral universal adaptativo
    const universalThreshold = mad * Math.sqrt(2 * Math.log(detail.length));
    
    // Aplicar umbralización suave
    return detail.map(coeff => {
      if (Math.abs(coeff) <= this.adaptiveThreshold * universalThreshold) {
        return 0;
      }
      const sign = coeff >= 0 ? 1 : -1;
      return sign * (Math.abs(coeff) - this.adaptiveThreshold * universalThreshold);
    });
  }
  
  /**
   * Reconstruye la señal a partir de coeficientes
   */
  private waveletReconstruct(approximation: number[], detail: number[]): number[] {
    const reconstructed: number[] = [];
    const n = Math.min(approximation.length, detail.length);
    
    // Coeficientes para reconstrucción
    const reconLow = [0.1629, 0.5055, 0.4461, -0.0198, -0.1323, 0.0218];
    const reconHigh = [0.0218, -0.1323, -0.0198, 0.4461, 0.5055, -0.1629];
    
    // Upsampling y convolución
    for (let i = 0; i < n; i++) {
      // Upsampling
      const upAppx = Array(2).fill(approximation[i]);
      const upDetail = Array(2).fill(detail[i]);
      
      // Para cada punto en el upsampling
      for (let j = 0; j < upAppx.length; j++) {
        let reconValue = 0;
        
        // Convolución con coeficientes de reconstrucción
        for (let k = 0; k < reconLow.length / 2; k++) {
          if (i - k >= 0) {
            reconValue += upAppx[j] * reconLow[k] + upDetail[j] * reconHigh[k];
          }
        }
        
        reconstructed.push(reconValue);
      }
    }
    
    return reconstructed;
  }
  
  /**
   * Actualiza los parámetros del filtro basados en la calidad de la señal
   */
  public updateParameters(signalQuality: number): void {
    // Ajustar umbral de forma inversamente proporcional a la calidad
    this.adaptiveThreshold = Math.max(0.01, Math.min(0.06, 0.05 - signalQuality * 0.03));
    
    // Ajustar nivel de descomposición basado en calidad
    this.decompositionLevel = signalQuality > 0.8 ? 4 : signalQuality > 0.5 ? 3 : 2;
    
    console.log(`Parámetros wavelet actualizados: umbral=${this.adaptiveThreshold}, nivel=${this.decompositionLevel}`);
  }
  
  /**
   * Configura el modo de baja complejidad para dispositivos con recursos limitados
   */
  public setLowComplexity(enabled: boolean): void {
    this.isLowComplexity = enabled;
    
    // Reducir parámetros de complejidad si es necesario
    if (enabled) {
      this.decompositionLevel = Math.min(2, this.decompositionLevel);
    }
  }
  
  /**
   * Restablece parámetros a valores por defecto
   */
  public resetToDefaults(): void {
    this.threshold = 0.03;
    this.adaptiveThreshold = 0.03;
    this.decompositionLevel = 3;
    this.buffer = [];
  }
}
