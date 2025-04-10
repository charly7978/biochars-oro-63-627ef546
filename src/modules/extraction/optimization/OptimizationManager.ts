
/**
 * Sistema de gestión de optimizaciones y mejoras
 * Controla la activación de diferentes capas de optimización y registra su estado
 */

export type OptimizationPhase = 'phase1' | 'phase2' | 'phase3';

export interface OptimizationFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  phase: OptimizationPhase;
  dependencies?: string[];
}

export interface OptimizationStats {
  memoryUsage?: number;
  processingTime?: number;
  frameRate?: number;
  lastUpdated: number;
}

export class OptimizationManager {
  private static instance: OptimizationManager;
  private features: Map<string, OptimizationFeature> = new Map();
  private stats: OptimizationStats = { lastUpdated: Date.now() };
  private activePhase: OptimizationPhase = 'phase1';

  private constructor() {
    this.initializeFeatures();
    console.log("[OptimizationManager] Inicializado con fase activa:", this.activePhase);
  }

  public static getInstance(): OptimizationManager {
    if (!OptimizationManager.instance) {
      OptimizationManager.instance = new OptimizationManager();
    }
    return OptimizationManager.instance;
  }

  private initializeFeatures(): void {
    // Fase 1 - Alta prioridad
    this.registerFeature({
      id: 'model-quantization',
      name: 'Cuantización del Modelo',
      description: 'Reduce el tamaño del modelo y mejora la eficiencia mediante cuantización de 8-bits',
      enabled: true,
      phase: 'phase1'
    });

    this.registerFeature({
      id: 'memory-optimization',
      name: 'Optimización de Memoria',
      description: 'Reduce el uso de memoria mediante gestión eficiente de tensores',
      enabled: true,
      phase: 'phase1'
    });

    this.registerFeature({
      id: 'worker-optimization',
      name: 'Optimización de Web Worker',
      description: 'Mejora el rendimiento del procesamiento en segundo plano',
      enabled: true,
      phase: 'phase1'
    });

    // Fase 2 - Prioridad media
    this.registerFeature({
      id: 'gpu-pipeline',
      name: 'Pipeline GPU Optimizado',
      description: 'Mejora el rendimiento mediante uso óptimo de la GPU',
      enabled: false,
      phase: 'phase2',
      dependencies: ['model-quantization']
    });

    this.registerFeature({
      id: 'wasm-optimization',
      name: 'Optimización de WebAssembly',
      description: 'Mejora el rendimiento de las funciones en WebAssembly',
      enabled: false,
      phase: 'phase2'
    });

    this.registerFeature({
      id: 'batch-processing',
      name: 'Procesamiento por Lotes',
      description: 'Mejora la eficiencia mediante procesamiento agrupado',
      enabled: false,
      phase: 'phase2',
      dependencies: ['worker-optimization']
    });

    // Fase 3 - Prioridad baja
    this.registerFeature({
      id: 'smart-cache',
      name: 'Caché Inteligente',
      description: 'Reduce el procesamiento redundante mediante caché predictivo',
      enabled: false,
      phase: 'phase3',
      dependencies: ['batch-processing']
    });

    this.registerFeature({
      id: 'advanced-parallelization',
      name: 'Paralelización Avanzada',
      description: 'Mejora el rendimiento mediante procesamiento en paralelo',
      enabled: false,
      phase: 'phase3',
      dependencies: ['wasm-optimization', 'gpu-pipeline']
    });

    this.registerFeature({
      id: 'telemetry',
      name: 'Telemetría y Monitoring',
      description: 'Proporciona métricas de rendimiento detalladas',
      enabled: false,
      phase: 'phase3'
    });
  }

  private registerFeature(feature: OptimizationFeature): void {
    this.features.set(feature.id, feature);
  }

  public isFeatureEnabled(featureId: string): boolean {
    const feature = this.features.get(featureId);
    return feature ? feature.enabled : false;
  }

  public enableFeature(featureId: string): boolean {
    const feature = this.features.get(featureId);
    if (!feature) return false;

    // Verificar dependencias
    if (feature.dependencies) {
      for (const depId of feature.dependencies) {
        if (!this.isFeatureEnabled(depId)) {
          console.warn(`[OptimizationManager] No se puede habilitar ${featureId}: depende de ${depId} que está desactivado`);
          return false;
        }
      }
    }

    feature.enabled = true;
    console.log(`[OptimizationManager] Característica habilitada: ${feature.name}`);
    return true;
  }

  public disableFeature(featureId: string): boolean {
    const feature = this.features.get(featureId);
    if (!feature) return false;

    // Verificar si hay características que dependen de esta
    for (const [id, f] of this.features.entries()) {
      if (f.dependencies?.includes(featureId) && f.enabled) {
        console.warn(`[OptimizationManager] No se puede deshabilitar ${featureId}: ${id} depende de ella`);
        return false;
      }
    }

    feature.enabled = false;
    console.log(`[OptimizationManager] Característica deshabilitada: ${feature.name}`);
    return true;
  }

  public activatePhase(phase: OptimizationPhase): void {
    // Activar características de la fase especificada
    for (const [_, feature] of this.features.entries()) {
      if (feature.phase === phase) {
        this.enableFeature(feature.id);
      }
    }
    
    this.activePhase = phase;
    console.log(`[OptimizationManager] Fase ${phase} activada`);
  }

  public getActivePhase(): OptimizationPhase {
    return this.activePhase;
  }

  public getAllFeatures(): OptimizationFeature[] {
    return Array.from(this.features.values());
  }

  public getFeaturesForPhase(phase: OptimizationPhase): OptimizationFeature[] {
    return Array.from(this.features.values()).filter(f => f.phase === phase);
  }

  public updateStats(stats: Partial<OptimizationStats>): void {
    this.stats = {
      ...this.stats,
      ...stats,
      lastUpdated: Date.now()
    };
  }

  public getStats(): OptimizationStats {
    return this.stats;
  }

  public readyForNextPhase(): boolean {
    const currentPhaseFeatures = this.getFeaturesForPhase(this.activePhase);
    return currentPhaseFeatures.every(f => f.enabled);
  }

  public advanceToNextPhase(): boolean {
    if (!this.readyForNextPhase()) {
      console.warn("[OptimizationManager] No se puede avanzar: fase actual incompleta");
      return false;
    }

    if (this.activePhase === 'phase1') {
      this.activatePhase('phase2');
      return true;
    } else if (this.activePhase === 'phase2') {
      this.activatePhase('phase3');
      return true;
    }

    console.log("[OptimizationManager] Ya estás en la última fase");
    return false;
  }
}

// Función para acceder fácilmente al gestor de optimizaciones
export const getOptimizationManager = (): OptimizationManager => {
  return OptimizationManager.getInstance();
};
