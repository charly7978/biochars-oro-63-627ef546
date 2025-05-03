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
