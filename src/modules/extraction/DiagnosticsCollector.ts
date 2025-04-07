
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Canal de diagnóstico separado para el módulo de extracción
 * Permite monitoreo sin interferir con el flujo principal de datos
 */

import { ProcessingPriority } from './CombinedExtractor';

/**
 * Interfaz para datos de diagnóstico
 */
export interface DiagnosticsEntry {
  timestamp: number;
  extractorType: 'combined' | 'ppg' | 'heartbeat' | 'advanced';
  processingTime: number;
  inputAmplitude: number;
  priority: ProcessingPriority;
  memoryUsage?: number;
  queueLength?: number;
}

/**
 * Clase para la recolección y gestión de métricas de diagnóstico
 */
export class DiagnosticsCollector {
  private diagnosticsBuffer: DiagnosticsEntry[] = [];
  private readonly maxDiagnosticsEntries: number;
  private readonly enableDiagnostics: boolean;
  
  constructor(maxEntries: number = 100, enableDiagnostics: boolean = true) {
    this.maxDiagnosticsEntries = maxEntries;
    this.enableDiagnostics = enableDiagnostics;
  }
  
  /**
   * Registra una entrada en el buffer de diagnóstico
   */
  public logDiagnostic(entry: DiagnosticsEntry): void {
    if (!this.enableDiagnostics) return;
    
    this.diagnosticsBuffer.push(entry);
    if (this.diagnosticsBuffer.length > this.maxDiagnosticsEntries) {
      this.diagnosticsBuffer.shift();
    }
  }
  
  /**
   * Obtiene todos los datos de diagnóstico recolectados
   */
  public getDiagnosticsData(): DiagnosticsEntry[] {
    return [...this.diagnosticsBuffer];
  }
  
  /**
   * Limpia el buffer de diagnóstico
   */
  public clearDiagnostics(): void {
    this.diagnosticsBuffer = [];
  }
  
  /**
   * Obtiene estadísticas de rendimiento basadas en datos de diagnóstico
   */
  public getPerformanceMetrics(): {
    avgProcessingTime: number;
    highPriorityPercentage: number;
    mediumPriorityPercentage: number;
    lowPriorityPercentage: number;
    avgMemoryUsage: number;
  } {
    if (this.diagnosticsBuffer.length === 0) {
      return {
        avgProcessingTime: 0,
        highPriorityPercentage: 0,
        mediumPriorityPercentage: 0,
        lowPriorityPercentage: 0,
        avgMemoryUsage: 0
      };
    }
    
    const totalTime = this.diagnosticsBuffer.reduce((sum, entry) => sum + entry.processingTime, 0);
    const highPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.HIGH).length;
    const mediumPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.MEDIUM).length;
    const lowPriorityCount = this.diagnosticsBuffer.filter(entry => entry.priority === ProcessingPriority.LOW).length;
    
    const memoryEntries = this.diagnosticsBuffer.filter(entry => entry.memoryUsage !== undefined);
    const totalMemory = memoryEntries.reduce((sum, entry) => sum + (entry.memoryUsage || 0), 0);
    
    return {
      avgProcessingTime: totalTime / this.diagnosticsBuffer.length,
      highPriorityPercentage: (highPriorityCount / this.diagnosticsBuffer.length) * 100,
      mediumPriorityPercentage: (mediumPriorityCount / this.diagnosticsBuffer.length) * 100,
      lowPriorityPercentage: (lowPriorityCount / this.diagnosticsBuffer.length) * 100,
      avgMemoryUsage: memoryEntries.length > 0 ? totalMemory / memoryEntries.length : 0
    };
  }
  
  /**
   * Activa o desactiva el sistema de diagnóstico
   */
  public setDiagnosticsEnabled(enabled: boolean): void {
    (this as any).enableDiagnostics = enabled;
    if (!enabled) {
      this.clearDiagnostics();
    }
  }
}

/**
 * Crea un recolector de diagnósticos
 */
export const createDiagnosticsCollector = (
  maxEntries: number = 100, 
  enableDiagnostics: boolean = true
): DiagnosticsCollector => {
  return new DiagnosticsCollector(maxEntries, enableDiagnostics);
};
