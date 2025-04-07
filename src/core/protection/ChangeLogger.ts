
/**
 * Registrador de Cambios
 * 
 * Este componente registra todos los intentos de cambio, cambios exitosos,
 * fallos y rollbacks en el sistema.
 */

import { ChangeLogEntry } from './types';

export class ChangeLogger {
  private log: ChangeLogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 1000;
  
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
   */
  private addLogEntry(entry: ChangeLogEntry): void {
    this.log.push(entry);
    
    // Limitar tamaño del log
    if (this.log.length > this.MAX_LOG_ENTRIES) {
      this.log = this.log.slice(-this.MAX_LOG_ENTRIES);
    }
  }
  
  /**
   * Obtiene todas las entradas del log
   */
  public getLog(): ChangeLogEntry[] {
    return [...this.log];
  }
  
  /**
   * Obtiene las entradas del log para un archivo específico
   */
  public getLogForFile(fileName: string): ChangeLogEntry[] {
    return this.log.filter(entry => entry.context.fileName === fileName);
  }
  
  /**
   * Limpia el log
   */
  public clearLog(): void {
    this.log = [];
  }
}
