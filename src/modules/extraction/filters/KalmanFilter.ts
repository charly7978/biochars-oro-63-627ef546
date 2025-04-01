
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Implementación optimizada del filtro Kalman para procesamiento de señales PPG
 * Incluye adaptación dinámica de parámetros y aceleración WASM
 */
import { getWasmProcessor } from '../wasm/WasmProcessor';

/**
 * Configuración para el filtro Kalman
 */
export interface KalmanFilterConfig {
  // Proceso de ruido (mayor valor -> mayor adaptabilidad a cambios)
  processNoise: number;
  // Ruido de medición (mayor valor -> mayor filtrado)
  measurementNoise: number;
  // Estado inicial estimado
  initialEstimate: number;
  // Covarianza inicial
  initialErrorCovariance: number;
  // Habilitar adaptación de parámetros
  enableAdaptiveParameters: boolean;
  // Usar aceleración WASM
  useWasmAcceleration: boolean;
}

/**
 * Implementación del filtro Kalman para suavizado y reducción de ruido
 */
export class KalmanFilter {
  private config: KalmanFilterConfig;
  private stateEstimate: number;
  private errorCovariance: number;
  private gainHistory: number[] = [];
  private wasmProcessor = getWasmProcessor();
  private wasmInitialized = false;
  
  // Búfer para proceso por lotes
  private buffer: number[] = [];
  private readonly BATCH_SIZE = 30;
  
  /**
   * Constructor
   */
  constructor(config?: Partial<KalmanFilterConfig>) {
    // Configuración por defecto optimizada para señales PPG
    this.config = {
      processNoise: 0.01,
      measurementNoise: 0.1,
      initialEstimate: 0,
      initialErrorCovariance: 1,
      enableAdaptiveParameters: true,
      useWasmAcceleration: true,
      ...config
    };
    
    // Inicializar estado
    this.stateEstimate = this.config.initialEstimate;
    this.errorCovariance = this.config.initialErrorCovariance;
    
    // Inicializar aceleración WASM si está habilitada
    if (this.config.useWasmAcceleration) {
      this.initWasm();
    }
    
    console.log("KalmanFilter: Inicializado con configuración", this.config);
  }
  
  /**
   * Inicializa el procesador WASM para cálculos acelerados
   */
  private async initWasm(): Promise<void> {
    try {
      // Inicializar procesador WASM
      this.wasmInitialized = await this.wasmProcessor.initialize();
      console.log("KalmanFilter: Aceleración WASM inicializada:", this.wasmInitialized);
    } catch (error) {
      console.error("KalmanFilter: Error inicializando WASM", error);
      this.wasmInitialized = false;
    }
  }
  
  /**
   * Filtra un solo valor utilizando el algoritmo Kalman
   */
  public filter(measurement: number): number {
    // Si WASM está habilitado y disponible, procesar con él
    if (this.config.useWasmAcceleration && this.wasmInitialized) {
      // Agregar al búfer para procesamiento por lotes
      this.buffer.push(measurement);
      
      // Si el búfer está lleno, procesar por lotes
      if (this.buffer.length >= this.BATCH_SIZE) {
        const result = this.processWithWasm(this.buffer);
        // Mantener solo el último valor para estado interno
        if (result.length > 0) {
          this.stateEstimate = result[result.length - 1];
        }
        this.buffer = []; // Reiniciar búfer
        return this.stateEstimate;
      }
      
      // Si el búfer no está lleno, procesar con algoritmo estándar
      return this.applyKalmanAlgorithm(measurement);
    } else {
      // Usar algoritmo estándar
      return this.applyKalmanAlgorithm(measurement);
    }
  }
  
  /**
   * Aplica el algoritmo Kalman estándar
   */
  private applyKalmanAlgorithm(measurement: number): number {
    // Actualización de tiempo (predicción)
    let q = this.config.processNoise;
    let r = this.config.measurementNoise;
    
    // Adaptación dinámica de parámetros si está habilitada
    if (this.config.enableAdaptiveParameters) {
      // Ajustar ruido de proceso basado en la varianza reciente
      q = this.adaptProcessNoise();
      // Ajustar ruido de medición basado en la estabilidad reciente
      r = this.adaptMeasurementNoise(measurement);
    }
    
    // Predicción
    this.errorCovariance = this.errorCovariance + q;
    
    // Corrección
    const kalmanGain = this.errorCovariance / (this.errorCovariance + r);
    this.stateEstimate = this.stateEstimate + kalmanGain * (measurement - this.stateEstimate);
    this.errorCovariance = (1 - kalmanGain) * this.errorCovariance;
    
    // Guardar ganancia para adaptación futura
    this.gainHistory.push(kalmanGain);
    if (this.gainHistory.length > 10) {
      this.gainHistory.shift();
    }
    
    return this.stateEstimate;
  }
  
  /**
   * Procesa un lote de valores usando aceleración WASM
   */
  private processWithWasm(values: number[]): number[] {
    try {
      // Usar procesador WASM con configuración actual
      return this.wasmProcessor.applyKalmanFilter(
        values, 
        this.config.processNoise, 
        this.config.measurementNoise
      );
    } catch (error) {
      console.error("KalmanFilter: Error en procesamiento WASM", error);
      
      // Fallback a implementación estándar
      const result: number[] = [];
      for (const value of values) {
        result.push(this.applyKalmanAlgorithm(value));
      }
      return result;
    }
  }
  
  /**
   * Adapta dinámicamente el ruido de proceso basado en la varianza reciente
   */
  private adaptProcessNoise(): number {
    // Si no tenemos suficiente historial, usar valor predeterminado
    if (this.gainHistory.length < 3) {
      return this.config.processNoise;
    }
    
    // Calcular varianza de ganancia reciente
    const mean = this.gainHistory.reduce((a, b) => a + b, 0) / this.gainHistory.length;
    const variance = this.gainHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.gainHistory.length;
    
    // Ajustar ruido de proceso basado en la varianza
    // Alta varianza -> Mayor adaptabilidad
    return Math.max(0.001, Math.min(0.1, this.config.processNoise + variance * 0.2));
  }
  
  /**
   * Adapta dinámicamente el ruido de medición basado en la estabilidad reciente
   */
  private adaptMeasurementNoise(currentMeasurement: number): number {
    // Calcular diferencia con la estimación actual
    const delta = Math.abs(currentMeasurement - this.stateEstimate);
    
    // Ajustar ruido de medición basado en la estabilidad
    // Gran diferencia -> Posible outlier -> Mayor filtrado
    if (delta > 3 * this.config.measurementNoise) {
      return this.config.measurementNoise * 2;
    } else if (delta < 0.5 * this.config.measurementNoise) {
      return Math.max(0.01, this.config.measurementNoise * 0.8);
    }
    
    return this.config.measurementNoise;
  }
  
  /**
   * Obtiene el estado actual
   */
  public getState(): {
    estimate: number;
    covariance: number;
    config: KalmanFilterConfig;
  } {
    return {
      estimate: this.stateEstimate,
      covariance: this.errorCovariance,
      config: { ...this.config }
    };
  }
  
  /**
   * Actualiza la configuración del filtro
   */
  public updateConfig(config: Partial<KalmanFilterConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Reiniciar aceleración WASM si cambió la configuración
    if (config.useWasmAcceleration !== undefined && 
        config.useWasmAcceleration !== this.wasmInitialized) {
      if (config.useWasmAcceleration) {
        this.initWasm();
      } else {
        this.wasmInitialized = false;
      }
    }
  }
  
  /**
   * Reinicia el filtro a los valores iniciales
   */
  public reset(): void {
    this.stateEstimate = this.config.initialEstimate;
    this.errorCovariance = this.config.initialErrorCovariance;
    this.gainHistory = [];
    this.buffer = [];
    console.log("KalmanFilter: Filtro reiniciado");
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
