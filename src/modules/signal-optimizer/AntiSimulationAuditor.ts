/**
 * Auditoría automatizada periódica y escudo contra duplicación y simulación de datos
 * Puede integrarse en cualquier procesador, hook o componente
 */

export type AuditAlert = {
  type: 'DUPLICATION' | 'SIMULATION' | 'CONSTANT_VALUES' | 'NON_PHYSIOLOGICAL_PATTERN';
  message: string;
  timestamp: number;
  details?: any;
};

export class AntiSimulationAuditor {
  private static instance: AntiSimulationAuditor;
  private auditLog: AuditAlert[] = [];
  private lastAuditTime: number = 0;
  private readonly AUDIT_INTERVAL_MS = 5000; // Auditoría cada 5 segundos

  private constructor() {}

  public static getInstance(): AntiSimulationAuditor {
    if (!AntiSimulationAuditor.instance) {
      AntiSimulationAuditor.instance = new AntiSimulationAuditor();
    }
    return AntiSimulationAuditor.instance;
  }

  /**
   * Llama periódicamente para auditar buffers de señal y resultados
   * Puede integrarse en cualquier ciclo de procesamiento
   */
  public auditSignalBuffer(buffer: number[], context: string = 'unknown'): void {
    if (buffer.length < 10) return;
    const now = Date.now();
    if (now - this.lastAuditTime < this.AUDIT_INTERVAL_MS) return;
    this.lastAuditTime = now;

    // 1. Detección de duplicación (valores idénticos en secuencia)
    const duplicates = buffer.filter((v, i, arr) => i > 0 && v === arr[i-1]);
    if (duplicates.length > buffer.length * 0.7) {
      this.raiseAlert({
        type: 'DUPLICATION',
        message: `Detección de duplicación en buffer (${context})`,
        timestamp: now,
        details: { buffer: buffer.slice(-20) }
      });
    }

    // 2. Detección de valores constantes (sin variación fisiológica)
    const min = Math.min(...buffer);
    const max = Math.max(...buffer);
    if (max - min < 0.001) {
      this.raiseAlert({
        type: 'CONSTANT_VALUES',
        message: `Valores constantes detectados en buffer (${context})`,
        timestamp: now,
        details: { min, max, buffer: buffer.slice(-20) }
      });
    }

    // 3. Detección de patrones no fisiológicos (secuencias lineales, saltos abruptos, etc.)
    const diffs = buffer.slice(1).map((v, i) => v - buffer[i]);
    const abruptJumps = diffs.filter(d => Math.abs(d) > 2 * (max - min));
    if (abruptJumps.length > buffer.length * 0.2) {
      this.raiseAlert({
        type: 'NON_PHYSIOLOGICAL_PATTERN',
        message: `Saltos abruptos no fisiológicos en buffer (${context})`,
        timestamp: now,
        details: { diffs: diffs.slice(-20) }
      });
    }
  }

  /**
   * Llama para auditar resultados de métricas
   */
  public auditResult(value: number, context: string = 'unknown'): void {
    // Ejemplo: valores fuera de rango fisiológico
    if (value < 0 || value > 300) {
      this.raiseAlert({
        type: 'SIMULATION',
        message: `Valor fuera de rango fisiológico (${context}): ${value}`,
        timestamp: Date.now(),
        details: { value }
      });
    }
  }

  /**
   * Hook para integración en procesadores/componentes
   */
  public auditHook(buffer: number[], result: number, context: string): void {
    this.auditSignalBuffer(buffer, context);
    this.auditResult(result, context);
  }

  /**
   * Registrar alerta y log
   */
  private raiseAlert(alert: AuditAlert): void {
    this.auditLog.push(alert);
    // Aquí puedes integrar notificaciones, logs externos, o UI admin
    if (typeof window !== 'undefined') {
      // Notificación visual (opcional)
      if (window && window.console) {
        window.console.warn('ALERTA DE AUDITORÍA:', alert);
      }
    }
  }

  /**
   * Consultar el log de auditoría
   */
  public getAuditLog(): AuditAlert[] {
    return [...this.auditLog];
  }

  /**
   * Limpiar el log de auditoría
   */
  public clearAuditLog(): void {
    this.auditLog = [];
  }
} 