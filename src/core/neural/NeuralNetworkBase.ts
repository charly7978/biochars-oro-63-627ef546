
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
  // Properties for model metadata
  private readonly _name: string;
  private readonly _inputShape: number[];
  private readonly _outputShape: number[];
  private readonly _version: string;
  private _lastPredictionTime: number = 0;
  
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
  
  /**
   * Update prediction time for performance tracking
   */
  protected updatePredictionTime(startTime: number): void {
    const elapsed = Date.now() - startTime;
    this._lastPredictionTime = elapsed;
  }
  
  /**
   * Get the last prediction time in ms
   */
  get lastPredictionTime(): number {
    return this._lastPredictionTime;
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

/**
 * Layer implementations for neural networks
 */

// Dense (fully connected) layer
export class DenseLayer {
  private weights: Tensor2D;
  private bias: Tensor1D;
  private inputSize: number;
  private outputSize: number;
  private activationFn: (x: number) => number;
  
  constructor(
    inputSize: number, 
    outputSize: number, 
    weights?: Tensor2D,
    bias?: Tensor1D,
    activation: 'relu' | 'sigmoid' | 'tanh' | 'linear' = 'linear'
  ) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    
    // Initialize weights and biases
    this.weights = weights || this.initializeWeights(inputSize, outputSize);
    this.bias = bias || this.initializeBias(outputSize);
    
    // Set activation function
    switch (activation) {
      case 'relu':
        this.activationFn = (x: number) => Math.max(0, x);
        break;
      case 'sigmoid':
        this.activationFn = (x: number) => 1 / (1 + Math.exp(-x));
        break;
      case 'tanh':
        this.activationFn = (x: number) => Math.tanh(x);
        break;
      default:
        this.activationFn = (x: number) => x; // linear
    }
  }
  
  forward(input: Tensor1D): Tensor1D {
    const output: Tensor1D = new Array(this.outputSize).fill(0);
    
    // Matrix multiplication: output = input * weights + bias
    for (let o = 0; o < this.outputSize; o++) {
      for (let i = 0; i < this.inputSize; i++) {
        output[o] += input[i] * this.weights[i][o];
      }
      output[o] += this.bias[o];
      
      // Apply activation function
      output[o] = this.activationFn(output[o]);
    }
    
    return output;
  }
  
  private initializeWeights(inputSize: number, outputSize: number): Tensor2D {
    const weights: Tensor2D = [];
    const scale = Math.sqrt(2 / (inputSize + outputSize)); // Xavier initialization
    
    for (let i = 0; i < inputSize; i++) {
      const row: Tensor1D = [];
      for (let o = 0; o < outputSize; o++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(row);
    }
    
    return weights;
  }
  
  private initializeBias(outputSize: number): Tensor1D {
    return new Array(outputSize).fill(0);
  }
}

// 1D Convolutional layer
export class Conv1DLayer {
  private filters: Tensor2D[];
  private bias: Tensor1D;
  private inputChannels: number;
  private outputChannels: number;
  private kernelSize: number;
  private stride: number;
  private activationFn: (x: number) => number;
  
  constructor(
    inputChannels: number, 
    outputChannels: number, 
    kernelSize: number, 
    stride: number = 1,
    activation: 'relu' | 'sigmoid' | 'tanh' | 'linear' = 'linear'
  ) {
    this.inputChannels = inputChannels;
    this.outputChannels = outputChannels;
    this.kernelSize = kernelSize;
    this.stride = stride;
    
    // Initialize filters and biases
    this.filters = this.initializeFilters(inputChannels, outputChannels, kernelSize);
    this.bias = this.initializeBias(outputChannels);
    
    // Set activation function
    switch (activation) {
      case 'relu':
        this.activationFn = (x: number) => Math.max(0, x);
        break;
      case 'sigmoid':
        this.activationFn = (x: number) => 1 / (1 + Math.exp(-x));
        break;
      case 'tanh':
        this.activationFn = (x: number) => Math.tanh(x);
        break;
      default:
        this.activationFn = (x: number) => x; // linear
    }
  }
  
  forward(input: Tensor1D[]): Tensor1D[] {
    const inputLength = input[0].length;
    const outputLength = Math.floor((inputLength - this.kernelSize) / this.stride) + 1;
    const output: Tensor1D[] = Array(this.outputChannels)
      .fill(0)
      .map(() => Array(outputLength).fill(0));
    
    // Apply convolution for each output channel
    for (let oc = 0; oc < this.outputChannels; oc++) {
      for (let i = 0; i < outputLength; i++) {
        const start = i * this.stride;
        
        let sum = 0;
        // Apply filter across all input channels
        for (let ic = 0; ic < this.inputChannels; ic++) {
          for (let k = 0; k < this.kernelSize; k++) {
            if (start + k < inputLength) {
              sum += input[ic][start + k] * this.filters[oc][ic][k];
            }
          }
        }
        
        // Add bias and apply activation
        output[oc][i] = this.activationFn(sum + this.bias[oc]);
      }
    }
    
    return output;
  }
  
  private initializeFilters(inputChannels: number, outputChannels: number, kernelSize: number): Tensor2D[] {
    const filters: Tensor2D[] = [];
    const scale = Math.sqrt(2 / (inputChannels * kernelSize));
    
    for (let oc = 0; oc < outputChannels; oc++) {
      const filter: Tensor2D = [];
      for (let ic = 0; ic < inputChannels; ic++) {
        const kernel: Tensor1D = [];
        for (let k = 0; k < kernelSize; k++) {
          kernel.push((Math.random() * 2 - 1) * scale);
        }
        filter.push(kernel);
      }
      filters.push(filter);
    }
    
    return filters;
  }
  
  private initializeBias(outputChannels: number): Tensor1D {
    return new Array(outputChannels).fill(0);
  }
}

// LSTM layer implementation
export class LSTMLayer {
  private inputSize: number;
  private hiddenSize: number;
  
  // LSTM cell weights
  private wf: Tensor2D; // forget gate
  private wi: Tensor2D; // input gate
  private wc: Tensor2D; // cell gate
  private wo: Tensor2D; // output gate
  
  // LSTM cell recurrent weights
  private uf: Tensor2D; // forget gate recurrent
  private ui: Tensor2D; // input gate recurrent
  private uc: Tensor2D; // cell gate recurrent
  private uo: Tensor2D; // output gate recurrent
  
  // Biases
  private bf: Tensor1D; // forget gate bias
  private bi: Tensor1D; // input gate bias
  private bc: Tensor1D; // cell gate bias
  private bo: Tensor1D; // output gate bias
  
  constructor(inputSize: number, hiddenSize: number) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    
    // Initialize weights
    this.wf = this.initializeWeights(inputSize, hiddenSize);
    this.wi = this.initializeWeights(inputSize, hiddenSize);
    this.wc = this.initializeWeights(inputSize, hiddenSize);
    this.wo = this.initializeWeights(inputSize, hiddenSize);
    
    // Initialize recurrent weights
    this.uf = this.initializeWeights(hiddenSize, hiddenSize);
    this.ui = this.initializeWeights(hiddenSize, hiddenSize);
    this.uc = this.initializeWeights(hiddenSize, hiddenSize);
    this.uo = this.initializeWeights(hiddenSize, hiddenSize);
    
    // Initialize biases
    this.bf = new Array(hiddenSize).fill(1); // Initialize forget gate bias to 1
    this.bi = new Array(hiddenSize).fill(0);
    this.bc = new Array(hiddenSize).fill(0);
    this.bo = new Array(hiddenSize).fill(0);
  }
  
  forward(inputs: Tensor1D[]): { outputs: Tensor1D[]; finalState: { c: Tensor1D; h: Tensor1D } } {
    const outputs: Tensor1D[] = [];
    let h = new Array(this.hiddenSize).fill(0); // Initial hidden state
    let c = new Array(this.hiddenSize).fill(0); // Initial cell state
    
    for (const x of inputs) {
      // Forget gate
      const f = this.sigmoid(this.add(
        this.matmul([x], this.wf)[0],
        this.matmul([h], this.uf)[0],
        this.bf
      ));
      
      // Input gate
      const i = this.sigmoid(this.add(
        this.matmul([x], this.wi)[0],
        this.matmul([h], this.ui)[0],
        this.bi
      ));
      
      // Cell gate
      const cNew = this.tanh(this.add(
        this.matmul([x], this.wc)[0],
        this.matmul([h], this.uc)[0],
        this.bc
      ));
      
      // Output gate
      const o = this.sigmoid(this.add(
        this.matmul([x], this.wo)[0],
        this.matmul([h], this.uo)[0],
        this.bo
      ));
      
      // Update cell state
      c = this.elementwiseMul(f, c);
      const cTemp = this.elementwiseMul(i, cNew);
      c = this.elementwiseAdd(c, cTemp);
      
      // Update hidden state
      h = this.elementwiseMul(o, this.tanh(c));
      
      outputs.push([...h]);
    }
    
    return {
      outputs,
      finalState: { c, h }
    };
  }
  
  private matmul(a: Tensor1D[], b: Tensor2D): Tensor1D[] {
    const result: Tensor1D[] = [];
    for (let i = 0; i < a.length; i++) {
      const row: number[] = new Array(b[0].length).fill(0);
      for (let j = 0; j < b[0].length; j++) {
        for (let k = 0; k < b.length; k++) {
          row[j] += a[i][k] * b[k][j];
        }
      }
      result.push(row);
    }
    return result;
  }
  
  private add(a: Tensor1D, b: Tensor1D, c: Tensor1D): Tensor1D {
    return a.map((val, i) => val + b[i] + c[i]);
  }
  
  private sigmoid(x: Tensor1D): Tensor1D {
    return x.map(val => 1 / (1 + Math.exp(-val)));
  }
  
  private tanh(x: Tensor1D): Tensor1D {
    return x.map(val => Math.tanh(val));
  }
  
  private elementwiseMul(a: Tensor1D, b: Tensor1D): Tensor1D {
    return a.map((val, i) => val * b[i]);
  }
  
  private elementwiseAdd(a: Tensor1D, b: Tensor1D): Tensor1D {
    return a.map((val, i) => val + b[i]);
  }
  
  private initializeWeights(inputSize: number, outputSize: number): Tensor2D {
    const weights: Tensor2D = [];
    const scale = Math.sqrt(2 / (inputSize + outputSize));
    
    for (let i = 0; i < inputSize; i++) {
      const row: Tensor1D = [];
      for (let o = 0; o < outputSize; o++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(row);
    }
    
    return weights;
  }
}

// 1D Pooling layer
export class Pooling1DLayer {
  private poolSize: number;
  private stride: number;
  private type: 'max' | 'avg';
  
  constructor(poolSize: number, stride: number = 1, type: 'max' | 'avg' = 'max') {
    this.poolSize = poolSize;
    this.stride = stride;
    this.type = type;
  }
  
  forward(input: Tensor1D[]): Tensor1D[] {
    const channels = input.length;
    const inputLength = input[0].length;
    const outputLength = Math.floor((inputLength - this.poolSize) / this.stride) + 1;
    
    const output: Tensor1D[] = Array(channels)
      .fill(0)
      .map(() => Array(outputLength).fill(0));
    
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < outputLength; i++) {
        const start = i * this.stride;
        
        if (this.type === 'max') {
          let maxVal = -Infinity;
          for (let j = 0; j < this.poolSize; j++) {
            if (start + j < inputLength) {
              maxVal = Math.max(maxVal, input[c][start + j]);
            }
          }
          output[c][i] = maxVal;
        } else { // avg pooling
          let sum = 0;
          let count = 0;
          for (let j = 0; j < this.poolSize; j++) {
            if (start + j < inputLength) {
              sum += input[c][start + j];
              count++;
            }
          }
          output[c][i] = sum / (count || 1);
        }
      }
    }
    
    return output;
  }
}

// Batch Normalization layer
export class BatchNormLayer {
  private channels: number;
  private epsilon: number = 1e-5;
  private gamma: Tensor1D; // Scale parameter
  private beta: Tensor1D;  // Shift parameter
  
  constructor(channels: number) {
    this.channels = channels;
    this.gamma = new Array(channels).fill(1);
    this.beta = new Array(channels).fill(0);
  }
  
  forward(input: Tensor1D[]): Tensor1D[] {
    const output: Tensor1D[] = [];
    
    for (let c = 0; c < this.channels; c++) {
      // Compute mean
      const mean = input[c].reduce((sum, val) => sum + val, 0) / input[c].length;
      
      // Compute variance
      const variance = input[c].reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / input[c].length;
      
      // Normalize, scale, and shift
      const normalized = input[c].map(val => 
        this.gamma[c] * ((val - mean) / Math.sqrt(variance + this.epsilon)) + this.beta[c]
      );
      
      output.push(normalized);
    }
    
    return output;
  }
}

// Residual Block
export class ResidualBlock {
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  private channels: number;
  
  constructor(channels: number, kernelSize: number) {
    this.channels = channels;
    this.conv1 = new Conv1DLayer(channels, channels, kernelSize, 1, 'relu');
    this.bn1 = new BatchNormLayer(channels);
    this.conv2 = new Conv1DLayer(channels, channels, kernelSize, 1, 'linear');
    this.bn2 = new BatchNormLayer(channels);
  }
  
  forward(input: Tensor1D[]): Tensor1D[] {
    // First convolution
    let x = this.conv1.forward(input);
    x = this.bn1.forward(x);
    
    // Second convolution
    x = this.conv2.forward(x);
    x = this.bn2.forward(x);
    
    // Residual connection
    for (let c = 0; c < this.channels; c++) {
      const minLength = Math.min(x[c].length, input[c].length);
      for (let i = 0; i < minLength; i++) {
        x[c][i] += input[c][i];
      }
      
      // ReLU activation
      x[c] = x[c].map(val => Math.max(0, val));
    }
    
    return x;
  }
}

// Attention Layer
export class AttentionLayer {
  private inputSize: number;
  private attentionHeads: number;
  private queryWeights: Tensor2D[];
  private keyWeights: Tensor2D[];
  private valueWeights: Tensor2D[];
  
  constructor(inputSize: number, attentionHeads: number) {
    this.inputSize = inputSize;
    this.attentionHeads = attentionHeads;
    
    // Initialize weights for Q, K, V
    this.queryWeights = Array(attentionHeads)
      .fill(0)
      .map(() => this.initializeWeights(inputSize, inputSize / attentionHeads));
    
    this.keyWeights = Array(attentionHeads)
      .fill(0)
      .map(() => this.initializeWeights(inputSize, inputSize / attentionHeads));
    
    this.valueWeights = Array(attentionHeads)
      .fill(0)
      .map(() => this.initializeWeights(inputSize, inputSize / attentionHeads));
  }
  
  forward(input: Tensor1D[]): Tensor1D[] {
    const output: Tensor1D[] = [];
    
    // For each item in the input
    for (const item of input) {
      // Apply attention for each head
      const headOutputs: Tensor1D[] = [];
      
      for (let h = 0; h < this.attentionHeads; h++) {
        // Linear projections
        const q = this.linearTransform(item, this.queryWeights[h]);
        const k = this.linearTransform(item, this.keyWeights[h]);
        const v = this.linearTransform(item, this.valueWeights[h]);
        
        // Attention weights: softmax(Q * K^T / sqrt(d_k))
        const scale = Math.sqrt(q.length);
        const attentionScores = this.softmax(q.map(qVal => qVal * k.reduce((sum, kVal) => sum + kVal, 0) / scale));
        
        // Weighted sum: attention * V
        const weightedSum = v.map(vVal => vVal * attentionScores.reduce((sum, attVal) => sum + attVal, 0));
        headOutputs.push(weightedSum);
      }
      
      // Concatenate outputs
      const concatOutput: Tensor1D = [];
      for (const headOutput of headOutputs) {
        concatOutput.push(...headOutput);
      }
      
      output.push(concatOutput);
    }
    
    return output;
  }
  
  private linearTransform(input: Tensor1D, weights: Tensor2D): Tensor1D {
    const result: Tensor1D = new Array(weights[0].length).fill(0);
    
    for (let o = 0; o < weights[0].length; o++) {
      for (let i = 0; i < input.length; i++) {
        result[o] += input[i] * weights[i][o];
      }
    }
    
    return result;
  }
  
  private softmax(x: Tensor1D): Tensor1D {
    const max = Math.max(...x);
    const expX = x.map(val => Math.exp(val - max));
    const sumExp = expX.reduce((sum, val) => sum + val, 0);
    return expX.map(val => val / sumExp);
  }
  
  private initializeWeights(inputSize: number, outputSize: number): Tensor2D {
    const weights: Tensor2D = [];
    const scale = Math.sqrt(2 / (inputSize + outputSize));
    
    for (let i = 0; i < inputSize; i++) {
      const row: Tensor1D = [];
      for (let o = 0; o < outputSize; o++) {
        row.push((Math.random() * 2 - 1) * scale);
      }
      weights.push(row);
    }
    
    return weights;
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
