
import * as tf from '@tensorflow/tfjs';

/**
 * Base types and interfaces for neural network models
 */

// Define 1D Tensor as simple number array for type safety
export type Tensor1D = number[];
export type Tensor2D = Tensor1D[];

/**
 * Base class for neural network layers
 */
export abstract class Layer {
  abstract forward(input: any): any;
}

/**
 * Dense (Fully Connected) Layer
 */
export class DenseLayer extends Layer {
  private inputSize: number;
  private outputSize: number;
  private weights: number[][];
  private bias: number[];
  private activation: string;

  constructor(
    inputSize: number,
    outputSize: number,
    weights?: number[][],
    bias?: number[],
    activation: string = 'relu'
  ) {
    super();
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.activation = activation;
    
    // Initialize weights and biases if not provided
    this.weights = weights || this.initializeWeights(inputSize, outputSize);
    this.bias = bias || Array(outputSize).fill(0);
  }

  private initializeWeights(inputSize: number, outputSize: number): number[][] {
    // Xavier/Glorot initialization
    const scale = Math.sqrt(2 / (inputSize + outputSize));
    return Array(outputSize).fill(0).map(() => 
      Array(inputSize).fill(0).map(() => (Math.random() * 2 - 1) * scale)
    );
  }

  forward(input: number[]): number[] {
    // Matrix multiplication: output = input * weights + bias
    const output = Array(this.outputSize).fill(0);
    
    for (let i = 0; i < this.outputSize; i++) {
      for (let j = 0; j < this.inputSize; j++) {
        output[i] += input[j] * this.weights[i][j];
      }
      output[i] += this.bias[i];
      
      // Apply activation function
      output[i] = this.applyActivation(output[i], this.activation);
    }
    
    return output;
  }

  private applyActivation(x: number, activation: string): number {
    switch (activation) {
      case 'relu':
        return Math.max(0, x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'tanh':
        return Math.tanh(x);
      case 'linear':
      default:
        return x;
    }
  }
}

/**
 * 1D Convolutional Layer
 */
export class Conv1DLayer extends Layer {
  private inputChannels: number;
  private outputChannels: number;
  private kernelSize: number;
  private stride: number;
  private activation: string;
  private kernels: number[][][];
  private bias: number[];

  constructor(
    inputChannels: number,
    outputChannels: number,
    kernelSize: number,
    stride: number = 1,
    activation: string = 'relu'
  ) {
    super();
    this.inputChannels = inputChannels;
    this.outputChannels = outputChannels;
    this.kernelSize = kernelSize;
    this.stride = stride;
    this.activation = activation;
    
    // Initialize kernels and bias
    this.kernels = this.initializeKernels(inputChannels, outputChannels, kernelSize);
    this.bias = Array(outputChannels).fill(0);
  }

  private initializeKernels(inputChannels: number, outputChannels: number, kernelSize: number): number[][][] {
    // He initialization for convolutional layers
    const scale = Math.sqrt(2 / (inputChannels * kernelSize));
    
    const kernels: number[][][] = [];
    for (let oc = 0; oc < outputChannels; oc++) {
      const inputKernels: number[][] = [];
      for (let ic = 0; ic < inputChannels; ic++) {
        const kernel = Array(kernelSize).fill(0).map(() => (Math.random() * 2 - 1) * scale);
        inputKernels.push(kernel);
      }
      kernels.push(inputKernels);
    }
    
    return kernels;
  }

  forward(input: number[][]): number[][] {
    // Input shape: [channels, sequence_length]
    const inputChannels = input.length;
    const sequenceLength = input[0].length;
    
    // Calculate output sequence length
    const outputLength = Math.floor((sequenceLength - this.kernelSize) / this.stride) + 1;
    
    // Initialize output
    const output: number[][] = Array(this.outputChannels).fill(0).map(() => Array(outputLength).fill(0));
    
    // Perform convolution
    for (let oc = 0; oc < this.outputChannels; oc++) {
      for (let t = 0; t < outputLength; t++) {
        let sum = this.bias[oc];
        
        // Apply kernel across input channels
        for (let ic = 0; ic < inputChannels; ic++) {
          for (let k = 0; k < this.kernelSize; k++) {
            const inputPos = t * this.stride + k;
            if (inputPos < sequenceLength) {
              sum += input[ic][inputPos] * this.kernels[oc][ic][k];
            }
          }
        }
        
        // Apply activation
        output[oc][t] = this.applyActivation(sum, this.activation);
      }
    }
    
    return output;
  }

  private applyActivation(x: number, activation: string): number {
    switch (activation) {
      case 'relu':
        return Math.max(0, x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'tanh':
        return Math.tanh(x);
      case 'linear':
      default:
        return x;
    }
  }
}

/**
 * LSTM Layer for sequence processing
 */
export class LSTMLayer extends Layer {
  private inputSize: number;
  private hiddenSize: number;
  
  // LSTM gates: input, forget, cell, output
  private Wxi: number[][];  // Input gate weights for x
  private Whi: number[][];  // Input gate weights for hidden state
  private bi: number[];     // Input gate bias
  
  private Wxf: number[][];  // Forget gate weights for x
  private Whf: number[][];  // Forget gate weights for hidden state
  private bf: number[];     // Forget gate bias
  
  private Wxc: number[][];  // Cell gate weights for x
  private Whc: number[][];  // Cell gate weights for hidden state
  private bc: number[];     // Cell gate bias
  
  private Wxo: number[][];  // Output gate weights for x
  private Who: number[][];  // Output gate weights for hidden state
  private bo: number[];     // Output gate bias

  constructor(inputSize: number, hiddenSize: number) {
    super();
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    
    // Initialize all weights and biases
    const scale = Math.sqrt(2 / (inputSize + hiddenSize));
    const initMatrix = (rows: number, cols: number) => 
      Array(rows).fill(0).map(() => 
        Array(cols).fill(0).map(() => (Math.random() * 2 - 1) * scale)
      );
    
    // Input gate
    this.Wxi = initMatrix(hiddenSize, inputSize);
    this.Whi = initMatrix(hiddenSize, hiddenSize);
    this.bi = Array(hiddenSize).fill(0);
    
    // Forget gate (bias initialized to 1 to promote information flow)
    this.Wxf = initMatrix(hiddenSize, inputSize);
    this.Whf = initMatrix(hiddenSize, hiddenSize);
    this.bf = Array(hiddenSize).fill(1);
    
    // Cell gate
    this.Wxc = initMatrix(hiddenSize, inputSize);
    this.Whc = initMatrix(hiddenSize, hiddenSize);
    this.bc = Array(hiddenSize).fill(0);
    
    // Output gate
    this.Wxo = initMatrix(hiddenSize, inputSize);
    this.Who = initMatrix(hiddenSize, hiddenSize);
    this.bo = Array(hiddenSize).fill(0);
  }

  forward(input: number[][]): { outputs: number[][]; finalState: { c: number[]; h: number[] } } {
    // Input shape: [sequence_length, features]
    const sequenceLength = input.length;
    const batchSize = 1;  // Assuming batch size is 1
    
    // Initialize hidden state and cell state
    let h = Array(this.hiddenSize).fill(0);
    let c = Array(this.hiddenSize).fill(0);
    
    // Store outputs for each time step
    const outputs: number[][] = [];
    
    // Process each time step
    for (let t = 0; t < sequenceLength; t++) {
      const xt = input[t];
      
      // Input gate
      const i = this.sigmoid(this.addVectors(
        this.matrixVectorProduct(this.Wxi, xt),
        this.addVectors(this.matrixVectorProduct(this.Whi, h), this.bi)
      ));
      
      // Forget gate
      const f = this.sigmoid(this.addVectors(
        this.matrixVectorProduct(this.Wxf, xt),
        this.addVectors(this.matrixVectorProduct(this.Whf, h), this.bf)
      ));
      
      // Cell gate
      const cTilda = this.tanh(this.addVectors(
        this.matrixVectorProduct(this.Wxc, xt),
        this.addVectors(this.matrixVectorProduct(this.Whc, h), this.bc)
      ));
      
      // Update cell state
      c = this.addVectors(
        this.elementWiseProduct(f, c),
        this.elementWiseProduct(i, cTilda)
      );
      
      // Output gate
      const o = this.sigmoid(this.addVectors(
        this.matrixVectorProduct(this.Wxo, xt),
        this.addVectors(this.matrixVectorProduct(this.Who, h), this.bo)
      ));
      
      // Update hidden state
      h = this.elementWiseProduct(o, this.tanh(c));
      
      // Store output
      outputs.push([...h]);
    }
    
    return {
      outputs,
      finalState: { c, h }
    };
  }

  // Helper methods for vector operations
  private sigmoid(x: number[]): number[] {
    return x.map(val => 1 / (1 + Math.exp(-val)));
  }
  
  private tanh(x: number[]): number[] {
    return x.map(val => Math.tanh(val));
  }
  
  private addVectors(a: number[], b: number[]): number[] {
    return a.map((val, i) => val + b[i]);
  }
  
  private elementWiseProduct(a: number[], b: number[]): number[] {
    return a.map((val, i) => val * b[i]);
  }
  
  private matrixVectorProduct(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }
}

/**
 * Pooling Layer (Max or Average)
 */
export class Pooling1DLayer extends Layer {
  private poolSize: number;
  private stride: number;
  private poolingType: 'max' | 'avg';

  constructor(poolSize: number, stride: number = 1, poolingType: 'max' | 'avg' = 'max') {
    super();
    this.poolSize = poolSize;
    this.stride = stride;
    this.poolingType = poolingType;
  }

  forward(input: number[][]): number[][] {
    // Input shape: [channels, sequence_length]
    const channels = input.length;
    const sequenceLength = input[0].length;
    
    // Calculate output sequence length
    const outputLength = Math.floor((sequenceLength - this.poolSize) / this.stride) + 1;
    
    // Initialize output
    const output: number[][] = Array(channels).fill(0).map(() => Array(outputLength).fill(0));
    
    // Perform pooling
    for (let c = 0; c < channels; c++) {
      for (let t = 0; t < outputLength; t++) {
        const startPos = t * this.stride;
        const endPos = Math.min(startPos + this.poolSize, sequenceLength);
        
        if (this.poolingType === 'max') {
          let maxVal = -Infinity;
          for (let i = startPos; i < endPos; i++) {
            maxVal = Math.max(maxVal, input[c][i]);
          }
          output[c][t] = maxVal;
        } else {  // 'avg'
          let sum = 0;
          for (let i = startPos; i < endPos; i++) {
            sum += input[c][i];
          }
          output[c][t] = sum / (endPos - startPos);
        }
      }
    }
    
    return output;
  }
}

/**
 * Batch Normalization Layer
 */
export class BatchNormLayer extends Layer {
  private channels: number;
  private epsilon: number;
  private gamma: number[];
  private beta: number[];
  private movingMean: number[];
  private movingVar: number[];

  constructor(channels: number, epsilon: number = 1e-5) {
    super();
    this.channels = channels;
    this.epsilon = epsilon;
    
    // Initialize parameters
    this.gamma = Array(channels).fill(1);      // Scale parameter
    this.beta = Array(channels).fill(0);       // Shift parameter
    this.movingMean = Array(channels).fill(0); // Running mean
    this.movingVar = Array(channels).fill(1);  // Running variance
  }

  forward(input: number[][]): number[][] {
    // Input shape: [channels, sequence_length]
    const channels = input.length;
    const sequenceLength = input[0].length;
    
    // Initialize output
    const output: number[][] = Array(channels).fill(0).map(() => Array(sequenceLength).fill(0));
    
    // Apply batch normalization
    for (let c = 0; c < channels; c++) {
      // Use moving statistics for inference
      const mean = this.movingMean[c];
      const variance = this.movingVar[c];
      const gamma = this.gamma[c];
      const beta = this.beta[c];
      
      for (let t = 0; t < sequenceLength; t++) {
        // Normalize and scale/shift
        output[c][t] = gamma * ((input[c][t] - mean) / Math.sqrt(variance + this.epsilon)) + beta;
      }
    }
    
    return output;
  }
}

/**
 * Residual Block for deep networks
 */
export class ResidualBlock extends Layer {
  private channels: number;
  private kernelSize: number;
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;

  constructor(channels: number, kernelSize: number) {
    super();
    this.channels = channels;
    this.kernelSize = kernelSize;
    
    // First convolution block
    this.conv1 = new Conv1DLayer(channels, channels, kernelSize, 1, 'relu');
    this.bn1 = new BatchNormLayer(channels);
    
    // Second convolution block
    this.conv2 = new Conv1DLayer(channels, channels, kernelSize, 1, 'linear');
    this.bn2 = new BatchNormLayer(channels);
  }

  forward(input: number[][]): number[][] {
    // Store identity for residual connection
    const identity = input;
    
    // First conv block
    let x = this.conv1.forward(input);
    x = this.bn1.forward(x);
    
    // Apply ReLU activation
    x = x.map(channel => channel.map(val => Math.max(0, val)));
    
    // Second conv block
    x = this.conv2.forward(x);
    x = this.bn2.forward(x);
    
    // Add residual connection
    // Ensure dimensions match
    const outputLength = x[0].length;
    const identityLength = identity[0].length;
    
    if (outputLength === identityLength) {
      // Add identity directly
      for (let c = 0; c < this.channels; c++) {
        for (let t = 0; t < outputLength; t++) {
          x[c][t] += identity[c][t];
        }
      }
    } else {
      // Simple padding/truncating for dimension mismatch
      for (let c = 0; c < this.channels; c++) {
        for (let t = 0; t < outputLength; t++) {
          if (t < identityLength) {
            x[c][t] += identity[c][t];
          }
        }
      }
    }
    
    // Apply ReLU activation after addition
    return x.map(channel => channel.map(val => Math.max(0, val)));
  }
}

/**
 * Base class for all neural network models
 */
export abstract class BaseNeuralModel {
  private readonly _name: string;
  private _version: string; // Hacer version mutable si se carga del modelo
  private readonly _expectedInputShape: number[]; // Forma esperada sin el batch size
  private _loadedModel: tf.LayersModel | null = null;
  private _isLoaded: boolean = false;
  private _isLoading: boolean = false;
  private _lastPredictionTime: number = 0;
  private _parameterCount: number | null = null; // Se puede intentar obtener del modelo

  constructor(
    name: string,
    expectedInputShape: number[], // Solo la forma de la entrada, ej [128, 1] para secuencia
    version?: string // Opcional, podría venir del modelo cargado
  ) {
    this._name = name;
    this._expectedInputShape = expectedInputShape;
    this._version = version || 'unknown';
  }

  /**
   * Carga el modelo TFJS desde una URL.
   * @param modelUrl URL al archivo model.json del modelo TFJS.
   */
  public async loadModel(modelUrl: string): Promise<void> {
    if (this._isLoaded || this._isLoading) {
      console.log(`Model ${this._name} already loaded or loading.`);
      return;
    }
    this._isLoading = true;
    console.log(`Loading model ${this._name} from ${modelUrl}...`);
    try {
      this._loadedModel = await tf.loadLayersModel(modelUrl);
      this._isLoaded = true;
      console.log(`Model ${this._name} loaded successfully.`);
      // Intentar obtener metadatos si están disponibles
      // Esto es especulativo y depende de cómo se guardó el modelo
      const metadata = (this._loadedModel as any).userDefinedMetadata;
      if (metadata?.version) {
         this._version = metadata.version;
      }
      // Calcular parámetros (puede ser intensivo)
      // this._parameterCount = this._loadedModel.countParams(); 
    } catch (error) { 
      console.error(`Failed to load model ${this._name} from ${modelUrl}:`, error);
      this._loadedModel = null;
      this._isLoaded = false;
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Realiza una predicción usando el modelo TFJS cargado.
   * @param input Array numérico de entrada.
   * @returns Array numérico con la predicción, o null si el modelo no está listo o falla.
   */
  public predict(input: Tensor1D): Tensor1D | null {
    if (!this._isLoaded || !this._loadedModel) {
      console.warn(`Model ${this._name} is not loaded. Cannot predict.`);
      return null;
    }

    const startTime = performance.now();
    try {
      // tf.tidy se encarga de limpiar tensores intermedios
      const result = tf.tidy(() => {
        // 1. Convertir array de entrada a tf.Tensor
        // Añadir dimensión de batch (1) y asegurar la forma correcta
        const inputTensor = tf.tensor(input).reshape([1, ...this._expectedInputShape]);

        // 2. Realizar predicción
        const prediction = this._loadedModel!.predict(inputTensor) as tf.Tensor;

        // 3. Convertir tensor de salida a array
        const outputArray = prediction.dataSync(); 
        return Array.from(outputArray);
      });
      this.updatePredictionTime(startTime);
      return result;
    } catch (error) {
      console.error(`Error during prediction with model ${this._name}:`, error);
      return null;
    }
  }

  public isLoaded(): boolean {
    return this._isLoaded;
  }

  // --- Getters --- 

  protected updatePredictionTime(startTime: number): void {
    const endTime = performance.now();
    this._lastPredictionTime = endTime - startTime;
  }

  get lastPredictionTime(): number {
    return this._lastPredictionTime;
  }
  
  // No se puede obtener fácilmente de un modelo cargado sin recorrer capas
  get parameterCount(): number {
     return this._parameterCount !== null ? this._parameterCount : 0; 
  }

  // Podría extraerse de la estructura del modelo si es necesario
  get architecture(): string {
    return this._loadedModel ? `TFJS LayersModel: ${this._loadedModel.name}` : 'Model not loaded';
  }

  get name(): string {
    return this._name;
  }

  get inputShape(): number[] {
     // Devuelve la forma esperada (sin batch)
    return this._expectedInputShape;
  }

  get outputShape(): number[] {
    // Obtener del modelo cargado si es posible
    return this._loadedModel?.outputShape ? (this._loadedModel.outputShape as number[]).slice(1) : []; // Quitar dimensión de batch
  }

  get version(): string {
    return this._version;
  }
  
  public dispose(): void {
      if (this._loadedModel) {
          this._loadedModel.dispose();
          this._loadedModel = null;
          this._isLoaded = false;
          console.log(`Model ${this.name} disposed.`);
      }
  }
}

/**
 * Utility functions for tensor operations
 */
export class TensorUtils {
  /**
   * Standardize a signal (mean=0, std=1)
   */
  static standardizeSignal(signal: Tensor1D): Tensor1D {
    if (signal.length === 0) return [];
    
    // Calculate mean
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    // Calculate standard deviation
    let variance = 0;
    for (const val of signal) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= signal.length;
    const std = Math.sqrt(variance);
    
    // Standardize
    if (std < 1e-6) {
      return signal.map(_ => 0);
    }
    
    return signal.map(val => (val - mean) / std);
  }
  
  /**
   * Normalize a tensor to a range [min, max]
   */
  static normalizeInput(input: Tensor1D, min: number = 0, max: number = 1): Tensor1D {
    if (input.length === 0) return [];
    
    const minVal = Math.min(...input);
    const maxVal = Math.max(...input);
    
    // Avoid division by zero
    if (maxVal === minVal) {
      return Array(input.length).fill((min + max) / 2);
    }
    
    // Normalize to [min, max]
    return input.map(x => min + ((x - minVal) / (maxVal - minVal)) * (max - min));
  }
  
  /**
   * Apply a moving average filter
   */
  static movingAverage(input: Tensor1D, windowSize: number = 5): Tensor1D {
    if (input.length <= windowSize) {
      return input;
    }
    
    const result: Tensor1D = [];
    for (let i = 0; i < input.length; i++) {
      let sum = 0;
      let count = 0;
      
      // Calculate window
      for (let j = Math.max(0, i - Math.floor(windowSize / 2)); 
           j <= Math.min(input.length - 1, i + Math.floor(windowSize / 2)); j++) {
        sum += input[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Apply a bandpass filter
   */
  static bandpassFilter(signal: Tensor1D, lowCutoff: number, highCutoff: number, sampleRate: number = 60): Tensor1D {
    // Implement a simple IIR bandpass filter
    const dt = 1 / sampleRate;
    const RC_low = 1 / (2 * Math.PI * lowCutoff);
    const RC_high = 1 / (2 * Math.PI * highCutoff);
    
    const alpha_low = dt / (RC_low + dt);
    const alpha_high = RC_high / (RC_high + dt);
    
    const result: Tensor1D = [];
    let y_low_prev = signal[0] || 0;
    let y_high_prev = 0;
    
    for (let i = 0; i < signal.length; i++) {
      // Low-pass filter
      const y_low = y_low_prev + alpha_low * (signal[i] - y_low_prev);
      y_low_prev = y_low;
      
      // High-pass filter
      const y_high = alpha_high * (y_high_prev + y_low - y_low_prev);
      y_high_prev = y_high;
      
      result.push(y_high);
    }
    
    return result;
  }
  
  /**
   * Calculate the power spectral density using FFT
   */
  static calculatePSD(signal: Tensor1D, sampleRate: number = 60): { frequencies: Tensor1D; psd: Tensor1D } {
    // Zero-pad to nearest power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(signal.length)));
    const paddedSignal = [...signal];
    while (paddedSignal.length < paddedLength) {
      paddedSignal.push(0);
    }
    
    // Apply Hamming window
    const windowedSignal = paddedSignal.map((x, i) => 
      x * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (paddedLength - 1)))
    );
    
    // Simple DFT for demonstration
    const real: Tensor1D = [];
    const imag: Tensor1D = [];
    
    for (let k = 0; k < paddedLength / 2; k++) {
      let re = 0;
      let im = 0;
      
      for (let n = 0; n < paddedLength; n++) {
        const angle = -2 * Math.PI * k * n / paddedLength;
        re += windowedSignal[n] * Math.cos(angle);
        im += windowedSignal[n] * Math.sin(angle);
      }
      
      real.push(re);
      imag.push(im);
    }
    
    // Calculate magnitude squared (PSD)
    const psd = real.map((re, i) => re * re + imag[i] * imag[i]);
    
    // Calculate frequency bins
    const frequencies = Array(psd.length)
      .fill(0)
      .map((_, i) => i * sampleRate / paddedLength);
    
    return { frequencies, psd };
  }
}
