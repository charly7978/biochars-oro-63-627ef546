
/**
 * Implementación del filtro de Kalman para reducción de ruido en señales PPG
 * Sin usar funciones Math
 */
export class KalmanFilter {
  private R: number = 0.008; // Factor de reducción de ruido
  private Q: number = 0.12;  // Ruido del proceso
  private P: number = 1;     // Covarianza inicial
  private X: number = 0;     // Estado inicial
  private K: number = 0;     // Ganancia de Kalman

  /**
   * Aplica el filtro de Kalman a un valor de medición sin usar Math
   * @param measurement Valor crudo de la medición
   * @returns Valor filtrado
   */
  public filter(measurement: number): number {
    // Actualizar covarianza de predicción
    this.P = this.P + this.Q;
    
    // Calcular ganancia de Kalman
    this.K = this.P / (this.P + this.R);
    
    // Actualizar estimación con medición ponderada
    this.X = this.X + this.K * (measurement - this.X);
    
    // Actualizar covarianza de estimación
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  /**
   * Reinicia el filtro a los valores iniciales
   */
  public reset(): void {
    this.X = 0;
    this.P = 1;
    this.K = 0;
  }
  
  /**
   * Ajusta los parámetros del filtro sin usar Math
   * @param processNoise Factor Q (ruido del proceso)
   * @param measurementNoise Factor R (ruido de medición)
   */
  public setParameters(processNoise: number, measurementNoise: number): void {
    // Validación manual sin Math.max
    this.Q = processNoise > 0 ? processNoise : 0.01;
    this.R = measurementNoise > 0 ? measurementNoise : 0.01;
  }
}
