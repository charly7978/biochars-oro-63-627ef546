
/**
 * Optimizador de Señal PPG
 * Mejora la calidad de señales PPG para cálculos precisos
 */

import { EventType, eventBus } from '../events/EventBus';
import { ProcessedPPGData } from '../types/signal';
import { 
  SignalProcessingFilters,
  applySimpleMovingAverage, 
  applyLowPassFilter, 
  removeLinearTrend,
  normalizeValues,
  detectSignalQuality,
  detectFinger
} from '../utils/SignalProcessingFilters';

class SignalOptimizer {
  // Estado interno
  private isRunning: boolean = false;
  private processingQueue: ProcessedPPGData[] = [];
  private processingInterval: number | null = null;
  private bufferSize: number = 150;
  private valueBuffer: number[] = [];
  private lastOptimizedValue: number = 0;
  
  /**
   * Iniciar el optimizador
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processingInterval = window.setInterval(() => {
      this.processQueue();
    }, 50); // Procesar cada 50ms
    
    console.log('SignalOptimizer: Iniciado');
  }
  
  /**
   * Detener el optimizador
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.processingInterval !== null) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    console.log('SignalOptimizer: Detenido');
  }
  
  /**
   * Reiniciar el optimizador
   */
  public reset(): void {
    this.processingQueue = [];
    this.valueBuffer = [];
    this.lastOptimizedValue = 0;
    
    console.log('SignalOptimizer: Reiniciado');
  }
  
  /**
   * Optimizar un dato PPG
   */
  public optimizeSignal(ppgData: ProcessedPPGData): ProcessedPPGData {
    if (!this.isRunning) {
      // Si no está ejecutándose, iniciar
      this.start();
    }
    
    // Añadir a la cola de procesamiento
    this.processingQueue.push({...ppgData});
    
    // Optimización básica (sin tener que esperar a la cola)
    const rawValue = ppgData.rawValue;
    
    // Detectar presencia de dedo
    const fingerDetected = detectFinger(rawValue);
    
    // Actualizar buffer
    this.valueBuffer.push(rawValue);
    if (this.valueBuffer.length > this.bufferSize) {
      this.valueBuffer.shift();
    }
    
    // Aplicar filtros básicos
    let filteredValue = rawValue;
    if (this.valueBuffer.length > 5) {
      // Aplicar media móvil simple
      const smoothedValues = applySimpleMovingAverage(this.valueBuffer.slice(-5));
      filteredValue = smoothedValues[smoothedValues.length - 1];
      
      // Aplicar filtro de paso bajo
      const lowPassValues = applyLowPassFilter([this.lastOptimizedValue, filteredValue], 0.3);
      filteredValue = lowPassValues[1];
    }
    
    this.lastOptimizedValue = filteredValue;
    
    // Calcular calidad de señal
    const signalQuality = detectSignalQuality({
      ...ppgData,
      filteredValue,
      fingerDetected
    });
    
    // Crear y retornar señal optimizada
    const optimizedData: ProcessedPPGData = {
      timestamp: ppgData.timestamp,
      rawValue: ppgData.rawValue,
      filteredValue,
      fingerDetected,
      quality: signalQuality
    };
    
    // Publicar dato optimizado
    eventBus.publish(EventType.SIGNAL_OPTIMIZED, optimizedData);
    
    return optimizedData;
  }
  
  /**
   * Procesar la cola de procesamiento
   * (procesamiento más intensivo que puede realizarse de manera asíncrona)
   */
  private processQueue(): void {
    if (!this.isRunning || this.processingQueue.length === 0) {
      return;
    }
    
    // Tomar hasta 10 elementos de la cola para procesar en este ciclo
    const batchSize = Math.min(10, this.processingQueue.length);
    const batch = this.processingQueue.splice(0, batchSize);
    
    // Procesar cada elemento
    batch.forEach(data => {
      this.performAdvancedOptimization(data);
    });
  }
  
  /**
   * Realizar optimización avanzada de señal
   * (operaciones más intensivas en recursos)
   */
  private performAdvancedOptimization(data: ProcessedPPGData): void {
    // En un sistema real, aquí realizaríamos:
    // - Filtrado adaptativo
    // - Análisis de componentes
    // - Segmentación de señal
    // - Etc.
    
    // Por ahora, simplemente notificamos
    eventBus.publish(EventType.SIGNAL_PROCESSED, {
      ...data,
      advancedProcessing: true
    });
  }
}

// Exportar instancia singleton
export const signalOptimizer = new SignalOptimizer();
