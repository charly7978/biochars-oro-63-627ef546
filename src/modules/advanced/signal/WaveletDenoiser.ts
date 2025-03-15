
/**
 * Implementación simplificada de filtro wavelet
 * con umbralización mínima para preservar señal
 */

export class WaveletDenoiser {
  // Parámetros del wavelet con poca intensidad de filtrado
  private threshold: number = 0.01; // Umbral muy bajo
  private waveletFamily: string = 'db4'; // Daubechies 4
  private decompositionLevel: number = 2; // Nivel reducido
  
  // Buffer de valores
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 32;
  
  // Coeficientes wavelet
  private readonly COEFF_LP = [0.1629, 0.5055, 0.4461, -0.0198, -0.1323, 0.0218];
  private readonly COEFF_HP = [-0.0218, -0.1323, 0.0198, 0.4461, -0.5055, 0.1629];
  
  // Estado del filtro
  private adaptiveThreshold: number = 0.01; // Umbral muy bajo
  private isLowComplexity: boolean = true; // Siempre usar algoritmo simple
  
  constructor() {
    console.log('Filtro Wavelet inicializado con umbral mínimo para máxima preservación de señal');
  }
  
  /**
   * Filtra mínimamente para preservar señal
   */
  public denoise(value: number): number {
    // Almacenar en buffer
    this.buffer.push(value);
    
    // Mantener tamaño de buffer
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Si no tenemos suficientes muestras, devolver el valor original
    if (this.buffer.length < 5) {
      return value;
    }
    
    // Uso exclusivo de algoritmo simplificado
    return this.simplifiedDenoise(value);
  }
  
  /**
   * Denoising simplificado con filtrado mínimo
   */
  private simplifiedDenoise(value: number): number {
    // Calcular media móvil simple de ventana pequeña
    const recentValues = this.buffer.slice(-4);
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    
    // Umbral muy bajo, casi sin filtrado
    const localThreshold = 0.01;
    
    // Si la diferencia del valor con la media es muy grande, aplicar atenuación mínima
    if (Math.abs(value - mean) > 20) {
      const direction = value > mean ? 1 : -1;
      return value - direction * localThreshold; // Atenuación mínima
    }
    
    // De lo contrario, mantener valor original
    return value;
  }
  
  /**
   * Actualiza los parámetros del filtro con sensibilidad mínima
   */
  public updateParameters(signalQuality: number): void {
    // Umbral mínimo para preservar señal
    this.adaptiveThreshold = 0.01;
    
    // Nivel bajo de descomposición
    this.decompositionLevel = 2;
  }
  
  /**
   * Siempre usa modo de baja complejidad
   */
  public setLowComplexity(enabled: boolean): void {
    this.isLowComplexity = true;
    this.decompositionLevel = 2;
  }
  
  /**
   * Restablece parámetros a valores de filtrado mínimo
   */
  public resetToDefaults(): void {
    this.threshold = 0.01;
    this.adaptiveThreshold = 0.01;
    this.decompositionLevel = 2;
    this.buffer = [];
  }
}
