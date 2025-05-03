
/**
 * Implementación del filtro de Kalman para señales PPG
 */
export class KalmanFilter {
  // Estados del filtro
  private x: number = 0; // Estimación del estado
  private p: number = 1; // Incertidumbre de la estimación
  private q: number = 0.01; // Ruido del proceso
  private r: number = 0.1; // Ruido de la medición
  private k: number = 0; // Ganancia de Kalman
  private firstMeasure: boolean = true;
  
  constructor() {}
  
  /**
   * Reiniciar el filtro
   */
  public reset(): void {
    this.x = 0;
    this.p = 1;
    this.k = 0;
    this.firstMeasure = true;
  }
  
  /**
   * Aplicar filtro a un nuevo valor
   */
  public filter(measurement: number): number {
    // Para la primera medición, inicializar estado
    if (this.firstMeasure) {
      this.x = measurement;
      this.firstMeasure = false;
      return measurement;
    }
    
    // Predicción
    const p_pred = this.p + this.q;
    
    // Actualización
    this.k = p_pred / (p_pred + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * p_pred;
    
    return this.x;
  }
  
  /**
   * Configurar ruido de proceso
   */
  public setProcessNoise(q: number): void {
    if (q > 0) this.q = q;
  }
  
  /**
   * Configurar ruido de medición
   */
  public setMeasurementNoise(r: number): void {
    if (r > 0) this.r = r;
  }
}
