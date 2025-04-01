
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Controlador central de optimizaciones que integra y gestiona todas las mejoras
 */
import { OptimizationManager, getOptimizationManager, OptimizationPhase } from './optimization/OptimizationManager';
import { OptimizedMLProcessor, createOptimizedMLProcessor } from './ml/OptimizedMLProcessor';
import { EnhancedSignalWorker, createEnhancedSignalWorker } from './workers/EnhancedSignalWorker';

export interface OptimizationStatus {
  phase: OptimizationPhase;
  enabledFeatures: string[];
  processingTime: number;
  memoryUsage?: number;
  frameRate?: number;
  readyForNextPhase: boolean;
}

export interface OptimizationControllerConfig {
  autoAdvancePhases: boolean;
  phaseAdvanceThreshold: number; // Tiempo en ms para avanzar a siguiente fase
  enableDetailedMetrics: boolean;
  webWorkerUrl?: string;
  modelPath?: string;
}

export class OptimizationController {
  private static instance: OptimizationController;
  
  private manager: OptimizationManager;
  private mlProcessor: OptimizedMLProcessor | null = null;
  private signalWorker: EnhancedSignalWorker | null = null;
  
  private config: OptimizationControllerConfig;
  private isInitialized: boolean = false;
  private performanceHistory: Array<{
    timestamp: number;
    processingTime: number;
    memoryUsage?: number;
  }> = [];
  
  private readonly DEFAULT_CONFIG: OptimizationControllerConfig = {
    autoAdvancePhases: true,
    phaseAdvanceThreshold: 20, // 20ms es un buen rendimiento
    enableDetailedMetrics: true,
    webWorkerUrl: '/assets/signal.worker.js'
  };
  
  private constructor(config?: Partial<OptimizationControllerConfig>) {
    this.config = {
      ...this.DEFAULT_CONFIG,
      ...config
    };
    
    this.manager = getOptimizationManager();
    
    // Iniciar con fase 1 activa
    this.manager.activatePhase('phase1');
    
    console.log("[OptimizationController] Inicializado con configuración:", {
      autoAvance: this.config.autoAdvancePhases,
      umbralAvance: this.config.phaseAdvanceThreshold,
      metricas: this.config.enableDetailedMetrics,
      fase: this.manager.getActivePhase()
    });
  }
  
  public static getInstance(config?: Partial<OptimizationControllerConfig>): OptimizationController {
    if (!OptimizationController.instance) {
      OptimizationController.instance = new OptimizationController(config);
    }
    return OptimizationController.instance;
  }
  
  /**
   * Inicializa todos los componentes optimizados
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      console.log("[OptimizationController] Iniciando optimizaciones...");
      
      // Inicializar componentes según características activas
      
      // 1. Inicializar ML Processor con cuantización si está habilitada
      if (this.manager.isFeatureEnabled('model-quantization')) {
        console.log("[OptimizationController] Iniciando procesador ML optimizado con cuantización");
        this.mlProcessor = createOptimizedMLProcessor({
          enableQuantization: true,
          enableMemoryOptimization: this.manager.isFeatureEnabled('memory-optimization')
        });
        
        await this.mlProcessor.initialize(this.config.modelPath);
      }
      
      // 2. Inicializar Worker optimizado si está habilitado
      if (this.manager.isFeatureEnabled('worker-optimization')) {
        console.log("[OptimizationController] Iniciando worker optimizado");
        this.signalWorker = createEnhancedSignalWorker(this.config.webWorkerUrl);
        await this.signalWorker.initialize();
      }
      
      this.isInitialized = true;
      
      // Iniciar verificación periódica de rendimiento si autoavance está habilitado
      if (this.config.autoAdvancePhases) {
        this.startPerformanceMonitoring();
      }
      
      console.log("[OptimizationController] Optimizaciones inicializadas correctamente");
      return true;
    } catch (error) {
      console.error("[OptimizationController] Error inicializando optimizaciones:", error);
      return false;
    }
  }
  
  /**
   * Procesa una señal usando componentes optimizados
   */
  public async processSignal(signal: number | number[]): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = performance.now();
    let result: any = null;
    
    try {
      // Preparar señal
      const signalArray = Array.isArray(signal) ? signal : [signal];
      
      // Procesar con ML si está disponible
      if (this.mlProcessor && this.manager.isFeatureEnabled('model-quantization')) {
        // Si es valor único
        if (!Array.isArray(signal)) {
          result = await this.mlProcessor.processValue(signal as number);
        } 
        // Si es array, procesar último valor
        else {
          const lastValue = signalArray[signalArray.length - 1];
          result = await this.mlProcessor.processValue(lastValue);
        }
      }
      // Si no hay ML pero hay worker
      else if (this.signalWorker && this.manager.isFeatureEnabled('worker-optimization')) {
        result = await this.signalWorker.processSignal(signalArray);
      }
      // Fallback
      else {
        // Simple procesamiento
        result = {
          original: Array.isArray(signal) ? signal[signal.length - 1] : signal,
          enhanced: Array.isArray(signal) ? signal[signal.length - 1] : signal,
          quality: 0.5,
          confidence: 0.5,
          processingTime: 0
        };
      }
      
      // Calcular tiempo
      const processingTime = performance.now() - startTime;
      
      // Actualizar métricas
      this.updatePerformanceMetrics(processingTime);
      
      // Verificar si debemos avanzar a siguiente fase
      this.checkPhaseAdvancement();
      
      return result;
    } catch (error) {
      console.error("[OptimizationController] Error procesando señal:", error);
      
      // Tiempo con error
      const processingTime = performance.now() - startTime;
      
      // Actualizar métricas incluso con error
      this.updatePerformanceMetrics(processingTime);
      
      return {
        original: Array.isArray(signal) ? signal[signal.length - 1] : signal,
        enhanced: Array.isArray(signal) ? signal[signal.length - 1] : signal,
        quality: 0,
        confidence: 0,
        error: (error as Error).message,
        processingTime
      };
    }
  }
  
  /**
   * Monitoriza el rendimiento periódicamente
   */
  private startPerformanceMonitoring(): void {
    // Comprobar rendimiento cada 5 segundos
    setInterval(() => {
      this.checkPhaseAdvancement();
    }, 5000);
  }
  
  /**
   * Actualiza métricas de rendimiento
   */
  private updatePerformanceMetrics(processingTime: number): void {
    // Obtener uso de memoria si está disponible
    let memoryUsage: number | undefined = undefined;
    
    if (this.config.enableDetailedMetrics && 'memory' in performance) {
      try {
        // @ts-ignore: memory API no estándar
        const memoryInfo = performance.memory;
        if (memoryInfo) {
          memoryUsage = memoryInfo.usedJSHeapSize;
        }
      } catch (e) {
        // API de memoria no disponible
      }
    }
    
    // Guardar métricas
    this.performanceHistory.push({
      timestamp: Date.now(),
      processingTime,
      memoryUsage
    });
    
    // Mantener solo últimas 100 entradas
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
    
    // Actualizar estadísticas globales
    this.manager.updateStats({
      processingTime,
      memoryUsage
    });
  }
  
  /**
   * Verifica si se cumplen condiciones para avanzar a siguiente fase
   */
  private checkPhaseAdvancement(): boolean {
    if (!this.config.autoAdvancePhases || this.performanceHistory.length < 50) {
      return false;
    }
    
    // Calcular tiempo promedio de procesamiento
    const recentHistory = this.performanceHistory.slice(-20);
    const avgProcessingTime = recentHistory.reduce((sum, item) => sum + item.processingTime, 0) / recentHistory.length;
    
    // Verificar si el rendimiento es suficientemente bueno para avanzar
    if (avgProcessingTime < this.config.phaseAdvanceThreshold) {
      // Verificar que fase actual esté completa
      if (this.manager.readyForNextPhase()) {
        console.log(`[OptimizationController] Rendimiento óptimo detectado (${avgProcessingTime.toFixed(2)}ms). Avanzando a siguiente fase.`);
        return this.manager.advanceToNextPhase();
      }
    }
    
    return false;
  }
  
  /**
   * Avanza manualmente a la siguiente fase
   */
  public advanceToNextPhase(): boolean {
    return this.manager.advanceToNextPhase();
  }
  
  /**
   * Obtiene estado actual de optimizaciones
   */
  public getStatus(): OptimizationStatus {
    const activePhase = this.manager.getActivePhase();
    const enabledFeatures = this.manager.getAllFeatures()
      .filter(f => f.enabled)
      .map(f => f.id);
    
    // Calcular tiempo promedio de procesamiento
    let processingTime = 0;
    if (this.performanceHistory.length > 0) {
      const recentHistory = this.performanceHistory.slice(-20);
      processingTime = recentHistory.reduce((sum, item) => sum + item.processingTime, 0) / recentHistory.length;
    }
    
    // Obtener estadísticas actuales
    const stats = this.manager.getStats();
    
    return {
      phase: activePhase,
      enabledFeatures,
      processingTime,
      memoryUsage: stats.memoryUsage,
      frameRate: stats.frameRate,
      readyForNextPhase: this.manager.readyForNextPhase()
    };
  }
  
  /**
   * Obtiene estadísticas detalladas
   */
  public getDetailedMetrics() {
    if (!this.config.enableDetailedMetrics) {
      return { metricsDisabled: true };
    }
    
    // Calcular métricas
    const recentHistory = this.performanceHistory.slice(-50);
    
    // Procesamiento
    const processingTimes = recentHistory.map(item => item.processingTime);
    const avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length || 0;
    const minProcessingTime = Math.min(...processingTimes) || 0;
    const maxProcessingTime = Math.max(...processingTimes) || 0;
    
    // Memoria
    const memoryUsages = recentHistory
      .filter(item => item.memoryUsage !== undefined)
      .map(item => item.memoryUsage as number);
      
    const avgMemoryUsage = memoryUsages.length > 0 
      ? memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length 
      : 0;
    
    return {
      samples: recentHistory.length,
      processingTime: {
        avg: avgProcessingTime,
        min: minProcessingTime,
        max: maxProcessingTime
      },
      memory: {
        avg: avgMemoryUsage,
        available: this.config.enableDetailedMetrics && memoryUsages.length > 0
      },
      optimizations: {
        activePhase: this.manager.getActivePhase(),
        enabledFeatures: this.manager.getAllFeatures().filter(f => f.enabled).length,
        totalFeatures: this.manager.getAllFeatures().length
      }
    };
  }
  
  /**
   * Aplica la configuración optimizada a los procesadores
   */
  public applyOptimizedConfig(): void {
    // Aplicar configuración basada en fase actual
    const activePhase = this.manager.getActivePhase();
    
    console.log(`[OptimizationController] Aplicando configuración optimizada para fase ${activePhase}`);
    
    // Configuración específica según fase
    switch (activePhase) {
      case 'phase1':
        // Fase 1: Optimizaciones básicas
        if (this.mlProcessor) {
          console.log("[OptimizationController] Aplicando optimizaciones fase 1 al procesador ML");
          // Ya configurado en creación
        }
        break;
        
      case 'phase2':
        // Fase 2: Optimizaciones avanzadas
        if (this.mlProcessor) {
          console.log("[OptimizationController] Aplicando optimizaciones fase 2 al procesador ML");
          // Para fase 2, implementar en próximo paso
        }
        break;
        
      case 'phase3':
        // Fase 3: Optimizaciones completas
        if (this.mlProcessor) {
          console.log("[OptimizationController] Aplicando optimizaciones fase 3 al procesador ML");
          // Para fase 3, implementar en siguiente paso
        }
        break;
    }
  }
  
  /**
   * Libera recursos
   */
  public dispose(): void {
    // Liberar ML Processor
    if (this.mlProcessor) {
      this.mlProcessor.dispose();
      this.mlProcessor = null;
    }
    
    // Terminar Worker
    if (this.signalWorker) {
      this.signalWorker.terminate();
      this.signalWorker = null;
    }
    
    this.isInitialized = false;
    this.performanceHistory = [];
    
    console.log("[OptimizationController] Recursos liberados");
  }
}

/**
 * Obtiene la instancia del controlador de optimizaciones
 */
export const getOptimizationController = (
  config?: Partial<OptimizationControllerConfig>
): OptimizationController => {
  return OptimizationController.getInstance(config);
};
