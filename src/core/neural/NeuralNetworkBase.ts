/**
 * Base types and interfaces for neural network models
 */
import * as tf from '@tensorflow/tfjs'; // Importar tfjs

// Define 1D Tensor as simple number array for type safety
export type Tensor1D = number[];
export type Tensor2D = Tensor1D[];

/**
 * Base class for all neural network models using external engines (TF.js/ONNX)
 */
export abstract class BaseNeuralModel {
  // Properties for model metadata
  private readonly _name: string;
  private readonly _inputShape: number[]; // Puede ser informativo, la validación real la hace el modelo cargado
  private readonly _outputShape: number[]; // Puede ser informativo
  private readonly _version: string;
  private _lastPredictionTime: number = 0;

  // Propiedad para el modelo cargado (TF.js GraphModel o LayersModel)
  protected model: tf.GraphModel | tf.LayersModel | null = null;
  protected isModelLoaded: boolean = false;

  constructor(
    name: string,
    inputShape: number[], // Mantener para info, pero no para validación estricta aquí
    outputShape: number[], // Mantener para info
    version: string
  ) {
    this._name = name;
    this._inputShape = inputShape;
    this._outputShape = outputShape;
    this._version = version;
  }
  
  /**
   * Método abstracto para cargar el modelo real (TF.js o ONNX)
   * Debería ser implementado por las clases hijas.
   */
  abstract loadModel(): Promise<void>;
  
  /**
   * Abstract method for prediction that must be implemented
   * Ahora espera un tf.Tensor como entrada y devuelve tf.Tensor.
   * Las clases hijas deberán manejar la conversión desde/hacia Tensor1D si es necesario.
   */
  // abstract predict(input: tf.Tensor): Promise<tf.Tensor>;
  // --- Mantenemos firma original por ahora para minimizar cambios ---
  // La conversión a/desde Tensor se hará en las implementaciones de predict hijas
  abstract predict(input: Tensor1D): Promise<Tensor1D>;
  
  /**
   * Information about the model
   */
  getModelInfo() {
    return {
      name: this._name,
      inputShape: this._inputShape,
      outputShape: this._outputShape,
      version: this._version,
      architecture: this.architecture, // Delegar a la clase hija
      parameterCount: this.parameterCount, // Delegar a la clase hija
      isLoaded: this.isModelLoaded, // Nuevo estado
      lastPredictionTime: this._lastPredictionTime
    };
  }
  
  /**
   * Update prediction time for performance tracking
   */
  protected updatePredictionTime(startTime: number): void {
    const elapsed = Date.now() - startTime;
    this._lastPredictionTime = elapsed;
    // Opcional: Registrar tiempos de inferencia
    // console.log(`${this._name} prediction time: ${elapsed}ms`);
  }
  
  /**
   * Get the last prediction time in ms
   */
  get lastPredictionTime(): number {
    return this._lastPredictionTime;
  }
  
  // Abstract properties that must be implemented by subclasses
  abstract get parameterCount(): number; // Podría ser opcional o retornar 0 si no es aplicable/conocido
  abstract get architecture(): string; // Nombre de la arquitectura (ej. 'TF.js GraphModel', 'ONNX Model')
  
  // Getters for model metadata
  get name(): string {
    return this._name;
  }
  
  get inputShape(): number[] {
    return this._inputShape;
  }
  
  get outputShape(): number[] {
    return this._outputShape;
  }
  
  get version(): string {
    return this._version;
  }
}
