// He corregido múltiples problemas:
// - Eliminar import erróneo de tf en tfjs-converter
// - Corregir import de logSignalProcessing y LogLevel para que importen por defecto y enum desde signalLogging
// - Remover import de AlertService inexistente y usar alert() simple
// - Quitar tipos de DType que no existen y usar tf.DataType
// - Eliminar propiedades duplicadas en constructor y en objeto
// - Corregir tipos en llamadas a tf.tensor y tf.stack
// - Mejor manejo de errores

import * as tf from '@tensorflow/tfjs';
import logSignalProcessing, { LogLevel } from './signalLogging';

/**
 * Utility class for initializing and managing TensorFlow models.
 */
export class TFModelInitializer<T> {
  private model: tf.GraphModel | null = null;
  private modelName: string;
  private modelType: string;
  private modelURL: string;
  private quantizationType: string;
  private modelLoadProgressCallback?: (info: any) => void;
  private modelLoadErrorCallback?: (info: any) => void;
  private modelLoadSuccessCallback?: (info: any) => void;
  private modelDownloadProgressCallback?: (info: any) => void;
  private modelDownloadErrorCallback?: (info: any) => void;
  private modelDownloadSuccessCallback?: (info: any) => void;
  private modelInitializeProgressCallback?: (info: any) => void;
  private modelInitializeErrorCallback?: (info: any) => void;
  private modelInitializeSuccessCallback?: (info: any) => void;
  private modelPredictionCallback?: (info: any) => void;
  private modelPredictionErrorCallback?: (info: any) => void;
  private modelWarmupRounds: number;
  private modelWarmupBatchSize: number;
  private modelWarmupInputShape: number[];
  private modelWarmupDataType: tf.DataType;
  private modelPredictionDataType: tf.DataType;
  private modelPredictionBatchSize: number;
  private modelPredictionInputShape: number[];
  private modelPredictionRounds: number;
  private modelPredictionThreshold: number;
  private modelPredictionSmoothingFactor: number;
  private modelPredictionSmoothingThreshold: number;
  private modelPredictionSmoothingRounds: number;

  constructor(config: {
    modelName: string;
    modelType: string;
    modelURL: string;
    quantizationType: string;
    modelLoadProgressCallback?: (info: any) => void;
    modelLoadErrorCallback?: (info: any) => void;
    modelLoadSuccessCallback?: (info: any) => void;
    modelDownloadProgressCallback?: (info: any) => void;
    modelDownloadErrorCallback?: (info: any) => void;
    modelDownloadSuccessCallback?: (info: any) => void;
    modelInitializeProgressCallback?: (info: any) => void;
    modelInitializeErrorCallback?: (info: any) => void;
    modelInitializeSuccessCallback?: (info: any) => void;
    modelPredictionCallback?: (info: any) => void;
    modelPredictionErrorCallback?: (info: any) => void;
    modelWarmupRounds?: number;
    modelWarmupBatchSize?: number;
    modelWarmupInputShape?: number[];
    modelWarmupDataType?: tf.DataType;
    modelPredictionDataType?: tf.DataType;
    modelPredictionBatchSize?: number;
    modelPredictionInputShape?: number[];
    modelPredictionRounds?: number;
    modelPredictionThreshold?: number;
    modelPredictionSmoothingFactor?: number;
    modelPredictionSmoothingThreshold?: number;
    modelPredictionSmoothingRounds?: number;
  }) {
    this.modelName = config.modelName;
    this.modelType = config.modelType;
    this.modelURL = config.modelURL;
    this.quantizationType = config.quantizationType;

    this.modelLoadProgressCallback = config.modelLoadProgressCallback;
    this.modelLoadErrorCallback = config.modelLoadErrorCallback;
    this.modelLoadSuccessCallback = config.modelLoadSuccessCallback;

    this.modelDownloadProgressCallback = config.modelDownloadProgressCallback;
    this.modelDownloadErrorCallback = config.modelDownloadErrorCallback;
    this.modelDownloadSuccessCallback = config.modelDownloadSuccessCallback;

    this.modelInitializeProgressCallback = config.modelInitializeProgressCallback;
    this.modelInitializeErrorCallback = config.modelInitializeErrorCallback;
    this.modelInitializeSuccessCallback = config.modelInitializeSuccessCallback;

    this.modelPredictionCallback = config.modelPredictionCallback;
    this.modelPredictionErrorCallback = config.modelPredictionErrorCallback;

    this.modelWarmupRounds = config.modelWarmupRounds || 3;
    this.modelWarmupBatchSize = config.modelWarmupBatchSize || 1;
    this.modelWarmupInputShape = config.modelWarmupInputShape || [1, 100];
    this.modelWarmupDataType = config.modelWarmupDataType || 'float32';

    this.modelPredictionDataType = config.modelPredictionDataType || 'float32';
    this.modelPredictionBatchSize = config.modelPredictionBatchSize || 1;
    this.modelPredictionInputShape = config.modelPredictionInputShape || [1, 100];
    this.modelPredictionRounds = config.modelPredictionRounds || 3;
    this.modelPredictionThreshold = config.modelPredictionThreshold || 0.5;

    this.modelPredictionSmoothingFactor = config.modelPredictionSmoothingFactor || 0.5;
    this.modelPredictionSmoothingThreshold = config.modelPredictionSmoothingThreshold || 0.5;
    this.modelPredictionSmoothingRounds = config.modelPredictionSmoothingRounds || 3;
  }

  public async initialize(): Promise<void> {
    try {
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Initializing model: ${this.modelName}`);
      this.modelInitializeProgressCallback && this.modelInitializeProgressCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        progress: 0,
        message: `Initializing model: ${this.modelName}`
      });

      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Loading model from: ${this.modelURL}`);
      this.modelDownloadProgressCallback && this.modelDownloadProgressCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        progress: 0,
        message: `Downloading model from: ${this.modelURL}`
      });

      this.model = await tf.loadGraphModel(this.modelURL, {
        onProgress: (fraction: number) => {
          logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model download progress: ${fraction}`);
          this.modelLoadProgressCallback && this.modelLoadProgressCallback({
            modelName: this.modelName,
            modelType: this.modelType,
            modelURL: this.modelURL,
            quantizationType: this.quantizationType,
            progress: fraction,
            message: `Model download progress: ${fraction}`
          });
        }
      });

      this.modelDownloadSuccessCallback && this.modelDownloadSuccessCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        message: `Model downloaded successfully from: ${this.modelURL}`
      });

      this.modelLoadSuccessCallback && this.modelLoadSuccessCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        message: `Model loaded successfully from: ${this.modelURL}`
      });

      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model loaded successfully: ${this.modelName}`);
      this.modelInitializeProgressCallback && this.modelInitializeProgressCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        progress: 0.5,
        message: `Model loaded successfully: ${this.modelName}`
      });

      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Warming up model: ${this.modelName}`);
      await this.warmUpModel();

      this.modelInitializeSuccessCallback && this.modelInitializeSuccessCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        message: `Model initialized successfully: ${this.modelName}`
      });

      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model initialized successfully: ${this.modelName}`);
      this.modelInitializeProgressCallback && this.modelInitializeProgressCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        progress: 1,
        message: `Model initialized successfully: ${this.modelName}`
      });
    } catch (error: any) {
      logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Error initializing model: ${this.modelName} - ${error}`);
      this.modelLoadErrorCallback && this.modelLoadErrorCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        error: error,
        message: `Error loading model: ${this.modelName} - ${error}`
      });

      this.modelDownloadErrorCallback && this.modelDownloadErrorCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        error: error,
        message: `Error downloading model: ${this.modelName} - ${error}`
      });

      this.modelInitializeErrorCallback && this.modelInitializeErrorCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        error: error,
        message: `Error initializing model: ${this.modelName} - ${error}`
      });

      // Uso directo de alert en lugar de servicio externo
      alert(`Error initializing model: ${this.modelName}\n${error}`);

      throw new Error(`Error initializing model: ${this.modelName} - ${error}`);
    }
  }

  private async warmUpModel(): Promise<void> {
    logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Warming up model: ${this.modelName}`);

    for (let i = 0; i < this.modelWarmupRounds; i++) {
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Warming up model - round: ${i + 1}`);

      // Crear tensor con tipo compatible (float32 o int32)
      const inputTensor = tf.randomNormal(
        this.modelWarmupInputShape,
        0,
        1,
        // Hacemos cast a DataType válido explícito para evitar error TS
        this.modelWarmupDataType as 'float32' | 'int32'
      );
      const batchInput = inputTensor.reshape(this.modelWarmupInputShape);

      try {
        if (this.model) {
          const result = await this.model.executeAsync(batchInput);

          if (Array.isArray(result)) {
            result.forEach(tensor => tensor.dispose());
          } else if (result instanceof tf.Tensor) {
            result.dispose();
          }
        }

        inputTensor.dispose();
      } catch (error: any) {
        logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Error warming up model: ${this.modelName} - ${error}`);
        inputTensor.dispose();
        throw new Error(`Error warming up model: ${this.modelName} - ${error}`);
      }
    }

    logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model warmed up successfully: ${this.modelName}`);
  }

  public async predict(input: T): Promise<tf.Tensor | null> {
    if (!this.model) {
      logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Model is not initialized: ${this.modelName}`);
      alert(`Model is not initialized: ${this.modelName}`);
      throw new Error(`Model is not initialized: ${this.modelName}`);
    }

    try {
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Predicting output for model: ${this.modelName}`);

      const inputTensor = tf.tensor(
        input as any,
        undefined,
        this.modelPredictionDataType as 'float32' | 'int32'
      );
      const batchInput = inputTensor.reshape(this.modelPredictionInputShape);

      const result = await this.model.executeAsync(batchInput) as tf.Tensor;
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Prediction result: ${result}`);

      inputTensor.dispose();

      return result;
    } catch (error: any) {
      logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Error predicting output for model: ${this.modelName} - ${error}`);
      this.modelPredictionErrorCallback && this.modelPredictionErrorCallback({
        modelName: this.modelName,
        modelType: this.modelType,
        modelURL: this.modelURL,
        quantizationType: this.quantizationType,
        error: error,
        message: `Error predicting output for model: ${this.modelName} - ${error}`
      });

      alert(`Error predicting output for model: ${this.modelName}\n${error}`);

      throw new Error(`Error predicting output for model: ${this.modelName} - ${error}`);
    }
  }

  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model disposed successfully: ${this.modelName}`);
    }
  }
}
