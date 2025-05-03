
import * as tf from '@tensorflow/tfjs';

/**
 * Definiciones de tipos para facilitar la comprensión
 */
export type Tensor1D = number[];
export type Tensor2D = number[][];
export type Tensor3D = number[][][];

/**
 * Interfaz para información de un modelo neuronal
 */
export interface ModelInfo {
  /** Nombre del modelo */
  name: string;
  
  /** Versión del modelo */
  version: string;
  
  /** Estado del modelo (cargado o no) */
  isLoaded: boolean;
  
  /** Tiempo de predicción en ms */
  predictionTime: number;
  
  /** Tiempo de carga en ms */
  loadTime: number;
  
  /** Forma de entrada esperada */
  inputShape: number[];
  
  /** Forma de salida esperada */
  outputShape: number[];
}

/**
 * Clase base para todos los modelos neuronales
 * Define la interfaz común y comportamientos básicos
 */
export abstract class BaseNeuralModel {
  /** Nombre identificativo del modelo */
  protected readonly modelName: string;
  
  /** Forma de entrada esperada */
  protected readonly inputShape: number[];
  
  /** Forma de salida esperada */
  protected readonly outputShape: number[];
  
  /** Versión del modelo */
  protected readonly modelVersion: string;
  
  /** Instancia del modelo TensorFlow.js */
  protected model: tf.LayersModel | tf.GraphModel | null = null;
  
  /** Indica si el modelo ha sido cargado */
  protected isModelLoaded: boolean = false;
  
  /** Tiempo que tarda la última predicción (ms) */
  protected lastPredictionTime: number = 0;
  
  /** Tiempo que tardó la carga del modelo (ms) */
  protected modelLoadTime: number = 0;
  
  /**
   * Constructor de modelo base
   */
  constructor(
    modelName: string,
    inputShape: number[],
    outputShape: number[],
    modelVersion: string = '1.0.0'
  ) {
    this.modelName = modelName;
    this.inputShape = inputShape;
    this.outputShape = outputShape;
    this.modelVersion = modelVersion;
  }
  
  /**
   * Carga el modelo (debe ser implementado por subclases)
   */
  abstract loadModel(): Promise<void>;
  
  /**
   * Realiza una predicción (debe ser implementado por subclases)
   */
  abstract predict(input: Tensor1D): Promise<Tensor1D>;
  
  /**
   * Método para actualizar el tiempo de predicción
   */
  protected updatePredictionTime(startTime: number): void {
    this.lastPredictionTime = Date.now() - startTime;
  }
  
  /**
   * Método para actualizar el tiempo de carga
   */
  protected updateLoadTime(startTime: number): void {
    this.modelLoadTime = Date.now() - startTime;
  }
  
  /**
   * Obtiene información del modelo
   */
  public getModelInfo(): ModelInfo {
    return {
      name: this.modelName,
      version: this.modelVersion,
      isLoaded: this.isModelLoaded,
      predictionTime: this.lastPredictionTime,
      loadTime: this.modelLoadTime,
      inputShape: this.inputShape,
      outputShape: this.outputShape
    };
  }
  
  /**
   * Usa la función predict con validación
   */
  public async process(input: Tensor1D): Promise<Tensor1D> {
    // Validar dimensiones de entrada
    if (input.length !== this.inputShape[0]) {
      console.error(`Dimensiones de entrada incorrectas. Esperado: ${this.inputShape[0]}, Recibido: ${input.length}`);
      return new Array(this.outputShape[0]).fill(0);
    }
    
    // Llamar a la implementación específica de predict
    return await this.predict(input);
  }
  
  /**
   * Retorna si el modelo está cargado
   */
  public isLoaded(): boolean {
    return this.isModelLoaded;
  }
  
  /**
   * Número de parámetros del modelo (abstracto)
   */
  abstract get parameterCount(): number;
  
  /**
   * Arquitectura del modelo (abstracto)
   */
  abstract get architecture(): string;
  
  /**
   * Libera recursos del modelo
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelLoaded = false;
    }
  }
}
