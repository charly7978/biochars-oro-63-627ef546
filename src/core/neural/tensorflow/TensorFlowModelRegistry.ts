
import * as tf from '@tensorflow/tfjs';
import { TFHeartRateModel } from './models/TFHeartRateModel';

/**
 * Registro de modelos TensorFlow para manejo centralizado
 */
export class TensorFlowModelRegistry {
  private static instance: TensorFlowModelRegistry;
  private models: Map<string, any> = new Map();
  private initialized: boolean = false;
  
  private constructor() {
    // Singleton
  }
  
  /**
   * Obtiene la instancia singleton
   */
  public static getInstance(): TensorFlowModelRegistry {
    if (!TensorFlowModelRegistry.instance) {
      TensorFlowModelRegistry.instance = new TensorFlowModelRegistry();
    }
    return TensorFlowModelRegistry.instance;
  }
  
  /**
   * Inicializa el registro y configura TensorFlow
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('Initializing TensorFlow Model Registry');
      
      // Configurar TensorFlow
      await this.setupTensorFlow();
      
      // Registrar modelos
      this.registerModels();
      
      this.initialized = true;
      console.log('TensorFlow Model Registry initialized');
    } catch (error) {
      console.error('Error initializing TensorFlow Model Registry:', error);
      throw error;
    }
  }
  
  /**
   * Configura TensorFlow
   */
  private async setupTensorFlow(): Promise<void> {
    try {
      // Intentar usar WebGL si está disponible
      await tf.setBackend('webgl')
        .catch(() => tf.setBackend('cpu'));
      
      // Optimizaciones de memoria
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_PACK', true);
      
      console.log(`TensorFlow initialized with ${tf.getBackend()} backend`);
    } catch (error) {
      console.error('Error setting up TensorFlow:', error);
      throw error;
    }
  }
  
  /**
   * Registra los modelos disponibles
   */
  private registerModels(): void {
    // Modelos pre-entrenados
    this.models.set('heartRate', new TFHeartRateModel());
    
    // Otros modelos se pueden añadir aquí
  }
  
  /**
   * Obtiene un modelo por su ID
   */
  public getModel<T>(id: string): T | null {
    if (!this.initialized) {
      console.warn('TensorFlow Model Registry not initialized');
    }
    
    return (this.models.get(id) as T) || null;
  }
  
  /**
   * Libera todos los modelos
   */
  public dispose(): void {
    for (const [id, model] of this.models.entries()) {
      if (model && typeof model.dispose === 'function') {
        model.dispose();
      }
    }
    
    this.models.clear();
    this.initialized = false;
    
    // Limpiar memoria de TensorFlow
    tf.disposeVariables();
    tf.engine().purgeUnusedTensors();
    
    console.log('TensorFlow Model Registry disposed');
  }
  
  /**
   * Verifica si WebGL está disponible
   */
  public isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    } catch (e) {
      return false;
    }
  }
}

// Helper para acceso rápido
export function getTFModel<T>(id: string): T | null {
  return TensorFlowModelRegistry.getInstance().getModel<T>(id);
}
