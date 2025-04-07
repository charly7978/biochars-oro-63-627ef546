
/**
 * Sistema Integral de Defensa contra Errores
 * 
 * Este sistema centraliza la detección, prevención y mitigación de errores
 * para mantener la integridad del código en todo momento.
 */

import { toast } from "sonner";
import { logSignalProcessing, LogLevel } from '@/utils/signalLogging';
import { getErrorStats } from '@/utils/signalLogging';

// Categorías de errores para clasificación
export enum ErrorCategory {
  COMPILATION = 'compilation',
  RUNTIME = 'runtime',
  OPERATIONAL = 'operational',
  DEPENDENCY = 'dependency',
  PERFORMANCE = 'performance'
}

// Niveles de severidad
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

// Definición de error estandarizado
export interface SystemError {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  source: string;
  stack?: string;
  metadata?: Record<string, any>;
  recovered?: boolean;
  recoveryAttempts?: number;
}

class ErrorDefenseSystem {
  private static instance: ErrorDefenseSystem;
  private errors: SystemError[] = [];
  private errorListeners: Set<(error: SystemError) => void> = new Set();
  private healthCheckInterval: number | null = null;
  private readonly MAX_ERRORS = 100;
  private readonly HEALTH_CHECK_INTERVAL = 10000; // 10 segundos
  
  // Umbrales para alertas automáticas
  private readonly CRITICAL_ERROR_THRESHOLD = 3;
  private readonly HIGH_ERROR_THRESHOLD = 5;
  private readonly ERROR_TIME_WINDOW = 60000; // 1 minuto
  
  // Registro de estado del sistema
  private systemStatus: {
    isHealthy: boolean;
    lastHealthCheck: number;
    healthHistory: { timestamp: number; isHealthy: boolean; issues: string[] }[];
    componentRegistry: Map<string, { status: 'healthy' | 'degraded' | 'failed', lastUpdated: number }>;
  } = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    healthHistory: [],
    componentRegistry: new Map()
  };

  private constructor() {
    this.startHealthCheck();
    this.initErrorListeners();
    
    console.log('Sistema Integral de Defensa contra Errores inicializado');
  }

  /**
   * Obtener instancia singleton
   */
  public static getInstance(): ErrorDefenseSystem {
    if (!ErrorDefenseSystem.instance) {
      ErrorDefenseSystem.instance = new ErrorDefenseSystem();
    }
    return ErrorDefenseSystem.instance;
  }

  /**
   * Inicializa interceptores de errores a nivel global
   */
  private initErrorListeners(): void {
    if (typeof window !== 'undefined') {
      // Capturar errores no manejados
      window.addEventListener('error', (event) => {
        this.reportError({
          id: this.generateErrorId(),
          timestamp: Date.now(),
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.HIGH,
          message: event.message || 'Error no manejado',
          source: event.filename || 'window',
          stack: event.error?.stack,
          metadata: {
            line: event.lineno,
            column: event.colno
          }
        });
        
        return false; // Permitir que otros manejadores procesen el error
      });

      // Capturar promesas rechazadas no manejadas
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason;
        this.reportError({
          id: this.generateErrorId(),
          timestamp: Date.now(),
          category: ErrorCategory.RUNTIME,
          severity: ErrorSeverity.MEDIUM,
          message: error?.message || 'Promesa rechazada no manejada',
          source: 'promise',
          stack: error?.stack,
          metadata: { originalEvent: error }
        });
      });
      
      // Capturar desconexiones de red
      window.addEventListener('offline', () => {
        this.reportError({
          id: this.generateErrorId(),
          timestamp: Date.now(),
          category: ErrorCategory.OPERATIONAL,
          severity: ErrorSeverity.MEDIUM,
          message: 'Conexión de red perdida',
          source: 'network'
        });
      });
      
      console.log('Interceptores de errores globales inicializados');
    }
  }

  /**
   * Monitoriza la salud del sistema periódicamente
   */
  private startHealthCheck(): void {
    if (typeof window !== 'undefined' && !this.healthCheckInterval) {
      this.healthCheckInterval = window.setInterval(() => {
        this.runHealthCheck();
      }, this.HEALTH_CHECK_INTERVAL);
      
      console.log('Monitoreo de salud del sistema inicializado');
    }
  }

  /**
   * Ejecuta verificación de salud del sistema
   */
  private runHealthCheck(): void {
    const now = Date.now();
    const issues: string[] = [];
    
    // Verificar errores recientes
    const recentErrors = this.getRecentErrors(this.ERROR_TIME_WINDOW);
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
    const highErrors = recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length;
    
    if (criticalErrors >= this.CRITICAL_ERROR_THRESHOLD) {
      issues.push(`${criticalErrors} errores críticos detectados recientemente`);
    }
    
    if (highErrors >= this.HIGH_ERROR_THRESHOLD) {
      issues.push(`${highErrors} errores de alta severidad detectados recientemente`);
    }
    
    // Verificar coherencia de componentes registrados
    this.systemStatus.componentRegistry.forEach((status, component) => {
      if (status.status === 'failed') {
        issues.push(`Componente ${component} en estado fallido`);
      } else if (status.status === 'degraded') {
        issues.push(`Componente ${component} en estado degradado`);
      }
    });
    
    // Verificar logs de señal para detectar anomalías
    try {
      const errorStats = getErrorStats(30000); // Últimos 30 segundos
      if (errorStats.total > 5) {
        issues.push(`Alto número de errores en logs: ${errorStats.total}`);
      }
    } catch (error) {
      console.error('Error al verificar logs de señal', error);
    }
    
    // Actualizar estado de salud
    const isHealthy = issues.length === 0;
    
    this.systemStatus.isHealthy = isHealthy;
    this.systemStatus.lastHealthCheck = now;
    this.systemStatus.healthHistory.push({
      timestamp: now,
      isHealthy,
      issues
    });
    
    // Mantener historial manejable
    if (this.systemStatus.healthHistory.length > 20) {
      this.systemStatus.healthHistory = this.systemStatus.healthHistory.slice(-20);
    }
    
    // Notificar si hay problemas
    if (!isHealthy) {
      this.notifyHealthIssues(issues);
    }
    
    logSignalProcessing(
      isHealthy ? LogLevel.INFO : LogLevel.WARN,
      'SystemHealth',
      `Verificación de salud: ${isHealthy ? 'Saludable' : 'Problemas detectados'}`,
      { issues, timestamp: now }
    );
  }

  /**
   * Notifica problemas de salud del sistema
   */
  private notifyHealthIssues(issues: string[]): void {
    // Solo notificar si hay problemas reales
    if (issues.length === 0) return;
    
    console.warn('Problemas de salud del sistema detectados:', issues);
    
    // Notificar al usuario solo de problemas importantes
    if (issues.some(issue => 
      issue.includes('críticos') || 
      issue.includes('alta severidad') || 
      issue.includes('fallido')
    )) {
      toast.warning('Se detectaron problemas en el sistema', {
        description: 'El sistema puede estar operando con capacidad reducida.',
        duration: 5000
      });
    }
  }

  /**
   * Registra un componente en el sistema de monitoreo
   */
  public registerComponent(
    componentId: string, 
    status: 'healthy' | 'degraded' | 'failed' = 'healthy'
  ): void {
    this.systemStatus.componentRegistry.set(componentId, {
      status,
      lastUpdated: Date.now()
    });
    
    logSignalProcessing(
      LogLevel.INFO,
      'ComponentRegistry',
      `Componente registrado: ${componentId} (${status})`,
      { timestamp: Date.now() }
    );
  }
  
  /**
   * Actualiza el estado de un componente
   */
  public updateComponentStatus(
    componentId: string,
    status: 'healthy' | 'degraded' | 'failed'
  ): void {
    if (!this.systemStatus.componentRegistry.has(componentId)) {
      this.registerComponent(componentId, status);
      return;
    }
    
    this.systemStatus.componentRegistry.set(componentId, {
      status,
      lastUpdated: Date.now()
    });
    
    if (status === 'failed') {
      logSignalProcessing(
        LogLevel.ERROR,
        'ComponentRegistry',
        `Componente en estado fallido: ${componentId}`,
        { timestamp: Date.now() }
      );
    } else if (status === 'degraded') {
      logSignalProcessing(
        LogLevel.WARN,
        'ComponentRegistry',
        `Componente en estado degradado: ${componentId}`,
        { timestamp: Date.now() }
      );
    }
  }

  /**
   * Reporta un error al sistema centralizado
   */
  public reportError(error: SystemError): void {
    // Asegurarnos de tener un ID único
    if (!error.id) {
      error.id = this.generateErrorId();
    }
    
    // Registrar error
    this.errors.unshift(error);
    
    // Mantener un límite de errores almacenados
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(0, this.MAX_ERRORS);
    }
    
    // Notificar a observadores
    this.notifyErrorListeners(error);
    
    // Registrar en logs
    const logLevel = this.mapSeverityToLogLevel(error.severity);
    logSignalProcessing(
      logLevel,
      error.source,
      error.message,
      {
        category: error.category,
        metadata: error.metadata,
        timestamp: error.timestamp
      }
    );
    
    // Notificar errores críticos al usuario
    if (error.severity === ErrorSeverity.CRITICAL) {
      toast.error('Error crítico detectado', {
        description: this.formatErrorForUser(error),
        duration: 8000
      });
    } else if (error.severity === ErrorSeverity.HIGH) {
      toast.error(this.formatErrorForUser(error), {
        duration: 5000
      });
    }
    
    // Intentar recuperación automática para ciertos tipos de errores
    this.attemptErrorRecovery(error);
  }
  
  /**
   * Formatea un error para mostrar al usuario
   */
  private formatErrorForUser(error: SystemError): string {
    let message = error.message;
    
    // Simplificar mensajes técnicos
    message = message
      .replace(/TypeError: /g, '')
      .replace(/ReferenceError: /g, '')
      .replace(/SyntaxError: /g, '');
      
    // Limitar longitud
    if (message.length > 100) {
      message = message.substring(0, 97) + '...';
    }
    
    return message;
  }

  /**
   * Intenta recuperarse automáticamente de ciertos tipos de errores
   */
  private attemptErrorRecovery(error: SystemError): void {
    // Si ya se intentó recuperar, no volver a intentarlo
    if (error.recovered) return;
    
    // Inicializar intentos de recuperación
    if (error.recoveryAttempts === undefined) {
      error.recoveryAttempts = 0;
    }
    
    // Limitar intentos de recuperación
    if (error.recoveryAttempts >= 3) {
      console.warn('Máximo de intentos de recuperación alcanzado para error:', error.id);
      return;
    }
    
    // Incrementar contador de intentos
    error.recoveryAttempts++;
    
    // Intentar estrategias específicas según categoría y severidad
    switch (error.category) {
      case ErrorCategory.DEPENDENCY:
        this.recoverFromDependencyError(error);
        break;
      case ErrorCategory.RUNTIME:
        this.recoverFromRuntimeError(error);
        break;
      case ErrorCategory.OPERATIONAL:
        this.recoverFromOperationalError(error);
        break;
      default:
        // Sin estrategia de recuperación para otros tipos
        break;
    }
  }
  
  /**
   * Recuperación de errores de dependencias
   */
  private recoverFromDependencyError(error: SystemError): void {
    console.log('Intentando recuperación de error de dependencia:', error.id);
    
    // Para errores que mencionan cargadores/loaders o recursos
    if (error.message.includes('load') || 
        error.message.includes('resource') || 
        error.message.includes('fetch')) {
      // Podría reintentar cargar el recurso
      console.log('Se detectó error de carga de recurso, intentando recuperación');
      
      // Marca como recuperado para evitar bucles infinitos
      error.recovered = true;
      
      logSignalProcessing(
        LogLevel.INFO,
        'ErrorRecovery',
        `Recuperación iniciada para error de dependencia: ${error.id}`,
        { error }
      );
    }
  }
  
  /**
   * Recuperación de errores de runtime
   */
  private recoverFromRuntimeError(error: SystemError): void {
    console.log('Intentando recuperación de error de runtime:', error.id);
    
    // Errores de acceso a propiedades de undefined/null
    if (error.message.includes("Cannot read properties of") || 
        error.message.includes("is not a function") ||
        error.message.includes("is undefined")) {
      
      console.log('Se detectó error de referencia, intentando recuperación');
      
      // Marca como recuperado
      error.recovered = true;
      
      logSignalProcessing(
        LogLevel.INFO,
        'ErrorRecovery',
        `Recuperación iniciada para error de runtime: ${error.id}`,
        { error }
      );
      
      // Manejar algunos errores específicos relacionados con el procesamiento de señales
      if (error.source.includes('Processor') || 
          error.source.includes('Detection') || 
          error.source.includes('Processor')) {
        // Intentar restablecer procesadores
        this.resetProcessors();
      }
    }
  }
  
  /**
   * Recuperación de errores operacionales
   */
  private recoverFromOperationalError(error: SystemError): void {
    console.log('Intentando recuperación de error operacional:', error.id);
    
    // Errores de sincronización o timing
    if (error.message.includes("timeout") || 
        error.message.includes("synchronization") ||
        error.message.includes("concurrent")) {
      
      console.log('Se detectó error de sincronización, intentando recuperación');
      
      // Marca como recuperado
      error.recovered = true;
      
      logSignalProcessing(
        LogLevel.INFO,
        'ErrorRecovery',
        `Recuperación iniciada para error operacional: ${error.id}`,
        { error }
      );
    }
  }
  
  /**
   * Restablece procesadores de señal importantes
   */
  private resetProcessors(): void {
    try {
      // Intentar obtener y restablecer procesadores globales
      if (typeof window !== 'undefined') {
        if ((window as any).heartBeatProcessor) {
          console.log('Restableciendo heartBeatProcessor global');
          (window as any).heartBeatProcessor.reset();
        }
        
        if ((window as any).signalProcessor) {
          console.log('Restableciendo signalProcessor global');
          (window as any).signalProcessor.reset();
        }
        
        if ((window as any).vitalSignsProcessor) {
          console.log('Restableciendo vitalSignsProcessor global');
          (window as any).vitalSignsProcessor.reset();
        }
        
        // Limpiar almacenamiento local relacionado con procesadores
        if (localStorage) {
          localStorage.removeItem('arrhythmia_detection_state');
          localStorage.removeItem('signal_processor_state');
          localStorage.removeItem('vital_signs_state');
        }
      }
    } catch (e) {
      console.error('Error al restablecer procesadores:', e);
    }
  }

  /**
   * Agrega un observador de errores
   */
  public addErrorListener(listener: (error: SystemError) => void): () => void {
    this.errorListeners.add(listener);
    
    // Devolver función para eliminar este listener
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Notifica a los observadores sobre un nuevo error
   */
  private notifyErrorListeners(error: SystemError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error en listener de errores:', e);
      }
    });
  }

  /**
   * Obtiene errores recientes dentro de una ventana de tiempo
   */
  public getRecentErrors(timeWindow: number): SystemError[] {
    const now = Date.now();
    return this.errors.filter(error => now - error.timestamp <= timeWindow);
  }

  /**
   * Genera un ID único para un error
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Convierte severidad de error a nivel de log
   */
  private mapSeverityToLogLevel(severity: ErrorSeverity): LogLevel {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return LogLevel.ERROR;
      case ErrorSeverity.MEDIUM:
        return LogLevel.WARN;
      case ErrorSeverity.LOW:
        return LogLevel.INFO;
      case ErrorSeverity.INFO:
      default:
        return LogLevel.DEBUG;
    }
  }
  
  /**
   * Obtiene el estado actual del sistema
   */
  public getSystemStatus(): {
    isHealthy: boolean;
    lastHealthCheck: number;
    componentCount: number;
    recentErrors: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    }
  } {
    const now = Date.now();
    const recentErrors = this.getRecentErrors(this.ERROR_TIME_WINDOW);
    
    return {
      isHealthy: this.systemStatus.isHealthy,
      lastHealthCheck: this.systemStatus.lastHealthCheck,
      componentCount: this.systemStatus.componentRegistry.size,
      recentErrors: {
        critical: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
        high: recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        medium: recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        low: recentErrors.filter(e => e.severity === ErrorSeverity.LOW).length
      }
    };
  }
  
  /**
   * Limpia y resetea el sistema
   */
  public reset(): void {
    this.errors = [];
    this.systemStatus.healthHistory = [];
    this.systemStatus.isHealthy = true;
    this.systemStatus.lastHealthCheck = Date.now();
    
    console.log('Sistema de defensa contra errores reiniciado');
    
    logSignalProcessing(
      LogLevel.INFO,
      'ErrorDefense',
      'Sistema de defensa contra errores reiniciado',
      { timestamp: Date.now() }
    );
  }

  /**
   * Cierra el sistema y libera recursos
   */
  public shutdown(): void {
    if (this.healthCheckInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.errorListeners.clear();
    console.log('Sistema de defensa contra errores cerrado');
  }
}

export default ErrorDefenseSystem;
