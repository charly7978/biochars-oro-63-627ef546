
/**
 * Administrador de ventana deslizante para intervalos RR
 * Permite almacenar y analizar intervalos temporales entre latidos cardíacos
 * 
 * IMPORTANTE: Este componente SOLO utiliza datos reales, no simulaciones.
 */

export class ArrhythmiaWindowManager {
  private intervals: number[] = [];
  private readonly maxSize: number;
  
  constructor(maxSize: number = 30) {
    this.maxSize = maxSize;
  }
  
  /**
   * Añade un nuevo intervalo RR a la ventana
   */
  public addInterval(interval: number): void {
    // Validar intervalo (debe ser positivo y fisiológicamente plausible)
    if (interval <= 0 || interval > 2000) return;
    
    this.intervals.push(interval);
    
    // Mantener tamaño de ventana
    if (this.intervals.length > this.maxSize) {
      this.intervals.shift();
    }
  }
  
  /**
   * Obtiene todos los intervalos almacenados
   */
  public getAllIntervals(): number[] {
    return [...this.intervals];
  }
  
  /**
   * Obtiene los N intervalos más recientes
   */
  public getRecentIntervals(count: number): number[] {
    const startIndex = Math.max(0, this.intervals.length - count);
    return this.intervals.slice(startIndex);
  }
  
  /**
   * Calcula la variabilidad RR (RMSSD) de la ventana actual
   */
  public calculateRMSSD(): number {
    if (this.intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < this.intervals.length; i++) {
      const diff = this.intervals[i] - this.intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (this.intervals.length - 1));
  }
  
  /**
   * Calcula el ritmo cardíaco promedio basado en los intervalos
   */
  public calculateAverageHeartRate(): number {
    if (this.intervals.length === 0) return 0;
    
    const avgInterval = this.intervals.reduce((sum, interval) => sum + interval, 0) / 
                        this.intervals.length;
    
    // Convertir de ms a BPM
    return Math.round(60000 / avgInterval);
  }
  
  /**
   * Verifica si hay un patrón de arritmia específico
   */
  public hasArrhythmiaPattern(pattern: 'irregular' | 'bigeminy' | 'trigeminy'): boolean {
    if (this.intervals.length < 4) return false;
    
    // Calcular promedio
    const mean = this.calculateAverage();
    
    if (pattern === 'irregular') {
      // Contar intervalos irregulares (>20% de desviación)
      let irregularCount = 0;
      
      for (let i = 1; i < this.intervals.length; i++) {
        const percentDiff = Math.abs(this.intervals[i] - this.intervals[i-1]) / this.intervals[i-1];
        if (percentDiff > 0.2) {
          irregularCount++;
        }
      }
      
      return irregularCount / (this.intervals.length - 1) > 0.5;
    }
    
    if (pattern === 'bigeminy') {
      // Verificar patrón corto-largo alternante
      for (let i = 2; i < this.intervals.length; i += 2) {
        const shortLongPattern = (
          this.intervals[i-2] < mean * 0.9 &&
          this.intervals[i-1] > mean * 1.1 &&
          this.intervals[i] < mean * 0.9
        );
        
        if (!shortLongPattern) {
          return false;
        }
      }
      
      return true;
    }
    
    if (pattern === 'trigeminy') {
      // Patrón con un latido prematuro cada tres
      for (let i = 3; i < this.intervals.length; i += 3) {
        const trigeminyPattern = (
          Math.abs(this.intervals[i-3] - mean) < mean * 0.1 &&
          Math.abs(this.intervals[i-2] - mean) < mean * 0.1 &&
          this.intervals[i-1] < mean * 0.7 &&
          Math.abs(this.intervals[i] - mean) < mean * 0.1
        );
        
        if (!trigeminyPattern) {
          return false;
        }
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Limpia todos los intervalos almacenados
   */
  public clear(): void {
    this.intervals = [];
  }
  
  /**
   * Calcula el promedio de los intervalos
   */
  private calculateAverage(): number {
    if (this.intervals.length === 0) return 0;
    return this.intervals.reduce((sum, val) => sum + val, 0) / this.intervals.length;
  }
}
