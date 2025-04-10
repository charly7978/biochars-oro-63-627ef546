
import * as tf from '@tensorflow/tfjs';
import { TensorFlowConfig, DEFAULT_TENSORFLOW_CONFIG } from './TensorFlowConfig';
import { BaseNeuralModel } from '../NeuralNetworkBase';

/**
 * Registro centralizado de modelos TensorFlow
 * Gestiona la creación, carga y acceso a modelos
 */
export class TensorFlowModelRegistry {
  private static instance: TensorFlowModelRegistry;
  private models: Map<string, BaseNeuralModel> = new Map();
  private modelInitialized: Map<string, boolean> = new Map();
  private config: TensorFlowConfig;
  private isInitialized: boolean = false;
  
  private constructor(config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG) {
    this.config = config;
    this.initialize();
  }
  
  /**
   * Obtiene la instancia singleton del registro
   */
  public static getInstance(config?: TensorFlowConfig): TensorFlowModelRegistry {
    if (!TensorFlowModelRegistry.instance) {
      TensorFlowModelRegistry.instance = new TensorFlowModelRegistry(config);
    }
    return TensorFlowModelRegistry.instance;
  }
  
  /**
   * Inicializa TensorFlow con la configuración especificada
   */
  private async initialize(): Promise<void> {
    try {
      // Configurar el backend
      await tf.setBackend(this.config.backend);
      
      // Aplicar configuraciones de memoria
      if (this.config.memoryOptions.useFloat16) {
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      }
      
      if (this.config.memoryOptions.enableTensorPacking) {
        tf.env().set('WEBGL_PACK', true);
      }
      
      if (this.config.memoryOptions.gpuMemoryLimitMB > 0) {
        tf.env().set('WEBGL_MAX_TEXTURE_SIZE', this.config.memoryOptions.gpuMemoryLimitMB * 1024 * 1024);
      }
      
      console.log(`TensorFlow.js inicializado con backend: ${tf.getBackend()}`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Error inicializando TensorFlow:', error);
      // Intentar fallback a CPU
      try {
        await tf.setBackend('cpu');
        console.log('Fallback a backend CPU completado');
        this.isInitialized = true;
      } catch (fallbackError) {
        console.error('Error en fallback a CPU:', fallbackError);
      }
    }
  }
  
  /**
   * Registra un modelo en el registro
   */
  public registerModel(id: string, model: BaseNeuralModel): void {
    this.models.set(id, model);
    this.modelInitialized.set(id, false);
    console.log(`Modelo registrado: ${id}`);
  }
  
  /**
   * Obtiene un modelo por su ID
   */
  public getModel<T extends BaseNeuralModel>(id: string): T | null {
    const model = this.models.get(id) as T;
    if (!model) return null;
    
    // Inicializar si es la primera vez
    if (!this.modelInitialized.get(id)) {
      console.log(`Inicializando modelo: ${id}`);
      this.modelInitialized.set(id, true);
    }
    
    return model;
  }
  
  /**
   * Obtiene todos los modelos registrados
   */
  public getAllModels(): Map<string, BaseNeuralModel> {
    return this.models;
  }
  
  /**
   * Notifica a todos los modelos que se ha iniciado calibración
   */
  public notifyCalibrationStarted(): void {
    this.models.forEach((model) => {
      if (typeof model.onCalibrationStarted === 'function') {
        model.onCalibrationStarted();
      }
    });
  }
  
  /**
   * Reinicia un modelo específico o todos
   */
  public resetModels(specificId?: string): void {
    if (specificId) {
      const model = this.models.get(specificId);
      if (model) {
        console.log(`Reiniciando modelo: ${specificId}`);
        // Crear una nueva instancia
        this.models.set(specificId, new (Object.getPrototypeOf(model).constructor)());
        this.modelInitialized.set(specificId, false);
      }
    } else {
      // Reiniciar todos los modelos
      console.log('Reiniciando todos los modelos');
      const modelIds = Array.from(this.models.keys());
      for (const id of modelIds) {
        const model = this.models.get(id);
        if (model) {
          this.models.set(id, new (Object.getPrototypeOf(model).constructor)());
          this.modelInitialized.set(id, false);
        }
      }
    }
  }
  
  /**
   * Libera recursos utilizados por los modelos
   */
  public async dispose(): Promise<void> {
    // Liberar memoria de TensorFlow
    await tf.disposeVariables();
    
    // Limpiar modelos
    this.models.clear();
    this.modelInitialized.clear();
    
    console.log('Modelos TensorFlow liberados');
  }
  
  /**
   * Devuelve información sobre todos los modelos registrados
   */
  public getModelInfo(): Array<{
    id: string;
    name: string;
    version: string;
    initialized: boolean;
    architecture: string;
    backend: string;
  }> {
    return Array.from(this.models.entries()).map(([id, model]) => ({
      id,
      name: model.getModelInfo().name,
      version: model.getModelInfo().version,
      initialized: this.modelInitialized.get(id) || false,
      architecture: model.architecture,
      backend: tf.getBackend() || 'unknown'
    }));
  }
  
  /**
   * Actualiza la configuración de TensorFlow
   */
  public async updateConfig(newConfig: Partial<TensorFlowConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Reinicializar con nueva configuración
    await this.initialize();
  }
}

/**
 * Función de utilidad para acceso rápido a modelos
 */
export function getTFModel<T extends BaseNeuralModel>(id: string): T | null {
  return TensorFlowModelRegistry.getInstance().getModel<T>(id);
}
