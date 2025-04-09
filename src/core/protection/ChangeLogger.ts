
/**
 * Registrador de Cambios
 * 
 * Este componente registra todos los intentos de cambio, cambios exitosos,
 * fallos y rollbacks en el sistema.
 */

import { ChangeLogEntry } from './types';
import { CircularBufferPool, objectBufferPool } from '../../utils/CircularBufferPool';

export class ChangeLogger {
  private log: ChangeLogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 1000;
  
  // Añadir soporte para búfer circular reutilizable
  private useMemoryOptimization = true;
  private memoryOptimized: boolean;
  
  constructor() {
    // Verificar si la optimización de memoria está disponible
    this.memoryOptimized = this.useMemoryOptimization && typeof objectBufferPool !== 'undefined';
    
    if (this.memoryOptimized) {
      this.log = objectBufferPool.getBuffer(this.MAX_LOG_ENTRIES) as ChangeLogEntry[];
    } else {
      this.log = [];
    }
  }
  
  /**
   * Registra un intento de cambio
   */
  public logChangeAttempt(
    context: { fileName: string; moduleName: string; },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'attempt'
    });
  }
  
  /**
   * Registra un cambio exitoso
   */
  public logSuccessfulChange(
    context: { fileName: string; moduleName: string; },
    timestamp: Date,
    details: Record<string, any>
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'success',
      details
    });
  }
  
  /**
   * Registra una verificación
   */
  public logVerification(
    context: { fileName: string; moduleName: string; },
    timestamp: Date,
    details: Record<string, any>
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'verification',
      details
    });
  }
  
  /**
   * Registra un rollback
   */
  public logRollback(
    context: { fileName: string; moduleName: string; },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'rollback'
    });
  }
  
  /**
   * Registra un fallo de cambio
   */
  public logChangeFailure(
    context: { fileName: string; moduleName: string; },
    timestamp: Date,
    error: string | Error
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'failure',
      details: {
        error: error instanceof Error ? error.message : error
      }
    });
  }
  
  /**
   * Registra una aplicación de cambio
   */
  public logChangeApplication(
    context: { fileName: string; moduleName: string; },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'success'
    });
  }
  
  /**
   * Añade una entrada al log y limita el tamaño
   * Utiliza optimización de memoria cuando está disponible
   */
  private addLogEntry(entry: ChangeLogEntry): void {
    if (this.memoryOptimized) {
      // Con memoria optimizada, reutilizamos el mismo array
      // y desplazamos los elementos si está lleno
      if (this.log.length >= this.MAX_LOG_ENTRIES) {
        // Desplazar elementos para hacer espacio (más eficiente que slice)
        for (let i = 0; i < this.MAX_LOG_ENTRIES - 1; i++) {
          this.log[i] = this.log[i + 1];
        }
        this.log[this.MAX_LOG_ENTRIES - 1] = entry;
      } else {
        this.log.push(entry);
      }
    } else {
      // Comportamiento estándar
      this.log.push(entry);
      
      // Limitar tamaño del log
      if (this.log.length > this.MAX_LOG_ENTRIES) {
        this.log = this.log.slice(-this.MAX_LOG_ENTRIES);
      }
    }
  }
  
  /**
   * Obtiene todas las entradas del log
   */
  public getLog(): ChangeLogEntry[] {
    // Si estamos en modo optimizado, debemos filtrar los elementos no utilizados
    if (this.memoryOptimized) {
      return this.log.filter(entry => entry !== null && entry !== undefined);
    }
    return [...this.log];
  }
  
  /**
   * Obtiene las entradas del log para un archivo específico
   */
  public getLogForFile(fileName: string): ChangeLogEntry[] {
    return this.log.filter(entry => 
      entry && entry.context && entry.context.fileName === fileName
    );
  }
  
  /**
   * Obtiene las entradas del log para un tipo específico
   */
  public getLogByType(type: ChangeLogEntry['type']): ChangeLogEntry[] {
    return this.log.filter(entry => entry && entry.type === type);
  }
  
  /**
   * Obtiene las entradas del log en un rango de tiempo
   */
  public getLogInTimeRange(startTime: Date, endTime: Date): ChangeLogEntry[] {
    return this.log.filter(entry => 
      entry && entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }
  
  /**
   * Limpia el log
   */
  public clearLog(): void {
    if (this.memoryOptimized) {
      // En modo optimizado, devolvemos el búfer al pool para reutilización
      objectBufferPool.releaseBuffer(this.log);
      this.log = objectBufferPool.getBuffer(this.MAX_LOG_ENTRIES) as ChangeLogEntry[];
    } else {
      this.log = [];
    }
  }
  
  /**
   * Obtiene estadísticas del log
   */
  public getLogStats(): {
    totalEntries: number;
    attemptCount: number;
    successCount: number;
    failureCount: number;
    rollbackCount: number;
    verificationCount: number;
    topModules: { moduleName: string; count: number }[];
  } {
    const validEntries = this.log.filter(entry => entry != null);
    
    const attemptCount = validEntries.filter(entry => entry.type === 'attempt').length;
    const successCount = validEntries.filter(entry => entry.type === 'success').length;
    const failureCount = validEntries.filter(entry => entry.type === 'failure').length;
    const rollbackCount = validEntries.filter(entry => entry.type === 'rollback').length;
    const verificationCount = validEntries.filter(entry => entry.type === 'verification').length;
    
    // Contar entradas por módulo
    const moduleCountMap = new Map<string, number>();
    validEntries.forEach(entry => {
      if (entry.context && entry.context.moduleName) {
        const count = moduleCountMap.get(entry.context.moduleName) || 0;
        moduleCountMap.set(entry.context.moduleName, count + 1);
      }
    });
    
    // Crear lista ordenada de módulos
    const topModules = Array.from(moduleCountMap.entries())
      .map(([moduleName, count]) => ({ moduleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalEntries: validEntries.length,
      attemptCount,
      successCount,
      failureCount,
      rollbackCount,
      verificationCount,
      topModules
    };
  }
}
