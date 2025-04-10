
/**
 * Módulo base para redes neuronales optimizadas para dispositivos móviles
 * Implementa arquitecturas ligeras pero potentes para análisis de señales PPG
 */

// Tipos comunes para redes neuronales
export type Tensor1D = number[];
export type Tensor2D = number[][];
export type Tensor3D = number[][][];
export type Tensor4D = number[][][][];
export type TensorShape = number[];
export type ActivationFunction = 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear';

/**
 * Interfaz base para modelos de redes neuronales
 */
export interface NeuralModel {
  predict(input: Tensor1D | Tensor2D | Tensor3D): Tensor1D;
  getModelInfo(): ModelInfo;
}

/**
 * Información del modelo
 */
export interface ModelInfo {
  name: string;
  inputShape: TensorShape;
  outputShape: TensorShape;
  parameterCount: number;
  architecture: string;
  lastUpdateTime: number;
  version: string;
  accuracy: number;
  predictionTimeMs: number;
}

/**
 * Implementación optimizada de capa densa (fully connected)
 * Versión ligera diseñada para rendimiento en dispositivos móviles
 */
export class DenseLayer {
  weights: Tensor2D;
  bias: Tensor1D;
  activation: ActivationFunction;
  
  constructor(
    inputSize: number,
    outputSize: number,
    weights?: Tensor2D,
    bias?: Tensor1D,
    activation: ActivationFunction = 'relu'
  ) {
    if (weights && bias) {
      this.weights = weights;
      this.bias = bias;
    } else {
      // Inicialización He (para ReLU)
      const scale = Math.sqrt(2 / inputSize);
      this.weights = Array(outputSize).fill(0).map(() => 
        Array(inputSize).fill(0).map(() => (Math.random() * 2 - 1) * scale)
      );
      this.bias = Array(outputSize).fill(0);
    }
    this.activation = activation;
  }
  
  forward(input: Tensor1D): Tensor1D {
    // Multiplicación de matriz y vector optimizada
    const preActivation = this.weights.map((weightRow, i) => {
      let sum = this.bias[i];
      for (let j = 0; j < input.length; j++) {
        sum += weightRow[j] * input[j];
      }
      return sum;
    });
    
    // Aplicar función de activación
    return this.applyActivation(preActivation);
  }
  
  applyActivation(values: Tensor1D): Tensor1D {
    switch (this.activation) {
      case 'relu':
        return values.map(x => x > 0 ? x : 0);
      case 'sigmoid':
        return values.map(x => 1 / (1 + Math.exp(-x)));
      case 'tanh':
        return values.map(x => Math.tanh(x));
      case 'softmax':
        const expValues = values.map(x => Math.exp(x - Math.max(...values)));
        const sumExp = expValues.reduce((a, b) => a + b, 0);
        return expValues.map(x => x / sumExp);
      case 'linear':
      default:
        return values;
    }
  }
}

/**
 * Implementación optimizada de capa convolucional 1D
 * Especialmente diseñada para señales PPG temporales
 */
export class Conv1DLayer {
  kernels: Tensor2D[];
  bias: Tensor1D;
  activation: ActivationFunction;
  kernelSize: number;
  stride: number;
  
  constructor(
    inputChannels: number,
    outputChannels: number,
    kernelSize: number,
    stride: number = 1,
    activation: ActivationFunction = 'relu'
  ) {
    this.kernelSize = kernelSize;
    this.stride = stride;
    this.activation = activation;
    
    // Inicialización He
    const scale = Math.sqrt(2 / (inputChannels * kernelSize));
    
    // Crear kernels para cada canal de salida
    this.kernels = Array(outputChannels).fill(0).map(() => 
      Array(inputChannels).fill(0).map(() => 
        Array(kernelSize).fill(0).map(() => (Math.random() * 2 - 1) * scale)
      )
    );
    
    this.bias = Array(outputChannels).fill(0);
  }
  
  forward(input: Tensor2D): Tensor2D {
    const [batchSize, inputLength] = [1, input.length];
    const outputLength = Math.floor((inputLength - this.kernelSize) / this.stride) + 1;
    const outputChannels = this.kernels.length;
    
    // Crear tensor de salida
    const output: Tensor2D = Array(outputChannels).fill(0).map(() => 
      Array(outputLength).fill(0)
    );
    
    // Realizar convolución 1D
    for (let c = 0; c < outputChannels; c++) {
      for (let i = 0; i < outputLength; i++) {
        const inputStart = i * this.stride;
        let value = this.bias[c];
        
        // Aplicar kernel a la ventana de entrada
        for (let ic = 0; ic < input.length; ic++) {
          for (let k = 0; k < this.kernelSize; k++) {
            if (inputStart + k < input[ic].length) {
              value += this.kernels[c][ic][k] * input[ic][inputStart + k];
            }
          }
        }
        
        output[c][i] = value;
      }
    }
    
    // Aplicar activación
    return output.map(channel => this.applyActivation(channel));
  }
  
  applyActivation(values: Tensor1D): Tensor1D {
    switch (this.activation) {
      case 'relu':
        return values.map(x => x > 0 ? x : 0);
      case 'sigmoid':
        return values.map(x => 1 / (1 + Math.exp(-x)));
      case 'tanh':
        return values.map(x => Math.tanh(x));
      case 'linear':
      default:
        return values;
    }
  }
}

/**
 * Implementación de capa LSTM optimizada para señales temporales
 * Especialmente eficiente para capturar patrones en señales PPG
 */
export class LSTMLayer {
  inputSize: number;
  hiddenSize: number;
  
  // Pesos para puerta de entrada
  Wi: Tensor2D;
  Ui: Tensor2D;
  bi: Tensor1D;
  
  // Pesos para puerta de olvido
  Wf: Tensor2D;
  Uf: Tensor2D;
  bf: Tensor1D;
  
  // Pesos para puerta de salida
  Wo: Tensor2D;
  Uo: Tensor2D;
  bo: Tensor1D;
  
  // Pesos para candidato de celda
  Wc: Tensor2D;
  Uc: Tensor2D;
  bc: Tensor1D;
  
  constructor(
    inputSize: number,
    hiddenSize: number,
    weights?: {
      Wi: Tensor2D; Ui: Tensor2D; bi: Tensor1D;
      Wf: Tensor2D; Uf: Tensor2D; bf: Tensor1D;
      Wo: Tensor2D; Uo: Tensor2D; bo: Tensor1D;
      Wc: Tensor2D; Uc: Tensor2D; bc: Tensor1D;
    }
  ) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    
    if (weights) {
      // Usar pesos proporcionados
      this.Wi = weights.Wi; this.Ui = weights.Ui; this.bi = weights.bi;
      this.Wf = weights.Wf; this.Uf = weights.Uf; this.bf = weights.bf;
      this.Wo = weights.Wo; this.Uo = weights.Uo; this.bo = weights.bo;
      this.Wc = weights.Wc; this.Uc = weights.Uc; this.bc = weights.bc;
    } else {
      // Inicializar pesos
      const initScale = Math.sqrt(1 / inputSize);
      
      const createMatrix = () => Array(hiddenSize).fill(0).map(() => 
        Array(inputSize).fill(0).map(() => (Math.random() * 2 - 1) * initScale)
      );
      
      const createRecurrentMatrix = () => Array(hiddenSize).fill(0).map(() => 
        Array(hiddenSize).fill(0).map(() => (Math.random() * 2 - 1) * initScale)
      );
      
      const createBias = (val = 0) => Array(hiddenSize).fill(val);
      
      // Pesos para puerta de entrada
      this.Wi = createMatrix();
      this.Ui = createRecurrentMatrix();
      this.bi = createBias();
      
      // Pesos para puerta de olvido (inicializado con sesgo positivo para mejor convergencia)
      this.Wf = createMatrix();
      this.Uf = createRecurrentMatrix();
      this.bf = createBias(1.0);  // Sesgo positivo para la puerta de olvido
      
      // Pesos para puerta de salida
      this.Wo = createMatrix();
      this.Uo = createRecurrentMatrix();
      this.bo = createBias();
      
      // Pesos para candidato de celda
      this.Wc = createMatrix();
      this.Uc = createRecurrentMatrix();
      this.bc = createBias();
    }
  }
  
  forward(input: Tensor2D, initialState?: { h: Tensor1D, c: Tensor1D }): { 
    output: Tensor2D, 
    finalState: { h: Tensor1D, c: Tensor1D } 
  } {
    const timeSteps = input.length;
    const batchSize = 1;  // Procesamiento optimizado para batch_size=1
    
    // Estados iniciales
    let h = initialState?.h || Array(this.hiddenSize).fill(0);
    let c = initialState?.c || Array(this.hiddenSize).fill(0);
    
    // Tensor de salida
    const outputs: Tensor2D = [];
    
    // Procesar cada paso de tiempo
    for (let t = 0; t < timeSteps; t++) {
      const xt = input[t];
      
      // Puerta de olvido
      const ft = this.sigmoid(this.add(
        this.matrixVectorMul(this.Wf, xt),
        this.matrixVectorMul(this.Uf, h),
        this.bf
      ));
      
      // Puerta de entrada
      const it = this.sigmoid(this.add(
        this.matrixVectorMul(this.Wi, xt),
        this.matrixVectorMul(this.Ui, h),
        this.bi
      ));
      
      // Candidato de celda
      const ct_candidate = this.tanh(this.add(
        this.matrixVectorMul(this.Wc, xt),
        this.matrixVectorMul(this.Uc, h),
        this.bc
      ));
      
      // Actualización de celda
      c = this.elementwiseMul(ft, c);
      const itct = this.elementwiseMul(it, ct_candidate);
      c = this.add(c, itct);
      
      // Puerta de salida
      const ot = this.sigmoid(this.add(
        this.matrixVectorMul(this.Wo, xt),
        this.matrixVectorMul(this.Uo, h),
        this.bo
      ));
      
      // Estado oculto
      h = this.elementwiseMul(ot, this.tanh(c));
      
      // Agregar salida actual
      outputs.push([...h]);
    }
    
    return {
      output: outputs,
      finalState: { h, c }
    };
  }
  
  // Funciones auxiliares
  private sigmoid(x: Tensor1D): Tensor1D {
    return x.map(v => 1 / (1 + Math.exp(-v)));
  }
  
  private tanh(x: Tensor1D): Tensor1D {
    return x.map(v => Math.tanh(v));
  }
  
  private add(...vectors: Tensor1D[]): Tensor1D {
    const result = [...vectors[0]];
    for (let i = 1; i < vectors.length; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] += vectors[i][j];
      }
    }
    return result;
  }
  
  private elementwiseMul(a: Tensor1D, b: Tensor1D): Tensor1D {
    return a.map((v, i) => v * b[i]);
  }
  
  private matrixVectorMul(matrix: Tensor2D, vector: Tensor1D): Tensor1D {
    return matrix.map(row => {
      let sum = 0;
      for (let i = 0; i < row.length; i++) {
        sum += row[i] * vector[i];
      }
      return sum;
    });
  }
}

/**
 * Implementación de capa de pooling 1D para reducción de dimensionalidad
 */
export class Pooling1DLayer {
  poolSize: number;
  stride: number;
  mode: 'max' | 'avg';
  
  constructor(poolSize: number, stride: number = poolSize, mode: 'max' | 'avg' = 'max') {
    this.poolSize = poolSize;
    this.stride = stride;
    this.mode = mode;
  }
  
  forward(input: Tensor2D): Tensor2D {
    const [channels, inputLength] = [input.length, input[0].length];
    const outputLength = Math.floor((inputLength - this.poolSize) / this.stride) + 1;
    
    // Crear tensor de salida
    const output: Tensor2D = Array(channels).fill(0).map(() => 
      Array(outputLength).fill(0)
    );
    
    // Aplicar pooling a cada canal
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < outputLength; i++) {
        const start = i * this.stride;
        const end = Math.min(start + this.poolSize, inputLength);
        
        if (this.mode === 'max') {
          // Max pooling
          output[c][i] = Math.max(...input[c].slice(start, end));
        } else {
          // Average pooling
          const sum = input[c].slice(start, end).reduce((a, b) => a + b, 0);
          output[c][i] = sum / (end - start);
        }
      }
    }
    
    return output;
  }
}

/**
 * Implementación de capa de atención optimizada para señales PPG
 * Especialmente útil para detectar características importantes en la señal
 */
export class AttentionLayer {
  inputSize: number;
  attentionSize: number;
  Wq: Tensor2D; // Pesos para consulta
  Wk: Tensor2D; // Pesos para clave
  Wv: Tensor2D; // Pesos para valor
  
  constructor(inputSize: number, attentionSize: number) {
    this.inputSize = inputSize;
    this.attentionSize = attentionSize;
    
    // Inicializar pesos
    const scale = Math.sqrt(1 / inputSize);
    const createMatrix = () => Array(attentionSize).fill(0).map(() => 
      Array(inputSize).fill(0).map(() => (Math.random() * 2 - 1) * scale)
    );
    
    this.Wq = createMatrix();
    this.Wk = createMatrix();
    this.Wv = createMatrix();
  }
  
  forward(input: Tensor2D): Tensor2D {
    const timeSteps = input.length;
    
    // Calcular consultas, claves y valores
    const queries: Tensor2D = [];
    const keys: Tensor2D = [];
    const values: Tensor2D = [];
    
    for (let t = 0; t < timeSteps; t++) {
      const xt = input[t];
      queries.push(this.matrixVectorMul(this.Wq, xt));
      keys.push(this.matrixVectorMul(this.Wk, xt));
      values.push(this.matrixVectorMul(this.Wv, xt));
    }
    
    // Calcular puntuaciones de atención
    const scores: Tensor2D = Array(timeSteps).fill(0).map(() => 
      Array(timeSteps).fill(0)
    );
    
    for (let t = 0; t < timeSteps; t++) {
      for (let s = 0; s < timeSteps; s++) {
        scores[t][s] = this.dotProduct(queries[t], keys[s]) / Math.sqrt(this.attentionSize);
      }
    }
    
    // Aplicar softmax a las puntuaciones
    const attentionWeights: Tensor2D = [];
    for (let t = 0; t < timeSteps; t++) {
      const expScores = scores[t].map(s => Math.exp(s - Math.max(...scores[t])));
      const sumExp = expScores.reduce((a, b) => a + b, 0);
      attentionWeights.push(expScores.map(e => e / sumExp));
    }
    
    // Calcular contexto ponderado
    const context: Tensor2D = [];
    for (let t = 0; t < timeSteps; t++) {
      const weightedSum = Array(this.attentionSize).fill(0);
      for (let s = 0; s < timeSteps; s++) {
        for (let j = 0; j < this.attentionSize; j++) {
          weightedSum[j] += attentionWeights[t][s] * values[s][j];
        }
      }
      context.push(weightedSum);
    }
    
    return context;
  }
  
  private matrixVectorMul(matrix: Tensor2D, vector: Tensor1D): Tensor1D {
    return matrix.map(row => {
      let sum = 0;
      for (let i = 0; i < row.length; i++) {
        sum += row[i] * (i < vector.length ? vector[i] : 0);
      }
      return sum;
    });
  }
  
  private dotProduct(a: Tensor1D, b: Tensor1D): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }
}

/**
 * Implementación de capa de normalización de batch
 */
export class BatchNormLayer {
  gamma: Tensor1D;
  beta: Tensor1D;
  eps: number = 1e-5;
  movingMean: Tensor1D;
  movingVar: Tensor1D;
  
  constructor(size: number) {
    this.gamma = Array(size).fill(1);
    this.beta = Array(size).fill(0);
    this.movingMean = Array(size).fill(0);
    this.movingVar = Array(size).fill(1);
  }
  
  forward(input: Tensor2D, training: boolean = false): Tensor2D {
    const [channels, length] = [input.length, input[0].length];
    
    if (training) {
      // Calcular media y varianza por canal
      const means: Tensor1D = [];
      const vars: Tensor1D = [];
      
      for (let c = 0; c < channels; c++) {
        const mean = input[c].reduce((a, b) => a + b, 0) / length;
        
        let variance = 0;
        for (let i = 0; i < length; i++) {
          variance += Math.pow(input[c][i] - mean, 2);
        }
        variance /= length;
        
        means.push(mean);
        vars.push(variance);
        
        // Actualizar estadísticas móviles
        const momentum = 0.9;
        this.movingMean[c] = momentum * this.movingMean[c] + (1 - momentum) * mean;
        this.movingVar[c] = momentum * this.movingVar[c] + (1 - momentum) * variance;
      }
      
      // Normalizar y escalar
      const output: Tensor2D = [];
      for (let c = 0; c < channels; c++) {
        const normalized = input[c].map(x => 
          (x - means[c]) / Math.sqrt(vars[c] + this.eps)
        );
        
        output.push(normalized.map(x => 
          x * this.gamma[c] + this.beta[c]
        ));
      }
      
      return output;
    } else {
      // Usar estadísticas móviles en inferencia
      const output: Tensor2D = [];
      for (let c = 0; c < channels; c++) {
        const normalized = input[c].map(x => 
          (x - this.movingMean[c]) / Math.sqrt(this.movingVar[c] + this.eps)
        );
        
        output.push(normalized.map(x => 
          x * this.gamma[c] + this.beta[c]
        ));
      }
      
      return output;
    }
  }
}

/**
 * Implementación de capa residual para redes profundas
 */
export class ResidualBlock {
  conv1: Conv1DLayer;
  bn1: BatchNormLayer;
  conv2: Conv1DLayer;
  bn2: BatchNormLayer;
  
  constructor(channels: number, kernelSize: number = 3) {
    this.conv1 = new Conv1DLayer(channels, channels, kernelSize, 1, 'relu');
    this.bn1 = new BatchNormLayer(channels);
    this.conv2 = new Conv1DLayer(channels, channels, kernelSize, 1, 'linear');
    this.bn2 = new BatchNormLayer(channels);
  }
  
  forward(input: Tensor2D, training: boolean = false): Tensor2D {
    // Rama principal
    let x = this.conv1.forward(input);
    x = this.bn1.forward(x, training);
    
    x = this.conv2.forward(x);
    x = this.bn2.forward(x, training);
    
    // Conexión residual
    const output: Tensor2D = [];
    for (let c = 0; c < x.length; c++) {
      const channel: Tensor1D = [];
      for (let i = 0; i < x[c].length; i++) {
        // Si las dimensiones no coinciden, recortar o rellenar
        const inputValue = i < input[c].length ? input[c][i] : 0;
        channel.push(x[c][i] + inputValue);
      }
      output.push(channel);
    }
    
    // ReLU después de la suma
    return output.map(channel => channel.map(x => x > 0 ? x : 0));
  }
}

/**
 * Utilidades para manipulación de tensores
 */
export class TensorUtils {
  /**
   * Aplanar un tensor 2D a 1D
   */
  static flatten(input: Tensor2D): Tensor1D {
    const result: Tensor1D = [];
    for (const row of input) {
      result.push(...row);
    }
    return result;
  }
  
  /**
   * Dar forma de tensor 2D a partir de 1D
   */
  static reshape2D(input: Tensor1D, shape: [number, number]): Tensor2D {
    const [rows, cols] = shape;
    const result: Tensor2D = [];
    
    for (let i = 0; i < rows; i++) {
      const row: Tensor1D = [];
      for (let j = 0; j < cols; j++) {
        const index = i * cols + j;
        row.push(index < input.length ? input[index] : 0);
      }
      result.push(row);
    }
    
    return result;
  }
  
  /**
   * Realizar zero-padding en un tensor 2D
   */
  static padZeros2D(input: Tensor2D, padStart: number, padEnd: number): Tensor2D {
    return input.map(channel => {
      const padded = Array(padStart).fill(0).concat(channel).concat(Array(padEnd).fill(0));
      return padded;
    });
  }
  
  /**
   * Convertir una señal 1D a formato de tensor 2D (canales, longitud)
   */
  static signalToTensor(signal: Tensor1D, windowSize: number, stride: number = 1): Tensor2D {
    const windows: Tensor2D = [];
    
    for (let i = 0; i < signal.length - windowSize + 1; i += stride) {
      const window = signal.slice(i, i + windowSize);
      windows.push(window);
    }
    
    return windows;
  }
  
  /**
   * Normalizar una señal a rango [0, 1]
   */
  static normalizeSignal(signal: Tensor1D): Tensor1D {
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    
    if (max === min) return signal.map(() => 0.5);
    
    return signal.map(x => (x - min) / (max - min));
  }
  
  /**
   * Realiza z-score normalización (media=0, desv.estándar=1)
   */
  static standardizeSignal(signal: Tensor1D): Tensor1D {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    
    let variance = 0;
    for (const x of signal) {
      variance += Math.pow(x - mean, 2);
    }
    variance /= signal.length;
    
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return signal.map(() => 0);
    
    return signal.map(x => (x - mean) / stdDev);
  }
}

/**
 * Base para implementar modelos neurales personalizados
 */
export abstract class BaseNeuralModel implements NeuralModel {
  protected name: string;
  protected inputShape: TensorShape;
  protected outputShape: TensorShape;
  protected version: string;
  protected lastUpdateTime: number;
  protected accuracy: number;
  protected predictionTimeMs: number;
  
  constructor(
    name: string, 
    inputShape: TensorShape, 
    outputShape: TensorShape, 
    version: string = '1.0.0'
  ) {
    this.name = name;
    this.inputShape = inputShape;
    this.outputShape = outputShape;
    this.version = version;
    this.lastUpdateTime = Date.now();
    this.accuracy = 0;
    this.predictionTimeMs = 0;
  }
  
  abstract predict(input: Tensor1D | Tensor2D | Tensor3D): Tensor1D;
  
  abstract get parameterCount(): number;
  
  abstract get architecture(): string;
  
  getModelInfo(): ModelInfo {
    return {
      name: this.name,
      inputShape: this.inputShape,
      outputShape: this.outputShape,
      parameterCount: this.parameterCount,
      architecture: this.architecture,
      lastUpdateTime: this.lastUpdateTime,
      version: this.version,
      accuracy: this.accuracy,
      predictionTimeMs: this.predictionTimeMs
    };
  }
  
  protected updatePredictionTime(startTime: number): void {
    this.predictionTimeMs = Date.now() - startTime;
  }
  
  protected updateAccuracy(acc: number): void {
    this.accuracy = acc;
  }
}
