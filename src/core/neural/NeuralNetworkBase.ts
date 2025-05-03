import * as tf from '@tensorflow/tfjs';

/**
 * Base types and interfaces for neural network models
 */

// Define 1D Tensor as simple number array for type safety
export type Tensor1D = number[];
export type Tensor2D = Tensor1D[];

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

/**
 * Dense (fully connected) layer implementation
 */
export class DenseLayer {
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
    // Initialize weights randomly if not provided
    this.weights = weights || Array(outputSize).fill(0).map(() => 
      Array(inputSize).fill(0).map(() => Math.random() * 0.2 - 0.1)
    );
    
    // Initialize bias with zeros if not provided
    this.bias = bias || Array(outputSize).fill(0);
    this.activation = activation;
  }
  
  forward(input: Tensor1D): Tensor1D {
    // Linear transformation: y = Wx + b
    const output = Array(this.bias.length).fill(0);
    
    for (let i = 0; i < output.length; i++) {
      let sum = this.bias[i];
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * this.weights[i][j];
      }
      
      // Apply activation function
      output[i] = this.applyActivation(sum, this.activation);
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
 * 1D Convolutional layer implementation
 */
export class Conv1DLayer {
  private filters: number[][][];  // [filterIndex][kernelPosition][channel]
  private bias: number[];
  private stride: number;
  private activation: string;
  
  constructor(
    inputChannels: number,
    outputChannels: number,
    kernelSize: number,
    stride: number = 1,
    activation: string = 'relu'
  ) {
    // Initialize filters randomly
    this.filters = Array(outputChannels).fill(0).map(() => 
      Array(kernelSize).fill(0).map(() => 
        Array(inputChannels).fill(0).map(() => Math.random() * 0.2 - 0.1)
      )
    );
    
    this.bias = Array(outputChannels).fill(0);
    this.stride = stride;
    this.activation = activation;
  }
  
  forward(input: Tensor2D): Tensor2D {
    const inputLength = input[0].length;
    const kernelSize = this.filters[0].length;
    const outputChannels = this.filters.length;
    const outputLength = Math.floor((inputLength - kernelSize) / this.stride) + 1;
    
    // Initialize output
    const output: Tensor2D = Array(outputChannels).fill(0).map(() => Array(outputLength).fill(0));
    
    // Apply convolution
    for (let outChannel = 0; outChannel < outputChannels; outChannel++) {
      for (let i = 0; i < outputLength; i++) {
        const startPos = i * this.stride;
        let sum = this.bias[outChannel];
        
        for (let k = 0; k < kernelSize; k++) {
          for (let inChannel = 0; inChannel < input.length; inChannel++) {
            if (startPos + k < inputLength) {
              sum += input[inChannel][startPos + k] * this.filters[outChannel][k][inChannel];
            }
          }
        }
        
        // Apply activation
        output[outChannel][i] = this.applyActivation(sum, this.activation);
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
 * Batch Normalization layer implementation
 */
export class BatchNormLayer {
  private gamma: number[];  // Scale
  private beta: number[];   // Shift
  private epsilon: number;  // Small constant for numerical stability
  
  constructor(channels: number, epsilon: number = 1e-5) {
    // Initialize parameters
    this.gamma = Array(channels).fill(1);  // Default scale is 1
    this.beta = Array(channels).fill(0);   // Default shift is 0
    this.epsilon = epsilon;
  }
  
  forward(input: Tensor2D): Tensor2D {
    const output: Tensor2D = [];
    
    // Apply batch normalization to each channel
    for (let c = 0; c < input.length; c++) {
      const channel = input[c];
      
      // Calculate mean
      const mean = channel.reduce((sum, val) => sum + val, 0) / channel.length;
      
      // Calculate variance
      let variance = 0;
      for (const val of channel) {
        variance += Math.pow(val - mean, 2);
      }
      variance /= channel.length;
      
      // Normalize, scale and shift
      const normalizedChannel = channel.map(val => 
        this.gamma[c] * ((val - mean) / Math.sqrt(variance + this.epsilon)) + this.beta[c]
      );
      
      output.push(normalizedChannel);
    }
    
    return output;
  }
}

/**
 * Pooling layer implementation (max or average pooling)
 */
export class Pooling1DLayer {
  private poolSize: number;
  private stride: number;
  private type: 'max' | 'avg';
  
  constructor(poolSize: number, stride: number, type: 'max' | 'avg' = 'max') {
    this.poolSize = poolSize;
    this.stride = stride;
    this.type = type;
  }
  
  forward(input: Tensor2D): Tensor2D {
    const channels = input.length;
    const inputLength = input[0].length;
    const outputLength = Math.floor((inputLength - this.poolSize) / this.stride) + 1;
    
    // Initialize output
    const output: Tensor2D = Array(channels).fill(0).map(() => Array(outputLength).fill(0));
    
    // Apply pooling
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < outputLength; i++) {
        const startPos = i * this.stride;
        const window = input[c].slice(startPos, startPos + this.poolSize);
        
        if (this.type === 'max') {
          output[c][i] = Math.max(...window);
        } else {  // avg
          const sum = window.reduce((acc, val) => acc + val, 0);
          output[c][i] = sum / window.length;
        }
      }
    }
    
    return output;
  }
}

/**
 * LSTM layer implementation (simplified)
 */
export class LSTMLayer {
  private inputSize: number;
  private hiddenSize: number;
  private weights: {
    // Input gates
    wf: number[][]; // Forget gate
    wi: number[][]; // Input gate
    wc: number[][]; // Cell state
    wo: number[][]; // Output gate
    
    // Hidden gates
    uf: number[][];
    ui: number[][];
    uc: number[][];
    uo: number[][];
    
    // Biases
    bf: number[];
    bi: number[];
    bc: number[];
    bo: number[];
  };
  
  constructor(inputSize: number, hiddenSize: number) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    
    // Initialize weights with small random values
    const initWeights = (rows: number, cols: number) =>
      Array(rows).fill(0).map(() =>
        Array(cols).fill(0).map(() => Math.random() * 0.2 - 0.1)
      );
    
    // Initialize biases with zeros
    const initBias = (size: number) => Array(size).fill(0);
    
    this.weights = {
      // Input weights
      wf: initWeights(hiddenSize, inputSize),
      wi: initWeights(hiddenSize, inputSize),
      wc: initWeights(hiddenSize, inputSize),
      wo: initWeights(hiddenSize, inputSize),
      
      // Hidden weights
      uf: initWeights(hiddenSize, hiddenSize),
      ui: initWeights(hiddenSize, hiddenSize),
      uc: initWeights(hiddenSize, hiddenSize),
      uo: initWeights(hiddenSize, hiddenSize),
      
      // Biases
      bf: initBias(hiddenSize),
      bi: initBias(hiddenSize),
      bc: initBias(hiddenSize),
      bo: initBias(hiddenSize)
    };
  }
  
  forward(input: Tensor2D): { output: Tensor2D; finalState: { c: Tensor1D; h: Tensor1D } } {
    const timeSteps = input.length;
    const batchSize = 1; // We assume batch size 1 for simplicity
    
    // Initialize hidden state and cell state
    let h = Array(this.hiddenSize).fill(0);
    let c = Array(this.hiddenSize).fill(0);
    
    const outputs: Tensor2D = [];
    
    // Process each time step
    for (let t = 0; t < timeSteps; t++) {
      const x = input[t];
      
      // Forget gate
      const fGate = this.sigmoid(this.add(
        this.matMul(this.weights.wf, x),
        this.add(this.matMul(this.weights.uf, h), this.weights.bf)
      ));
      
      // Input gate
      const iGate = this.sigmoid(this.add(
        this.matMul(this.weights.wi, x),
        this.add(this.matMul(this.weights.ui, h), this.weights.bi)
      ));
      
      // Cell state candidate
      const cCandidate = this.tanh(this.add(
        this.matMul(this.weights.wc, x),
        this.add(this.matMul(this.weights.uc, h), this.weights.bc)
      ));
      
      // Update cell state
      c = this.add(
        this.multiply(fGate, c),
        this.multiply(iGate, cCandidate)
      );
      
      // Output gate
      const oGate = this.sigmoid(this.add(
        this.matMul(this.weights.wo, x),
        this.add(this.matMul(this.weights.uo, h), this.weights.bo)
      ));
      
      // Update hidden state
      h = this.multiply(oGate, this.tanh(c));
      
      outputs.push([...h]); // Add copy of h to outputs
    }
    
    return {
      output: outputs,
      finalState: { c, h }
    };
  }
  
  private sigmoid(x: Tensor1D): Tensor1D {
    return x.map(val => 1 / (1 + Math.exp(-val)));
  }
  
  private tanh(x: Tensor1D): Tensor1D {
    return x.map(val => Math.tanh(val));
  }
  
  private matMul(mat: number[][], vec: Tensor1D): Tensor1D {
    return mat.map(row => {
      let sum = 0;
      for (let i = 0; i < row.length; i++) {
        sum += row[i] * (i < vec.length ? vec[i] : 0);
      }
      return sum;
    });
  }
  
  private add(a: Tensor1D, b: Tensor1D | number[]): Tensor1D {
    return a.map((val, i) => val + (i < b.length ? b[i] : 0));
  }
  
  private multiply(a: Tensor1D, b: Tensor1D): Tensor1D {
    return a.map((val, i) => val * (i < b.length ? b[i] : 0));
  }
}

/**
 * Residual block implementation
 */
export class ResidualBlock {
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  
  constructor(channels: number, kernelSize: number) {
    this.conv1 = new Conv1DLayer(channels, channels, kernelSize, 1, 'relu');
    this.bn1 = new BatchNormLayer(channels);
    this.conv2 = new Conv1DLayer(channels, channels, kernelSize, 1, 'linear');
    this.bn2 = new BatchNormLayer(channels);
  }
  
  forward(input: Tensor2D): Tensor2D {
    // Main path
    let x = this.conv1.forward(input);
    x = this.bn1.forward(x);
    
    // Apply ReLU
    x = x.map(channel => channel.map(val => Math.max(0, val)));
    
    x = this.conv2.forward(x);
    x = this.bn2.forward(x);
    
    // Skip connection: Add input to output
    const output: Tensor2D = [];
    for (let c = 0; c < input.length; c++) {
      const resChannel: Tensor1D = [];
      const minLength = Math.min(input[c].length, x[c].length);
      
      for (let i = 0; i < minLength; i++) {
        resChannel.push(input[c][i] + x[c][i]);
      }
      
      output.push(resChannel);
    }
    
    // Apply ReLU
    return output.map(channel => channel.map(val => Math.max(0, val)));
  }
}
