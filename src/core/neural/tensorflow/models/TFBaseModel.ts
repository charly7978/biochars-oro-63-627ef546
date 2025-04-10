
import * as tf from '@tensorflow/tfjs';

/**
 * Interfaz base para modelos TensorFlow
 */
export interface TFModelOptions {
  inputShape: number[];
  outputShape: number[];
  modelName: string;
  version: string;
}

/**
 * Clase base para modelos TensorFlow
 */
export abstract class TFBaseModel {
  protected model: tf.LayersModel | null = null;
  protected readonly inputShape: number[];
  protected readonly outputShape: number[];
  protected readonly modelName: string;
  protected readonly version: string;
  protected isInitialized: boolean = false;
  
  constructor(options: TFModelOptions) {
    this.inputShape = options.inputShape;
    this.outputShape = options.outputShape;
    this.modelName = options.modelName;
    this.version = options.version;
  }
  
  /**
   * Inicializa el modelo
   */
  abstract initialize(): Promise<void>;
  
  /**
   * Realiza una predicción
   */
  abstract predict(input: number[]): Promise<number[]>;
  
  /**
   * Libera recursos del modelo
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
  
  /**
   * Obtiene información del modelo
   */
  getInfo(): {
    name: string;
    version: string;
    inputShape: number[];
    outputShape: number[];
    isInitialized: boolean;
  } {
    return {
      name: this.modelName,
      version: this.version,
      inputShape: this.inputShape,
      outputShape: this.outputShape,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Indica si el modelo está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }
}

// Export types for reuse
export type { TFModelOptions };
