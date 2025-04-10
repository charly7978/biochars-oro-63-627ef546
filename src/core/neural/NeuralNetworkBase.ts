
/**
 * Base types and interfaces for neural network models
 */

// Define 1D Tensor as simple number array for type safety
export type Tensor1D = number[];

/**
 * Base class for all neural network models
 */
export abstract class BaseNeuralModel {
  // Properties for model metadata
  private readonly _name: string;
  private readonly _inputShape: number[];
  private readonly _outputShape: number[];
  private readonly _version: string;
  
  constructor(
    name: string,
    inputShape: number[],
    outputShape: number[],
    version: string
  ) {
    this._name = name;
    this._inputShape = inputShape;
    this._outputShape = outputShape;
    this._version = version;
  }
  
  /**
   * Abstract method for prediction that must be implemented
   */
  abstract predict(input: Tensor1D): Tensor1D;
  
  /**
   * Information about the model
   */
  getModelInfo() {
    return {
      name: this._name,
      inputShape: this._inputShape,
      outputShape: this._outputShape,
      version: this._version,
      architecture: this.architecture,
      parameterCount: this.parameterCount
    };
  }
  
  // Abstract properties that must be implemented by subclasses
  abstract get parameterCount(): number;
  abstract get architecture(): string;
  
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
