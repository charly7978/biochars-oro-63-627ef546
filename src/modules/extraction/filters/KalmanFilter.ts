
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Implementación de Filtro Kalman adaptativo para procesamiento de señales
 */

/**
 * Configuración del filtro Kalman
 */
export interface KalmanFilterConfig {
  processNoise: number;  // Q: varianza del ruido del proceso
  measurementNoise: number;  // R: varianza del ruido de medición
  estimatedError: number;  // P: error de estimación inicial
  enableAdaptiveParameters: boolean;  // Ajuste adaptativo de parámetros
  adaptationRate: number;  // Tasa de adaptación para parámetros
  useWasmAcceleration: boolean;  // Uso de aceleración WASM
}

/**
 * Estado del filtro Kalman
 */
export interface KalmanState {
  estimate: number;  // Estimación actual (x)
  covariance: number;  // Covarianza del error (P)
  processNoise: number;  // Ruido del proceso (Q)
  measurementNoise: number;  // Ruido de medición (R)
  gain: number;  // Ganancia Kalman (K)
}

/**
 * Filtro Kalman real para procesamiento de señales
 */
export class KalmanFilter {
  private config: KalmanFilterConfig;
  private state: KalmanState;
  private lastMeasurements: number[] = [];
  private readonly MAX_MEASUREMENTS = 30;
  private adaptiveCounter: number = 0;
  
  // Configuración por defecto optimizada para señales PPG
  private readonly DEFAULT_CONFIG: KalmanFilterConfig = {
    processNoise: 0.01,
    measurementNoise: 0.1,
    estimatedError: 1.0,
    enableAdaptiveParameters: true,
    adaptationRate: 0.01,
    useWasmAcceleration: true
  };
  
  /**
   * Constructor
   */
  constructor(config?: Partial<KalmanFilterConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...(config || {})
    };
    
    this.state = {
      estimate: 0,
      covariance: this.config.estimatedError,
      processNoise: this.config.processNoise,
      measurementNoise: this.config.measurementNoise,
      gain: 0
    };
    
    console.log("KalmanFilter: Inicializado con configuración", this.config);
  }
  
  /**
   * Filtra un valor con Kalman
   */
  public filter(measurement: number): number {
    // Almacenar medición para análisis adaptativo
    this.lastMeasurements.push(measurement);
    if (this.lastMeasurements.length > this.MAX_MEASUREMENTS) {
      this.lastMeasurements.shift();
    }
    
    // Actualizar parámetros adaptativos si está habilitado
    if (this.config.enableAdaptiveParameters) {
      this.adaptiveCounter++;
      
      // Actualizar cada 10 mediciones para evitar cálculos excesivos
      if (this.adaptiveCounter >= 10) {
        this.updateAdaptiveParameters();
        this.adaptiveCounter = 0;
      }
    }
    
    // Predicción
    // P = P + Q
    this.state.covariance = this.state.covariance + this.state.processNoise;
    
    // Corrección
    // K = P / (P + R)
    this.state.gain = this.state.covariance / (this.state.covariance + this.state.measurementNoise);
    
    // x = x + K * (measurement - x)
    this.state.estimate = this.state.estimate + this.state.gain * (measurement - this.state.estimate);
    
    // P = (1 - K) * P
    this.state.covariance = (1 - this.state.gain) * this.state.covariance;
    
    return this.state.estimate;
  }
  
  /**
   * Actualiza parámetros del filtro de forma adaptativa
   */
  private updateAdaptiveParameters(): void {
    if (this.lastMeasurements.length < 10) return;
    
    // Calcular varianza de las mediciones recientes
    const mean = this.lastMeasurements.reduce((sum, val) => sum + val, 0) / this.lastMeasurements.length;
    const variance = this.lastMeasurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.lastMeasurements.length;
    
    // Si hay alta varianza, aumentar el ruido de medición
    // para reducir la influencia de datos ruidosos
    if (variance > 0.1) {
      const targetNoise = Math.min(variance * 0.5, 1.0);
      this.state.measurementNoise = this.state.measurementNoise * (1 - this.config.adaptationRate) + 
                                   targetNoise * this.config.adaptationRate;
    }
    // Si hay baja varianza, reducir el ruido de medición
    // para dar más peso a las mediciones confiables
    else {
      const targetNoise = Math.max(variance * 2, 0.01);
      this.state.measurementNoise = this.state.measurementNoise * (1 - this.config.adaptationRate) + 
                                   targetNoise * this.config.adaptationRate;
    }
    
    // Ajustar el ruido del proceso basado en la tendencia reciente
    // Calcular tendencia (diferencia promedio entre mediciones consecutivas)
    let totalTrend = 0;
    for (let i = 1; i < this.lastMeasurements.length; i++) {
      totalTrend += Math.abs(this.lastMeasurements[i] - this.lastMeasurements[i-1]);
    }
    const avgTrend = totalTrend / (this.lastMeasurements.length - 1);
    
    // Si hay tendencia fuerte, aumentar el ruido del proceso
    // para que el filtro responda más rápido a cambios
    if (avgTrend > 0.05) {
      const targetProcessNoise = Math.min(avgTrend * 0.5, 0.1);
      this.state.processNoise = this.state.processNoise * (1 - this.config.adaptationRate) + 
                               targetProcessNoise * this.config.adaptationRate;
    }
    // Si hay tendencia débil, reducir el ruido del proceso
    // para estabilizar la salida
    else {
      const targetProcessNoise = Math.max(avgTrend * 0.5, 0.001);
      this.state.processNoise = this.state.processNoise * (1 - this.config.adaptationRate) + 
                               targetProcessNoise * this.config.adaptationRate;
    }
  }
  
  /**
   * Filtra un array de valores
   */
  public filterArray(measurements: number[]): number[] {
    return measurements.map(measurement => this.filter(measurement));
  }
  
  /**
   * Obtiene el estado actual del filtro
   */
  public getState(): KalmanState {
    return { ...this.state };
  }
  
  /**
   * Actualiza la configuración del filtro
   */
  public updateConfig(config: Partial<KalmanFilterConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Si se desactiva el modo adaptativo, restaurar valores originales
    if (config.enableAdaptiveParameters === false) {
      this.state.processNoise = this.config.processNoise;
      this.state.measurementNoise = this.config.measurementNoise;
    }
    
    console.log("KalmanFilter: Configuración actualizada", this.config);
  }
  
  /**
   * Reinicia el filtro a valores iniciales
   */
  public reset(): void {
    this.state = {
      estimate: 0,
      covariance: this.config.estimatedError,
      processNoise: this.config.processNoise,
      measurementNoise: this.config.measurementNoise,
      gain: 0
    };
    
    this.lastMeasurements = [];
    this.adaptiveCounter = 0;
  }
}

/**
 * Crea una instancia del filtro Kalman
 */
export const createKalmanFilter = (
  config?: Partial<KalmanFilterConfig>
): KalmanFilter => {
  return new KalmanFilter(config);
};
