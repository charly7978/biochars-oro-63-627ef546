
/**
 * Canal de señal optimizado para procesamiento bidireccional con feedback
 * Diseñado para minimizar uso de CPU y memoria
 */
export class OptimizedSignalChannel {
  private values: number[] = [];
  private readonly maxBufferSize: number;
  private metadata: Map<string, any> = new Map();
  private subscribers: Array<(value: number, metadata: Record<string, any>) => void> = [];
  private feedbackHandlers: Array<(feedback: ChannelFeedback) => void> = [];
  private processingTime: number[] = [];
  private lastProcessingTime: number = 0;
  
  constructor(
    public readonly channelId: string,
    public readonly bufferSize: number = 100
  ) {
    this.maxBufferSize = bufferSize;
  }
  
  /**
   * Añade un valor al canal con gestión de recursos
   */
  public addValue(value: number, metadata: Record<string, any> = {}): void {
    // Medir tiempo de procesamiento
    const startTime = performance.now();
    
    // Añadir valor manteniendo tamaño máximo
    this.values.push(value);
    if (this.values.length > this.maxBufferSize) {
      this.values.shift();
    }
    
    // Actualizar metadata del canal
    Object.entries(metadata).forEach(([key, value]) => {
      this.metadata.set(key, value);
    });
    
    // Notificar a todos los suscriptores
    const metadataObj = this.getMetadataObject();
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(value, metadataObj);
      } catch (error) {
        console.error(`Error en suscriptor de canal ${this.channelId}:`, error);
      }
    });
    
    // Medir y almacenar tiempo de procesamiento
    const endTime = performance.now();
    this.processingTime.push(endTime - startTime);
    
    // Mantener solo los últimos 20 tiempos
    if (this.processingTime.length > 20) {
      this.processingTime.shift();
    }
    
    this.lastProcessingTime = endTime;
  }
  
  /**
   * Suscribirse a los cambios del canal
   */
  public subscribe(callback: (value: number, metadata: Record<string, any>) => void): () => void {
    this.subscribers.push(callback);
    
    // Retornar función para desuscribirse
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }
  
  /**
   * Recibir feedback de otros procesadores
   */
  public addFeedbackHandler(handler: (feedback: ChannelFeedback) => void): () => void {
    this.feedbackHandlers.push(handler);
    
    // Retornar función para eliminar handler
    return () => {
      this.feedbackHandlers = this.feedbackHandlers.filter(h => h !== handler);
    };
  }
  
  /**
   * Aplicar feedback bidireccional para optimizar el canal
   */
  public provideFeedback(feedback: ChannelFeedback): void {
    // Notificar a todos los manejadores de feedback
    this.feedbackHandlers.forEach(handler => {
      try {
        handler(feedback);
      } catch (error) {
        console.error(`Error en handler de feedback de canal ${this.channelId}:`, error);
      }
    });
  }
  
  /**
   * Obtiene todos los valores
   */
  public getValues(): number[] {
    return [...this.values];
  }
  
  /**
   * Obtiene una sección específica de valores
   */
  public getValueSlice(start: number, end?: number): number[] {
    return this.values.slice(start, end);
  }
  
  /**
   * Obtiene el último valor
   */
  public getLastValue(): number | null {
    return this.values.length > 0 ? this.values[this.values.length - 1] : null;
  }
  
  /**
   * Establece un valor de metadata
   */
  public setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }
  
  /**
   * Obtiene un valor de metadata
   */
  public getMetadata(key: string): any {
    return this.metadata.get(key);
  }
  
  /**
   * Obtiene todo el objeto de metadata
   */
  public getMetadataObject(): Record<string, any> {
    const result: Record<string, any> = {};
    this.metadata.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  /**
   * Obtiene estadísticas de rendimiento del canal
   */
  public getPerformanceMetrics(): ChannelPerformanceMetrics {
    const times = this.processingTime;
    if (times.length === 0) {
      return {
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        totalValues: this.values.length,
        bufferUsage: this.values.length / this.maxBufferSize
      };
    }
    
    const sum = times.reduce((a, b) => a + b, 0);
    return {
      avgProcessingTime: sum / times.length,
      maxProcessingTime: Math.max(...times),
      totalValues: this.values.length,
      bufferUsage: this.values.length / this.maxBufferSize
    };
  }
  
  /**
   * Reinicia el canal
   */
  public reset(): void {
    this.values = [];
    this.metadata.clear();
    this.processingTime = [];
  }
}

export interface ChannelFeedback {
  source: string;
  timestamp: number;
  confidenceScore: number;
  calibrationFactor?: number;
  qualityMetrics?: Record<string, any>;
}

export interface ChannelPerformanceMetrics {
  avgProcessingTime: number;
  maxProcessingTime: number;
  totalValues: number;
  bufferUsage: number;
}
