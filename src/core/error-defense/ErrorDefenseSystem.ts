
/**
 * Sistema Integral de Defensa contra Errores
 * 
 * Este sistema centraliza la detección, prevención y mitigación de errores
 * para mantener la integridad del código en todo momento.
 */

import { toast } from "sonner";
import { logSignalProcessing, LogLevel } from '@/utils/signalLogging';
import { getErrorStats, performSystemDiagnostics } from '@/utils/signalLogging';

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

// Tipo de datos para contramedidas automáticas
interface Countermeasure {
  id: string;
  category: ErrorCategory;
  patterns: string[];
  action: (error: SystemError) => void;
  description: string;
  lastApplied?: number;
  successRate: number;
  timesApplied: number;
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
  appliedCountermeasures?: string[];
}

// Interfaz para estrategias de recuperación
interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableCategories: ErrorCategory[];
  condition: (error: SystemError) => boolean;
  action: (error: SystemError) => boolean;
  lastApplied: number;
  cooldownMs: number;
  successCount: number;
  failCount: number;
}

// Tipos de mecanismos de contención
type IsolationMechanism = {
  domain: string;
  activationThreshold: number;
  autoReset: boolean;
  resetIntervalMs: number;
  lastTripped: number;
  isActive: boolean;
  errorCount: number;
  description: string;
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
  
  // Estrategias de recuperación
  private recoveryStrategies: RecoveryStrategy[] = [];
  
  // Contramedidas automáticas
  private countermeasures: Countermeasure[] = [];
  
  // Mecanismos de aislamiento para contención de fallos
  private isolationMechanisms: Record<string, IsolationMechanism> = {};
  
  // Base de conocimiento de patrones de error
  private knownErrorPatterns: Map<string, {
    occurrences: number;
    lastSeen: number;
    solutions: string[];
    category: ErrorCategory;
    associatedErrors: string[];
  }> = new Map();
  
  // Registro de estado del sistema
  private systemStatus: {
    isHealthy: boolean;
    lastHealthCheck: number;
    healthHistory: { timestamp: number; isHealthy: boolean; issues: string[] }[];
    componentRegistry: Map<string, { status: 'healthy' | 'degraded' | 'failed', lastUpdated: number }>;
    errorDomainStats: Record<string, { count: number, lastError: number }>;
  } = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    healthHistory: [],
    componentRegistry: new Map(),
    errorDomainStats: {}
  };

  private constructor() {
    this.initializeRecoveryStrategies();
    this.initializeCountermeasures();
    this.initializeIsolationMechanisms();
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
   * Inicializa estrategias de recuperación para diferentes tipos de errores
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        id: "tensor-memory-cleanup",
        name: "Limpieza de memoria de TensorFlow",
        description: "Libera tensores y memoria utilizada por TensorFlow",
        applicableCategories: [ErrorCategory.PERFORMANCE, ErrorCategory.RUNTIME],
        condition: (error) => 
          error.message.includes('memory') || 
          error.message.includes('tensor') ||
          error.message.includes('out of memory') ||
          (error.source && error.source.includes('tf')),
        action: () => {
          try {
            if (typeof window !== 'undefined' && (window as any).tf) {
              (window as any).tf.engine().endScope();
              (window as any).tf.engine().startScope();
              (window as any).tf.disposeVariables();
              return true;
            }
          } catch (e) {
            console.error('Error durante limpieza de memoria TensorFlow:', e);
          }
          return false;
        },
        lastApplied: 0,
        cooldownMs: 30000, // 30 segundos entre aplicaciones
        successCount: 0,
        failCount: 0
      },
      {
        id: "processor-reset",
        name: "Reinicio de procesadores de señal",
        description: "Reinicia los procesadores de señal para resolver inconsistencias",
        applicableCategories: [ErrorCategory.OPERATIONAL, ErrorCategory.RUNTIME],
        condition: (error) => 
          error.source.includes('Processor') || 
          error.source.includes('processor') ||
          error.source.includes('Detection') ||
          error.source.includes('detector'),
        action: () => {
          try {
            if (typeof window !== 'undefined') {
              let success = false;
              
              if ((window as any).heartBeatProcessor) {
                (window as any).heartBeatProcessor.reset();
                success = true;
              }
              
              if ((window as any).signalProcessor) {
                (window as any).signalProcessor.reset();
                success = true;
              }
              
              if ((window as any).vitalSignsProcessor) {
                (window as any).vitalSignsProcessor.reset();
                success = true;
              }
              
              return success;
            }
          } catch (e) {
            console.error('Error durante reinicio de procesadores:', e);
          }
          return false;
        },
        lastApplied: 0,
        cooldownMs: 15000, // 15 segundos entre reinicios
        successCount: 0,
        failCount: 0
      },
      {
        id: "storage-cleanup",
        name: "Limpieza de almacenamiento local",
        description: "Elimina datos de almacenamiento local que pueden causar inconsistencias",
        applicableCategories: [ErrorCategory.OPERATIONAL, ErrorCategory.DEPENDENCY],
        condition: (error) => 
          error.message.includes('storage') || 
          error.message.includes('localStorage') ||
          error.message.includes('state') ||
          error.message.includes('inconsistent'),
        action: () => {
          try {
            if (typeof window !== 'undefined' && localStorage) {
              localStorage.removeItem('arrhythmia_detection_state');
              localStorage.removeItem('signal_processor_state');
              localStorage.removeItem('vital_signs_state');
              return true;
            }
          } catch (e) {
            console.error('Error durante limpieza de almacenamiento:', e);
          }
          return false;
        },
        lastApplied: 0,
        cooldownMs: 60000, // 1 minuto entre limpiezas
        successCount: 0,
        failCount: 0
      }
    ];
  }
  
  /**
   * Inicializa contramedidas automáticas para diferentes tipos de errores
   */
  private initializeCountermeasures(): void {
    this.countermeasures = [
      {
        id: "signal-quality-adaption",
        category: ErrorCategory.OPERATIONAL,
        patterns: ['weak signal', 'señal débil', 'calidad de señal', 'signal quality'],
        action: () => {
          // Ajustar umbrales de calidad de señal
          try {
            if (typeof window !== 'undefined') {
              if ((window as any).signalQualityThreshold) {
                (window as any).signalQualityThreshold *= 0.9; // Reducir umbral un 10%
              }
            }
          } catch (e) {
            console.error('Error al ajustar umbrales de calidad:', e);
          }
        },
        description: "Ajusta automáticamente los umbrales de calidad de señal",
        successRate: 1.0,
        timesApplied: 0
      },
      {
        id: "peak-detection-recalibration",
        category: ErrorCategory.RUNTIME,
        patterns: ['detección de picos', 'peak detection', 'falsos positivos', 'false peaks'],
        action: () => {
          // Recalibrar detector de picos
          try {
            if (typeof window !== 'undefined') {
              if ((window as any).peakDetector && (window as any).peakDetector.recalibrate) {
                (window as any).peakDetector.recalibrate();
              }
            }
          } catch (e) {
            console.error('Error al recalibrar detector de picos:', e);
          }
        },
        description: "Recalibra automáticamente los algoritmos de detección de picos",
        successRate: 0.8,
        timesApplied: 0
      },
      {
        id: "arrhythmia-false-positive-reduction",
        category: ErrorCategory.OPERATIONAL,
        patterns: ['falsa arritmia', 'false arrhythmia', 'false positive'],
        action: () => {
          // Ajustar sensibilidad de detector de arritmias
          try {
            if (typeof window !== 'undefined') {
              if ((window as any).arrhythmiaDetector && (window as any).arrhythmiaDetector.adjustSensitivity) {
                (window as any).arrhythmiaDetector.adjustSensitivity(0.8); // Reducir sensibilidad
              }
            }
          } catch (e) {
            console.error('Error al ajustar sensibilidad de arritmias:', e);
          }
        },
        description: "Reduce la sensibilidad para minimizar falsos positivos en arritmias",
        successRate: 0.7,
        timesApplied: 0
      }
    ];
  }
  
  /**
   * Inicializa mecanismos de aislamiento para contención de fallos
   */
  private initializeIsolationMechanisms(): void {
    this.isolationMechanisms = {
      "tensorFlowOperations": {
        domain: "tensorflow",
        activationThreshold: 5,
        autoReset: true,
        resetIntervalMs: 120000, // 2 minutos
        lastTripped: 0,
        isActive: false,
        errorCount: 0,
        description: "Limita operaciones de TensorFlow cuando hay errores frecuentes"
      },
      "signalProcessingOperations": {
        domain: "signalProcessing",
        activationThreshold: 3,
        autoReset: true,
        resetIntervalMs: 60000, // 1 minuto
        lastTripped: 0,
        isActive: false,
        errorCount: 0,
        description: "Limita operaciones complejas de procesamiento de señal"
      },
      "storageOperations": {
        domain: "storage",
        activationThreshold: 4,
        autoReset: true,
        resetIntervalMs: 120000, // 2 minutos
        lastTripped: 0,
        isActive: false,
        errorCount: 0,
        description: "Limita operaciones de almacenamiento cuando hay errores"
      }
    };
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
      
      // Monitorizar problemas de rendimiento
      if ('PerformanceObserver' in window) {
        try {
          const perfObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              // Solo reportar entradas con tiempos realmente largos (>1000ms)
              if (entry.duration > 1000) {
                this.reportError({
                  id: this.generateErrorId(),
                  timestamp: Date.now(),
                  category: ErrorCategory.PERFORMANCE,
                  severity: ErrorSeverity.LOW,
                  message: `Problema de rendimiento: ${entry.name} tomó ${entry.duration.toFixed(2)}ms`,
                  source: 'performance',
                  metadata: { performanceEntry: entry }
                });
              }
            }
          });
          
          perfObserver.observe({ type: 'longtask', buffered: true });
        } catch (e) {
          console.warn('PerformanceObserver no soportado o error al inicializar:', e);
        }
      }
      
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
    
    // Verificar mecanismos de aislamiento activos
    Object.entries(this.isolationMechanisms)
      .filter(([_, mechanism]) => mechanism.isActive)
      .forEach(([name, mechanism]) => {
        const timeActive = now - mechanism.lastTripped;
        if (timeActive > 300000) { // Activo por más de 5 minutos
          issues.push(`Mecanismo de aislamiento "${name}" activo por tiempo prolongado (${Math.round(timeActive/60000)} min)`);
        }
      });
    
    // Ejecutar autocomprobación de patrones de error recurrentes
    const recurringPatterns = this.analyzeErrorPatterns();
    if (recurringPatterns.length > 0) {
      issues.push(`${recurringPatterns.length} patrones de error recurrentes detectados`);
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
    
    // Ejecutar auto-recuperación para mecanismos de aislamiento
    this.updateIsolationMechanisms(now);
    
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
    
    // Ejecutar diagnóstico completo
    const diagnostics = performSystemDiagnostics();
    
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
    
    // Aplicar recomendaciones de forma automática si son críticas
    if (diagnostics.systemHealth === 'critical' || diagnostics.systemHealth === 'degraded') {
      this.applyAutomaticRecovery(diagnostics);
    }
  }
  
  /**
   * Aplica recuperación automática basada en diagnóstico
   */
  private applyAutomaticRecovery(diagnostics: any): void {
    console.log('Iniciando recuperación automática basada en diagnóstico:', diagnostics.systemHealth);
    
    // Aplicar solo medidas no invasivas
    if (diagnostics.recommendations.some(rec => rec.includes('Reiniciar procesadores'))) {
      this.resetProcessors();
    }
    
    if (diagnostics.recommendations.some(rec => rec.includes('verificaciones de integridad'))) {
      this.verifySystemIntegrity();
    }
  }
  
  /**
   * Verifica la integridad general del sistema
   */
  private verifySystemIntegrity(): void {
    logSignalProcessing(
      LogLevel.INFO,
      'SystemIntegrity',
      'Verificando integridad del sistema...'
    );
    
    // Verificar disposición correcta de recursos
    try {
      if (typeof window !== 'undefined' && (window as any).tf) {
        const numTensors = (window as any).tf.memory().numTensors;
        if (numTensors > 1000) {
          console.warn('Posible fuga de tensores detectada:', numTensors);
          // Intentar liberar memoria
          (window as any).tf.engine().endScope();
          (window as any).tf.engine().startScope();
        }
      }
    } catch (e) {
      console.error('Error durante verificación de tensores:', e);
    }
    
    // Verificar almacenamiento
    try {
      if (localStorage) {
        // Verificar si hay demasiados elementos guardados
        if (localStorage.length > 50) {
          console.warn('Gran cantidad de elementos en localStorage:', localStorage.length);
        }
      }
    } catch (e) {
      console.error('Error al verificar localStorage:', e);
    }
  }
  
  /**
   * Analiza patrones de error para identificar problemas recurrentes
   */
  private analyzeErrorPatterns(): string[] {
    const now = Date.now();
    const recentErrors = this.getRecentErrors(300000); // Últimos 5 minutos
    const patterns: string[] = [];
    
    // Agrupar por fuente
    const errorsBySource: Record<string, SystemError[]> = {};
    
    recentErrors.forEach(error => {
      const source = error.source || 'unknown';
      if (!errorsBySource[source]) {
        errorsBySource[source] = [];
      }
      errorsBySource[source].push(error);
    });
    
    // Analizar fuentes con múltiples errores
    Object.entries(errorsBySource).forEach(([source, errors]) => {
      if (errors.length >= 3) {
        // Buscar patrones en mensajes
        const messages = errors.map(e => e.message);
        const commonSubstrings = this.findCommonSubstrings(messages);
        
        if (commonSubstrings.length > 0) {
          // Registrar el patrón
          const patternKey = `${source}:${commonSubstrings[0]}`;
          
          if (!this.knownErrorPatterns.has(patternKey)) {
            this.knownErrorPatterns.set(patternKey, {
              occurrences: 1,
              lastSeen: now,
              solutions: ['Reiniciar el componente', 'Verificar dependencias'],
              category: errors[0].category,
              associatedErrors: errors.map(e => e.id)
            });
          } else {
            const pattern = this.knownErrorPatterns.get(patternKey)!;
            pattern.occurrences++;
            pattern.lastSeen = now;
            pattern.associatedErrors = [
              ...new Set([...pattern.associatedErrors, ...errors.map(e => e.id)])
            ];
            this.knownErrorPatterns.set(patternKey, pattern);
          }
          
          patterns.push(`Patrón detectado en ${source}: "${commonSubstrings[0]}"`);
        }
      }
    });
    
    return patterns;
  }
  
  /**
   * Encuentra subcadenas comunes en una lista de mensajes
   */
  private findCommonSubstrings(strings: string[]): string[] {
    if (strings.length < 2) return [];
    
    // Simplificar y normalizar strings
    const normalized = strings.map(s => 
      s.toLowerCase()
       .replace(/[0-9]+/g, 'N')
       .replace(/["']/g, '')
    );
    
    // Buscar subcadenas comunes de al menos 5 caracteres
    const minLength = 5;
    const commonSubstrings = new Set<string>();
    
    for (let i = 0; i < normalized.length - 1; i++) {
      const str1 = normalized[i];
      
      for (let j = i + 1; j < normalized.length; j++) {
        const str2 = normalized[j];
        
        for (let start = 0; start <= str1.length - minLength; start++) {
          for (let len = minLength; len <= str1.length - start; len++) {
            const substr = str1.substr(start, len);
            if (str2.includes(substr)) {
              commonSubstrings.add(substr);
            }
          }
        }
      }
    }
    
    // Filtrar subcadenas que son subconjuntos de otras
    const result: string[] = [];
    const sortedSubstrings = Array.from(commonSubstrings).sort((a, b) => b.length - a.length);
    
    for (let i = 0; i < sortedSubstrings.length; i++) {
      let isSubset = false;
      
      for (let j = 0; j < result.length; j++) {
        if (result[j].includes(sortedSubstrings[i])) {
          isSubset = true;
          break;
        }
      }
      
      if (!isSubset) {
        result.push(sortedSubstrings[i]);
      }
      
      // Limitar a los 3 patrones más relevantes
      if (result.length >= 3) break;
    }
    
    return result;
  }
  
  /**
   * Actualiza mecanismos de aislamiento para contención de fallos
   */
  private updateIsolationMechanisms(now: number): void {
    Object.entries(this.isolationMechanisms).forEach(([name, mechanism]) => {
      // Verificar si debe auto-resetear
      if (mechanism.isActive && mechanism.autoReset && 
          (now - mechanism.lastTripped > mechanism.resetIntervalMs)) {
        mechanism.isActive = false;
        mechanism.errorCount = 0;
        
        logSignalProcessing(
          LogLevel.INFO,
          'FaultIsolation',
          `Mecanismo de aislamiento "${name}" desactivado automáticamente`
        );
      }
    });
  }
  
  /**
   * Incrementa el contador de errores para un dominio específico
   */
  private incrementDomainErrorCount(source: string): void {
    const domain = this.determineDomain(source);
    
    if (!this.systemStatus.errorDomainStats[domain]) {
      this.systemStatus.errorDomainStats[domain] = {
        count: 0,
        lastError: Date.now()
      };
    }
    
    this.systemStatus.errorDomainStats[domain].count++;
    this.systemStatus.errorDomainStats[domain].lastError = Date.now();
    
    // Verificar si debe activar mecanismo de aislamiento
    this.checkIsolationThresholds(domain);
  }
  
  /**
   * Determina el dominio funcional basado en la fuente del error
   */
  private determineDomain(source: string): string {
    const lowerSource = source.toLowerCase();
    
    if (lowerSource.includes('tensor') || lowerSource.includes('tf') || lowerSource.includes('model')) {
      return 'tensorflow';
    }
    
    if (lowerSource.includes('processor') || lowerSource.includes('signal') || 
        lowerSource.includes('detection') || lowerSource.includes('filter')) {
      return 'signalProcessing';
    }
    
    if (lowerSource.includes('storage') || lowerSource.includes('cache') || 
        lowerSource.includes('localStorage') || lowerSource.includes('save')) {
      return 'storage';
    }
    
    return 'general';
  }
  
  /**
   * Verifica umbrales para activar mecanismos de aislamiento
   */
  private checkIsolationThresholds(domain: string): void {
    const relevantMechanism = Object.entries(this.isolationMechanisms)
      .find(([_, mechanism]) => mechanism.domain === domain);
    
    if (!relevantMechanism) return;
    
    const [name, mechanism] = relevantMechanism;
    
    // Incrementar contador
    mechanism.errorCount++;
    
    // Verificar si debe activar
    if (!mechanism.isActive && mechanism.errorCount >= mechanism.activationThreshold) {
      mechanism.isActive = true;
      mechanism.lastTripped = Date.now();
      
      logSignalProcessing(
        LogLevel.WARN,
        'FaultIsolation',
        `Mecanismo de aislamiento "${name}" activado por errores en dominio "${domain}"`,
        { threshold: mechanism.activationThreshold, count: mechanism.errorCount }
      );
      
      // Notificar activación para acciones correctivas
      console.warn(`Mecanismo de aislamiento activado para dominio ${domain}:`, mechanism);
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
    
    // Incrementar contador para el dominio
    this.incrementDomainErrorCount(error.source);
    
    // Registrar error
    this.errors.unshift(error);
    
    // Intentar aplicar contramedidas antes de notificar
    this.applyCountermeasures(error);
    
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
    
    // Intentar aplicar estrategias de recuperación
    this.applyRecoveryStrategies(error);
  }
  
  /**
   * Aplica contramedidas automáticas basadas en patrones de error
   */
  private applyCountermeasures(error: SystemError): void {
    const appliedCountermeasures: string[] = [];
    
    // Buscar contramedidas aplicables
    this.countermeasures.forEach(countermeasure => {
      // Verificar si la categoría coincide
      if (countermeasure.category === error.category) {
        // Verificar si algún patrón coincide con el mensaje
        const patternMatch = countermeasure.patterns.some(pattern => 
          error.message.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (patternMatch) {
          try {
            // Aplicar la contramedida
            countermeasure.action(error);
            countermeasure.timesApplied++;
            appliedCountermeasures.push(countermeasure.id);
            
            logSignalProcessing(
              LogLevel.INFO,
              'Countermeasure',
              `Contramedida aplicada: ${countermeasure.id}`,
              { error: error.id, description: countermeasure.description }
            );
          } catch (e) {
            console.error(`Error al aplicar contramedida ${countermeasure.id}:`, e);
          }
        }
      }
    });
    
    // Registrar contramedidas aplicadas en el error
    if (appliedCountermeasures.length > 0) {
      error.appliedCountermeasures = appliedCountermeasures;
    }
  }
  
  /**
   * Aplica estrategias de recuperación para el error
   */
  private applyRecoveryStrategies(error: SystemError): void {
    const now = Date.now();
    let recoveryApplied = false;
    
    // Buscar estrategias aplicables
    for (const strategy of this.recoveryStrategies) {
      // Verificar si la categoría coincide
      if (strategy.applicableCategories.includes(error.category)) {
        // Verificar si cumple la condición
        if (strategy.condition(error)) {
          // Verificar si está en período de enfriamiento
          if (now - strategy.lastApplied < strategy.cooldownMs) {
            logSignalProcessing(
              LogLevel.INFO,
              'RecoveryStrategy',
              `Estrategia ${strategy.id} en enfriamiento, omitiendo`,
              { error: error.id, cooldownRemaining: strategy.cooldownMs - (now - strategy.lastApplied) }
            );
            continue;
          }
          
          // Intentar aplicar la estrategia
          try {
            const success = strategy.action(error);
            strategy.lastApplied = now;
            
            if (success) {
              strategy.successCount++;
              recoveryApplied = true;
              error.recovered = true;
              
              logSignalProcessing(
                LogLevel.INFO,
                'RecoveryStrategy',
                `Estrategia ${strategy.id} aplicada con éxito`,
                { error: error.id, description: strategy.description }
              );
              
              // Si ya se aplicó una estrategia con éxito, no seguir intentando más
              break;
            } else {
              strategy.failCount++;
              
              logSignalProcessing(
                LogLevel.WARN,
                'RecoveryStrategy',
                `Estrategia ${strategy.id} falló`,
                { error: error.id }
              );
            }
          } catch (e) {
            console.error(`Error al aplicar estrategia ${strategy.id}:`, e);
            strategy.failCount++;
          }
        }
      }
    }
    
    // Si se aplicó alguna estrategia con éxito, notificar
    if (recoveryApplied) {
      logSignalProcessing(
        LogLevel.INFO,
        'ErrorRecovery',
        `Se aplicó recuperación automática para error: ${error.id}`,
        { error }
      );
      
      // Solo notificar para errores significativos
      if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
        toast.success('Recuperación automática aplicada', {
          description: 'El sistema ha mitigado automáticamente un error.',
          duration: 3000
        });
      }
    }
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
   * Obtiene el estado actual del sistema con estadísticas enriquecidas
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
    },
    isolationMechanisms: {
      active: number;
      total: number;
    }
  } {
    const now = Date.now();
    const recentErrors = this.getRecentErrors(this.ERROR_TIME_WINDOW);
    
    const activeIsolationMechanisms = Object.values(this.isolationMechanisms)
      .filter(mechanism => mechanism.isActive)
      .length;
    
    return {
      isHealthy: this.systemStatus.isHealthy,
      lastHealthCheck: this.systemStatus.lastHealthCheck,
      componentCount: this.systemStatus.componentRegistry.size,
      recentErrors: {
        critical: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
        high: recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        medium: recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        low: recentErrors.filter(e => e.severity === ErrorSeverity.LOW).length
      },
      isolationMechanisms: {
        active: activeIsolationMechanisms,
        total: Object.keys(this.isolationMechanisms).length
      }
    };
  }

  /**
   * Evalúa la eficacia de las estrategias de recuperación
   */
  public evaluateRecoveryStrategies(): any[] {
    return this.recoveryStrategies.map(strategy => {
      const totalAttempts = strategy.successCount + strategy.failCount;
      const successRate = totalAttempts > 0 
        ? (strategy.successCount / totalAttempts) * 100 
        : 0;
        
      return {
        id: strategy.id,
        name: strategy.name,
        successRate: `${successRate.toFixed(1)}%`,
        attempts: totalAttempts,
        lastApplied: strategy.lastApplied > 0 
          ? new Date(strategy.lastApplied).toISOString() 
          : 'Nunca',
        category: strategy.applicableCategories.join(', ')
      };
    });
  }
  
  /**
   * Limpia y resetea completamente el sistema
   */
  public reset(): void {
    this.errors = [];
    this.systemStatus.healthHistory = [];
    this.systemStatus.isHealthy = true;
    this.systemStatus.lastHealthCheck = Date.now();
    this.systemStatus.errorDomainStats = {};
    
    // Resetear mecanismos de aislamiento
    Object.values(this.isolationMechanisms).forEach(mechanism => {
      mechanism.isActive = false;
      mechanism.errorCount = 0;
      mechanism.lastTripped = 0;
    });
    
    console.log('Sistema de defensa contra errores reiniciado completamente');
    
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
  
  /**
   * Obtiene estadísticas de la base de conocimiento de errores
   */
  public getKnowledgeBaseStats(): any {
    const patterns: any[] = [];
    
    this.knownErrorPatterns.forEach((data, key) => {
      patterns.push({
        pattern: key,
        occurrences: data.occurrences,
        lastSeen: new Date(data.lastSeen).toISOString(),
        category: data.category,
        associatedErrors: data.associatedErrors.length
      });
    });
    
    return {
      totalPatterns: patterns.length,
      topPatterns: patterns.sort((a, b) => b.occurrences - a.occurrences).slice(0, 5)
    };
  }
}

export default ErrorDefenseSystem;
