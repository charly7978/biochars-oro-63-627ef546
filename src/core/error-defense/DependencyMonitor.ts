
/**
 * Monitor de Dependencias
 * 
 * Monitorea dependencias críticas y verifica su correcto funcionamiento
 */

import ErrorDefenseSystem, { 
  ErrorCategory, 
  ErrorSeverity 
} from './ErrorDefenseSystem';
import { logSignalProcessing, LogLevel } from '@/utils/signalLogging';

interface DependencyStatus {
  name: string;
  isAvailable: boolean;
  lastChecked: number;
  errorCount: number;
  latency: number | null;
}

class DependencyMonitor {
  private static instance: DependencyMonitor;
  private dependencies: Map<string, DependencyStatus> = new Map();
  private monitorInterval: number | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 segundos
  private readonly MAX_ERROR_COUNT = 3;
  
  private constructor() {
    this.initializeMonitor();
    console.log('DependencyMonitor: Inicializado');
  }
  
  /**
   * Obtener instancia singleton
   */
  public static getInstance(): DependencyMonitor {
    if (!DependencyMonitor.instance) {
      DependencyMonitor.instance = new DependencyMonitor();
    }
    return DependencyMonitor.instance;
  }
  
  /**
   * Inicializar el monitor
   */
  private initializeMonitor(): void {
    // Registrar dependencias críticas
    this.registerDependency('heartBeatProcessor');
    this.registerDependency('signalProcessor');
    this.registerDependency('vitalSignsProcessor');
    this.registerDependency('camera');
    
    // Iniciar verificación periódica
    if (typeof window !== 'undefined' && !this.monitorInterval) {
      this.monitorInterval = window.setInterval(() => {
        this.checkAllDependencies();
      }, this.CHECK_INTERVAL);
    }
  }
  
  /**
   * Registrar una dependencia para monitoreo
   */
  public registerDependency(name: string): void {
    if (!this.dependencies.has(name)) {
      this.dependencies.set(name, {
        name,
        isAvailable: false,
        lastChecked: 0,
        errorCount: 0,
        latency: null
      });
      
      // Verificar inmediatamente
      this.checkDependency(name);
    }
  }
  
  /**
   * Verificar una dependencia específica
   */
  public async checkDependency(name: string): Promise<boolean> {
    if (!this.dependencies.has(name)) {
      this.registerDependency(name);
    }
    
    const status = this.dependencies.get(name)!;
    const startTime = performance.now();
    let isAvailable = false;
    
    try {
      switch (name) {
        case 'heartBeatProcessor':
        case 'signalProcessor':
        case 'vitalSignsProcessor':
          // Verificar procesadores globales
          isAvailable = typeof window !== 'undefined' && 
                        !!(window as any)[name] && 
                        typeof (window as any)[name].reset === 'function';
          break;
          
        case 'camera':
          // Verificar disponibilidad de cámara
          isAvailable = await this.checkCameraAvailability();
          break;
          
        default:
          // Dependencia genérica
          isAvailable = true;
          break;
      }
      
      // Calcular latencia
      const latency = performance.now() - startTime;
      
      // Actualizar estado
      this.dependencies.set(name, {
        ...status,
        isAvailable,
        lastChecked: Date.now(),
        errorCount: isAvailable ? 0 : status.errorCount + 1,
        latency
      });
      
      // Reportar si hay problema
      if (!isAvailable && status.errorCount >= this.MAX_ERROR_COUNT) {
        this.reportDependencyIssue(name);
      }
      
      return isAvailable;
    } catch (error) {
      console.error(`Error verificando dependencia ${name}:`, error);
      
      // Actualizar estado con error
      this.dependencies.set(name, {
        ...status,
        isAvailable: false,
        lastChecked: Date.now(),
        errorCount: status.errorCount + 1,
        latency: null
      });
      
      // Reportar error
      if (status.errorCount >= this.MAX_ERROR_COUNT) {
        this.reportDependencyIssue(name, error);
      }
      
      return false;
    }
  }
  
  /**
   * Verificar disponibilidad de cámara
   */
  private async checkCameraAvailability(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return false;
    }
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error al verificar cámaras:', error);
      return false;
    }
  }
  
  /**
   * Verificar todas las dependencias registradas
   */
  public async checkAllDependencies(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const name of this.dependencies.keys()) {
      const result = await this.checkDependency(name);
      results.set(name, result);
    }
    
    // Registrar resultados
    logSignalProcessing(
      LogLevel.DEBUG,
      'DependencyMonitor',
      'Verificación de dependencias completada',
      {
        results: Object.fromEntries(results),
        timestamp: Date.now()
      }
    );
    
    return results;
  }
  
  /**
   * Reportar problema con una dependencia
   */
  private reportDependencyIssue(name: string, error?: any): void {
    const errorSystem = ErrorDefenseSystem.getInstance();
    
    errorSystem.reportError({
      id: '',
      timestamp: Date.now(),
      category: ErrorCategory.DEPENDENCY,
      severity: ErrorSeverity.HIGH,
      message: `Dependencia no disponible: ${name}`,
      source: 'DependencyMonitor',
      metadata: {
        dependencyName: name,
        error: error ? String(error) : undefined,
        errorCount: this.dependencies.get(name)?.errorCount
      }
    });
    
    // Registrar en logs
    logSignalProcessing(
      LogLevel.ERROR,
      'DependencyMonitor',
      `Dependencia no disponible: ${name}`,
      {
        dependencyName: name,
        error: error ? String(error) : undefined,
        timestamp: Date.now()
      }
    );
  }
  
  /**
   * Obtener estado actual de todas las dependencias
   */
  public getDependenciesStatus(): Record<string, DependencyStatus> {
    const result: Record<string, DependencyStatus> = {};
    
    for (const [name, status] of this.dependencies.entries()) {
      result[name] = {...status};
    }
    
    return result;
  }
  
  /**
   * Reiniciar el monitor
   */
  public reset(): void {
    // Limpiar dependencias
    this.dependencies.clear();
    
    // Reinicializar
    this.initializeMonitor();
    
    console.log('DependencyMonitor: Reiniciado');
  }
  
  /**
   * Cerrar el monitor y liberar recursos
   */
  public shutdown(): void {
    if (this.monitorInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    console.log('DependencyMonitor: Cerrado');
  }
}

export default DependencyMonitor;
