
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Transformador de datos para pre-procesamiento y post-procesamiento de señales
 */
import * as tf from '@tensorflow/tfjs-core';

/**
 * Configuración del transformador de datos
 */
export interface DataTransformerConfig {
  normalizeInput: boolean;
  normalizeRange: [number, number];
  windowSize: number;
  useOverlap: boolean;
  overlapSize: number;
  useCompression: boolean;
  compressionRatio: number;
}

/**
 * Clase para transformación de datos de señal
 */
export class DataTransformer {
  private config: DataTransformerConfig;
  private buffer: number[] = [];
  private windows: number[][] = [];
  private stats: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  
  // Configuración por defecto
  private readonly DEFAULT_CONFIG: DataTransformerConfig = {
    normalizeInput: true,
    normalizeRange: [-1, 1],
    windowSize: 64,
    useOverlap: true,
    overlapSize: 32,
    useCompression: false,
    compressionRatio: 0.5
  };
  
  /**
   * Constructor
   */
  constructor(config?: Partial<DataTransformerConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...(config || {})
    };
    
    this.stats = {
      min: Infinity,
      max: -Infinity,
      mean: 0,
      std: 1
    };
    
    console.log("DataTransformer: Inicializado con configuración", this.config);
  }
  
  /**
   * Añade un valor al buffer
   */
  public addValue(value: number): void {
    // Actualizar estadísticas
    this.stats.min = Math.min(this.stats.min, value);
    this.stats.max = Math.max(this.stats.max, value);
    
    // Actualizar media móvil
    const prevMean = this.stats.mean;
    const n = this.buffer.length;
    this.stats.mean = n === 0 
      ? value 
      : prevMean + (value - prevMean) / (n + 1);
    
    // Actualizar desviación estándar móvil
    if (n > 0) {
      const prevM2 = this.stats.std * this.stats.std * n;
      const m2 = prevM2 + (value - prevMean) * (value - this.stats.mean);
      this.stats.std = Math.sqrt(m2 / (n + 1));
    }
    
    // Añadir al buffer
    this.buffer.push(value);
    
    // Generar ventanas cuando sea necesario
    this.updateWindows();
  }
  
  /**
   * Añade múltiples valores al buffer
   */
  public addValues(values: number[]): void {
    values.forEach(value => this.addValue(value));
  }
  
  /**
   * Actualiza las ventanas de datos
   */
  private updateWindows(): void {
    const { windowSize, useOverlap, overlapSize } = this.config;
    const step = useOverlap ? windowSize - overlapSize : windowSize;
    
    // Si no tenemos suficientes datos para una ventana, no hacer nada
    if (this.buffer.length < windowSize) {
      return;
    }
    
    // Crear ventanas mientras sea posible
    while (this.buffer.length >= windowSize) {
      // Extraer ventana
      const window = this.buffer.slice(0, windowSize);
      this.windows.push(window);
      
      // Eliminar datos procesados según el paso
      this.buffer.splice(0, step);
    }
  }
  
  /**
   * Normaliza un valor según las estadísticas actuales
   */
  public normalizeValue(value: number): number {
    if (!this.config.normalizeInput) return value;
    
    const [targetMin, targetMax] = this.config.normalizeRange;
    const targetRange = targetMax - targetMin;
    
    // Usar Z-score si tenemos suficientes datos
    if (this.buffer.length > 10 && this.stats.std > 0) {
      const zScore = (value - this.stats.mean) / this.stats.std;
      // Convertir Z-score al rango objetivo (generalmente -1 a 1 o 0 a 1)
      return targetMin + (zScore + 2) * targetRange / 4;
    }
    
    // Sino, usar min-max si tenemos un rango
    if (this.stats.max > this.stats.min) {
      const sourceRange = this.stats.max - this.stats.min;
      return targetMin + ((value - this.stats.min) / sourceRange) * targetRange;
    }
    
    // Si no tenemos rango, simplemente devolver el valor
    return value;
  }
  
  /**
   * Desnormaliza un valor al rango original
   */
  public denormalizeValue(value: number): number {
    if (!this.config.normalizeInput) return value;
    
    const [targetMin, targetMax] = this.config.normalizeRange;
    const targetRange = targetMax - targetMin;
    
    // Desnormalizar desde Z-score
    if (this.buffer.length > 10 && this.stats.std > 0) {
      const zScore = ((value - targetMin) * 4 / targetRange) - 2;
      return zScore * this.stats.std + this.stats.mean;
    }
    
    // Desnormalizar desde min-max
    if (this.stats.max > this.stats.min) {
      const sourceRange = this.stats.max - this.stats.min;
      return this.stats.min + ((value - targetMin) / targetRange) * sourceRange;
    }
    
    return value;
  }
  
  /**
   * Obtiene tensores para todas las ventanas disponibles
   */
  public getWindowTensors(): tf.Tensor[] {
    if (this.windows.length === 0) {
      return [];
    }
    
    // Convertir ventanas a tensores
    return this.windows.map(window => {
      // Normalizar ventana si es necesario
      const processedWindow = this.config.normalizeInput 
        ? window.map(v => this.normalizeValue(v))
        : window;
      
      // Aplicar compresión si está habilitada
      const compressedWindow = this.config.useCompression 
        ? this.compressWindow(processedWindow)
        : processedWindow;
      
      // Crear tensor
      return tf.tensor(compressedWindow, [compressedWindow.length, 1]);
    });
  }
  
  /**
   * Comprime una ventana de datos
   */
  private compressWindow(window: number[]): number[] {
    if (!this.config.useCompression) return window;
    
    const targetLength = Math.floor(window.length * this.config.compressionRatio);
    if (targetLength >= window.length) return window;
    
    const result: number[] = [];
    const step = window.length / targetLength;
    
    for (let i = 0; i < targetLength; i++) {
      const pos = Math.floor(i * step);
      const nextPos = Math.min(Math.floor((i + 1) * step), window.length - 1);
      
      // Calcular promedio de valores en el rango
      let sum = 0;
      for (let j = pos; j <= nextPos; j++) {
        sum += window[j];
      }
      
      result.push(sum / (nextPos - pos + 1));
    }
    
    return result;
  }
  
  /**
   * Limpia el buffer y las ventanas
   */
  public clear(): void {
    this.buffer = [];
    this.windows = [];
    
    // Reiniciar estadísticas
    this.stats = {
      min: Infinity,
      max: -Infinity,
      mean: 0,
      std: 1
    };
  }
  
  /**
   * Configura el transformador
   */
  public configure(config: Partial<DataTransformerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Si cambia el tamaño de ventana o solapamiento, limpiar
    if (
      config.windowSize !== undefined || 
      config.useOverlap !== undefined || 
      config.overlapSize !== undefined
    ) {
      this.buffer = [];
      this.windows = [];
    }
    
    console.log("DataTransformer: Configuración actualizada", this.config);
  }
  
  /**
   * Obtiene estadísticas actuales
   */
  public getStats(): any {
    return {
      ...this.stats,
      bufferSize: this.buffer.length,
      windowCount: this.windows.length,
      config: this.config
    };
  }
}

/**
 * Crea una instancia del transformador
 */
export const createDataTransformer = (
  config?: Partial<DataTransformerConfig>
): DataTransformer => {
  return new DataTransformer(config);
};
