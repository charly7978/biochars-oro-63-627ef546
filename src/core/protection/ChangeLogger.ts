
/**
 * Registrador de Cambios
 * 
 * Implementa un registro detallado de cada modificación,
 * mantiene un historial de cambios con timestamps.
 */

import { ChangeLogEntry } from './types';

export class ChangeLogger {
  private logs: ChangeLogEntry[] = [];
  private maxLogs: number = 100;
  
  constructor() {
    console.log('Registrador de Cambios inicializado');
  }
  
  /**
   * Registra un intento de cambio
   */
  public logChangeAttempt(
    context: { fileName: string; moduleName: string },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'attempt',
      details: {
        attemptTimestamp: timestamp.toISOString()
      }
    });
    
    console.log(`[${timestamp.toISOString()}] Intento de cambio en ${context.fileName}`);
  }
  
  /**
   * Registra un cambio exitoso
   */
  public logSuccessfulChange(
    context: { fileName: string; moduleName: string },
    timestamp: Date,
    details: Record<string, any>
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'success',
      details
    });
    
    console.log(`[${timestamp.toISOString()}] Cambio exitoso en ${context.fileName}`);
  }
  
  /**
   * Registra un cambio fallido
   */
  public logFailedChange(
    context: { fileName: string; moduleName: string },
    timestamp: Date,
    error: string | Error
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'failure',
      details: {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    console.error(`[${timestamp.toISOString()}] Cambio fallido en ${context.fileName}:`, 
                 error instanceof Error ? error.message : error);
  }
  
  /**
   * Registra una aplicación de cambio
   */
  public logChangeApplication(
    context: { fileName: string; moduleName: string },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'success',
      details: {
        applicationTimestamp: timestamp.toISOString()
      }
    });
    
    console.log(`[${timestamp.toISOString()}] Cambio aplicado en ${context.fileName}`);
  }
  
  /**
   * Registra un rollback
   */
  public logRollback(
    context: { fileName: string; moduleName: string },
    timestamp: Date
  ): void {
    this.addLogEntry({
      timestamp,
      context,
      type: 'rollback',
      details: {
        rollbackTimestamp: timestamp.toISOString()
      }
    });
    
    console.log(`[${timestamp.toISOString()}] Rollback en ${context.fileName}`);
  }
  
  /**
   * Agrega una entrada al registro
   */
  private addLogEntry(entry: ChangeLogEntry): void {
    this.logs.push(entry);
    
    // Limitar el tamaño del registro
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // En un sistema real, también podríamos persistir el registro
    this.persistLogEntry(entry);
  }
  
  /**
   * Persiste una entrada de registro (para implementación futura)
   */
  private persistLogEntry(entry: ChangeLogEntry): void {
    // En una implementación real, aquí guardaríamos el registro en almacenamiento persistente
    // Por ahora, solo lo imprimimos en la consola
    const logDetails = {
      timestamp: entry.timestamp.toISOString(),
      file: entry.context.fileName,
      module: entry.context.moduleName,
      type: entry.type,
      details: entry.details
    };
    
    // Imprimir en consola
    if (entry.type === 'failure' || entry.type === 'rollback') {
      console.warn('Log detallado:', JSON.stringify(logDetails, null, 2));
    }
  }
  
  /**
   * Obtiene los últimos registros
   */
  public getRecentLogs(count: number = 10): ChangeLogEntry[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Obtiene registros filtrados
   */
  public getFilteredLogs(filter: {
    type?: 'attempt' | 'success' | 'failure' | 'rollback';
    fileName?: string;
    moduleName?: string;
    fromDate?: Date;
    toDate?: Date;
  }): ChangeLogEntry[] {
    return this.logs.filter(entry => {
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.fileName && !entry.context.fileName.includes(filter.fileName)) return false;
      if (filter.moduleName && !entry.context.moduleName.includes(filter.moduleName)) return false;
      if (filter.fromDate && entry.timestamp < filter.fromDate) return false;
      if (filter.toDate && entry.timestamp > filter.toDate) return false;
      return true;
    });
  }
}
