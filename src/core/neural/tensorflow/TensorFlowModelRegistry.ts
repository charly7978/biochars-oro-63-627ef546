import * as tf from '@tensorflow/tfjs';
import { TensorFlowConfig } from './TensorFlowConfig';
import { DEFAULT_TENSORFLOW_CONFIG } from './TensorFlowConfig';

// Define the CalibrableModel interface
export interface CalibrableModel {
  setCalibrationFactor(factor: number): void;
  onCalibrationStarted(): void;
  getPredictionTime(): number;
}

/**
 * Registro central de modelos TensorFlow
 * Gestiona todos los modelos, su carga y calibración
 */
export class TensorFlowModelRegistry {
  private static instance: TensorFlowModelRegistry;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private models: Map<string, CalibrableModel> = new Map();
  private config: TensorFlowConfig;
  private supportedBackends: string[] = [];
  private activeBackend: string = '';
  
  private constructor(config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG) {
    this.config = config;
  }
  
  /**
   * Obtiene la instancia singleton del registro
   */
  public static getInstance(config?: TensorFlowConfig): TensorFlowModelRegistry {
    if (!TensorFlowModelRegistry.instance) {
      TensorFlowModelRegistry.instance = new TensorFlowModelRegistry(config);
    } else if (config) {
      TensorFlowModelRegistry.instance.setConfig(config);
    }
    
    return TensorFlowModelRegistry.instance;
  }
  
  /**
   * Inicializa TensorFlow.js con la configuración especificada
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.isInitializing) {
      return new Promise<boolean>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isInitialized) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      });
    }
    
    this.isInitializing = true;
    
    try {
      console.log('TensorFlowModelRegistry: Inicializando TensorFlow.js');
      
      // Determinar backends disponibles
      this.supportedBackends = await this.detectSupportedBackends();
      
      // Configurar backend preferido si está disponible
      if (this.supportedBackends.includes(this.config.backend)) {
        await tf.setBackend(this.config.backend);
      } else if (this.supportedBackends.includes('webgl')) {
        await tf.setBackend('webgl');
      } else {
        await tf.setBackend('cpu');
      }
      
      // Guardar backend activo
      this.activeBackend = tf.getBackend();
      
      // Aplicar configuraciones de memoria
      if (this.config.memoryOptions.useFloat16) {
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      }
      
      if (this.config.memoryOptions.enableTensorPacking) {
        tf.env().set('WEBGL_PACK', true);
      }
      
      if (this.config.memoryOptions.gpuMemoryLimitMB > 0) {
        tf.env().set('WEBGL_RENDERER_PREFERENCE', 'high-performance');
        tf.env().set('WEBGL_VERSION', 2);
        tf.env().set('WEBGL_MAX_TEXTURE_SIZE', 16384);
        
        // Custom memory management without using configureNextOpHandler
        if (this.config.memoryOptions.enableAutoGarbageCollection) {
          // Schedule periodic cleanup
          setInterval(() => {
            if (tf.memory().numBytes > this.config.memoryOptions.gpuMemoryLimitMB * 1048576) {
              tf.engine().endScope();
              tf.engine().startScope();
            }
          }, 5000);
        }
      }
      
      // Configuraciones avanzadas para WebGL/WebGPU
      if (this.config.advancedOptions.enablePlatformOptimizations) {
        tf.env().set('CPU_HANDOFF_SIZE_THRESHOLD', 128);
        tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', true);
        tf.env().set('WEBGL_PACK_BINARY_OPERATIONS', true);
      }
      
      // Configurar prioridad para WebGPU si está disponible y preferido
      if (this.config.advancedOptions.preferWebGPU && this.supportedBackends.includes('webgpu')) {
        // WebGPU es experimental en TF.js, pero intentamos activarlo si está configurado
        tf.env().set('WEBGPU_USE_COMPUTE', true);
      }
      
      console.log(`TensorFlowModelRegistry: TensorFlow.js inicializado usando backend ${this.activeBackend}`);
      console.log('TensorFlowModelRegistry: Backends disponibles:', this.supportedBackends);
      
      this.isInitialized = true;
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.error('TensorFlowModelRegistry: Error inicializando TensorFlow.js:', error);
      this.isInitializing = false;
      throw error;
    }
  }
  
  /**
   * Detecta los backends de TensorFlow soportados en el dispositivo
   */
  private async detectSupportedBackends(): Promise<string[]> {
    const supported = [];
    
    // Comprobar WebGL
    try {
      // Fixed approach to checking WebGL support
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        supported.push('webgl');
      }
    } catch (e) {
      console.log('WebGL no soportado:', e);
    }
    
    // Comprobar WebGPU (experimental)
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        supported.push('webgpu');
      }
    } catch (e) {
      console.log('WebGPU no soportado:', e);
    }
    
    // WASM siempre se considera disponible
    supported.push('wasm');
    
    // CPU siempre disponible como fallback
    supported.push('cpu');
    
    return supported;
  }
  
  /**
   * Registra un nuevo modelo en el registro
   */
  public registerModel(id: string, model: CalibrableModel): void {
    this.models.set(id, model);
    console.log(`TensorFlowModelRegistry: Modelo registrado: ${id}`);
  }
  
  /**
   * Obtiene un modelo del registro
   */
  public getModel<T extends CalibrableModel>(id: string): T | null {
    return (this.models.get(id) as T) || null;
  }
  
  /**
   * Obtiene todos los modelos del registro
   */
  public getAllModels(): Map<string, CalibrableModel> {
    return this.models;
  }
  
  /**
   * Notifica a todos los modelos que la calibración ha comenzado
   */
  public notifyCalibrationStarted(): void {
    for (const model of this.models.values()) {
      model.onCalibrationStarted();
    }
  }
  
  /**
   * Establece una nueva configuración
   */
  public setConfig(config: TensorFlowConfig): void {
    this.config = config;
    
    // Si ya está inicializado, aplicar cambios que no requieran reinicio
    if (this.isInitialized) {
      if (this.config.memoryOptions.useFloat16) {
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      } else {
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
      }
      
      if (this.config.memoryOptions.enableTensorPacking) {
        tf.env().set('WEBGL_PACK', true);
      } else {
        tf.env().set('WEBGL_PACK', false);
      }
    }
  }
  
  /**
   * Obtiene la configuración actual
   */
  public getConfig(): TensorFlowConfig {
    return this.config;
  }
  
  /**
   * Obtiene el backend activo
   */
  public getActiveBackend(): string {
    return this.activeBackend;
  }
  
  /**
   * Obtiene los backends soportados
   */
  public getSupportedBackends(): string[] {
    return this.supportedBackends;
  }
  
  /**
   * Libera recursos y limpia el registro
   */
  public async dispose(): Promise<void> {
    for (const model of this.models.values()) {
      if (typeof (model as any).dispose === 'function') {
        await (model as any).dispose();
      }
    }
    
    this.models.clear();
    
    // Limpiar tensores no utilizados
    tf.dispose();
    
    console.log('TensorFlowModelRegistry: Todos los modelos liberados');
  }
}
