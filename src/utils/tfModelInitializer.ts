import * as tf from '@tensorflow/tfjs';
import { loadGraphModel, tf as tfl } from '@tensorflow/tfjs-converter';

import {
  ModelConfig,
  TFModel,
  ModelLoadProgressCallback,
  ModelLoadErrorCallback,
  ModelLoadSuccessCallback,
  ModelDownloadProgressCallback,
  ModelDownloadErrorCallback,
  ModelDownloadSuccessCallback,
  ModelInitializeProgressCallback,
  ModelInitializeErrorCallback,
  ModelInitializeSuccessCallback,
  ModelPredictionCallback,
  ModelPredictionErrorCallback,
} from '../types/tf';
import { logSignalProcessing, LogLevel } from './signalLogging';
import { AlertService } from '../services/AlertService';

/**
 * Utility class for initializing and managing TensorFlow models.
 */
export class TFModelInitializer<T> {
  private model: tf.GraphModel | null = null;
  private modelConfig: ModelConfig;
  private modelName: string;
  private modelType: string;
  private modelURL: string;
  private quantizationType: string;
  private modelLoadProgressCallback?: ModelLoadProgressCallback;
  private modelLoadErrorCallback?: ModelLoadErrorCallback;
  private modelLoadSuccessCallback?: ModelLoadSuccessCallback;
  private modelDownloadProgressCallback?: ModelDownloadProgressCallback;
  private modelDownloadErrorCallback?: ModelDownloadErrorCallback;
  private modelDownloadSuccessCallback?: ModelDownloadSuccessCallback;
  private modelInitializeProgressCallback?: ModelInitializeProgressCallback;
  private modelInitializeErrorCallback?: ModelInitializeErrorCallback;
  private modelInitializeSuccessCallback?: ModelInitializeSuccessCallback;
  private modelPredictionCallback?: ModelPredictionCallback;
  private modelPredictionErrorCallback?: ModelPredictionErrorCallback;
  private modelWarmupRounds: number;
  private modelWarmupBatchSize: number;
  private modelWarmupInputShape: number[];
  private modelWarmupDataType: tf.DType;
  private modelPredictionDataType: tf.DType;
  private modelPredictionBatchSize: number;
  private modelPredictionInputShape: number[];
  private modelPredictionRounds: number;
  private modelPredictionThreshold: number;
  private modelPredictionSmoothingFactor: number;
  private modelPredictionSmoothingThreshold: number;
  private modelPredictionSmoothingRounds: number;
  private modelPredictionSmoothingDataType: tf.DType;
  private modelPredictionSmoothingBatchSize: number;
  private modelPredictionSmoothingInputShape: number[];
  private modelPredictionSmoothingThresholdFactor: number;
  private modelPredictionSmoothingThresholdOffset: number;
  private modelPredictionSmoothingThresholdRounds: number;
  private modelPredictionSmoothingThresholdDataType: tf.DType;
  private modelPredictionSmoothingThresholdBatchSize: number;
  private modelPredictionSmoothingThresholdInputShape: number[];
  private modelPredictionSmoothingThresholdThresholdFactor: number;
  private modelPredictionSmoothingThresholdThresholdOffset: number;
  private modelPredictionSmoothingThresholdThresholdRounds: number;
  private modelPredictionSmoothingThresholdThresholdDataType: tf.DType;
  private modelPredictionSmoothingThresholdThresholdBatchSize: number;
  private modelPredictionSmoothingThresholdThresholdInputShape: number[];
  private modelPredictionSmoothingThresholdThresholdThresholdFactor: number;
  private modelPredictionSmoothingThresholdThresholdOffset: number;
  private modelPredictionSmoothingThresholdThresholdThresholdRounds: number;
  private modelPredictionSmoothingThresholdThresholdThresholdDataType: tf.DType;
  private modelPredictionSmoothingThresholdThresholdBatchSize: number;
  private modelPredictionSmoothingThresholdThresholdInputShape: number[];
  private modelPredictionSmoothingThresholdThresholdThresholdFactor: number;
  private modelPredictionSmoothingThresholdThresholdOffset: number;
  private modelPredictionSmoothingThresholdThresholdRounds: number;
  private modelPredictionSmoothingThresholdThresholdDataType: tf.DType;
  private modelPredictionSmoothingThresholdThresholdBatchSize: number;

  /**
   * Constructor for TFModelInitializer.
   * @param {TFModel} config - The configuration object for the TensorFlow model.
   */
  constructor(config: TFModel) {
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
    this.modelPredictionSmoothingDataType = config.modelPredictionSmoothingDataType || 'float32';
    this.modelPredictionSmoothingBatchSize = config.modelPredictionSmoothingBatchSize || 1;
    this.modelPredictionSmoothingInputShape = config.modelPredictionSmoothingInputShape || [1, 100];
    this.modelPredictionSmoothingThresholdFactor = config.modelPredictionSmoothingThresholdFactor || 0.5;
    this.modelPredictionSmoothingThresholdOffset = config.modelPredictionSmoothingThresholdOffset || 0.5;
    this.modelPredictionSmoothingThresholdRounds = config.modelPredictionSmoothingThresholdRounds || 3;
    this.modelPredictionSmoothingThresholdDataType = config.modelPredictionSmoothingThresholdDataType || 'float32';
    this.modelPredictionSmoothingThresholdBatchSize = config.modelPredictionSmoothingThresholdBatchSize || 1;
    this.modelPredictionSmoothingThresholdInputShape = config.modelPredictionSmoothingThresholdInputShape || [1, 100];
    this.modelPredictionSmoothingThresholdThresholdFactor = config.modelPredictionSmoothingThresholdThresholdFactor || 0.5;
    this.modelPredictionSmoothingThresholdThresholdOffset = config.modelPredictionSmoothingThresholdThresholdOffset || 0.5;
    this.modelPredictionSmoothingThresholdThresholdRounds = config.modelPredictionSmoothingThresholdThresholdRounds || 3;
    this.modelPredictionSmoothingThresholdThresholdDataType = config.modelPredictionSmoothingThresholdThresholdDataType || 'float32';
    this.modelPredictionSmoothingThresholdThresholdBatchSize = config.modelPredictionSmoothingThresholdThresholdBatchSize || 1;
    this.modelPredictionSmoothingThresholdThresholdInputShape = config.modelPredictionSmoothingThresholdThresholdInputShape || [1, 100];
    this.modelPredictionSmoothingThresholdThresholdThresholdFactor = config.modelPredictionSmoothingThresholdThresholdThresholdFactor || 0.5;
    this.modelPredictionSmoothingThresholdThresholdOffset = config.modelPredictionSmoothingThresholdThresholdOffset || 0.5;
    this.modelPredictionSmoothingThresholdThresholdRounds = config.modelPredictionSmoothingThresholdThresholdRounds || 3;
    this.modelPredictionSmoothingThresholdThresholdThresholdDataType = config.modelPredictionSmoothingThresholdThresholdThresholdDataType || 'float32';
    this.modelPredictionSmoothingThresholdThresholdBatchSize = config.modelPredictionSmoothingThresholdThresholdBatchSize || 1;

    this.modelConfig = {
      modelName: this.modelName,
      modelType: this.modelType,
      modelURL: this.modelURL,
      quantizationType: this.quantizationType,
      modelLoadProgressCallback: this.modelLoadProgressCallback,
      modelLoadErrorCallback: this.modelLoadErrorCallback,
      modelLoadSuccessCallback: this.modelLoadSuccessCallback,
      modelDownloadProgressCallback: this.modelDownloadProgressCallback,
      modelDownloadErrorCallback: this.modelDownloadErrorCallback,
      modelDownloadSuccessCallback: this.modelDownloadSuccessCallback,
      modelInitializeProgressCallback: this.modelInitializeProgressCallback,
      modelInitializeErrorCallback: this.modelInitializeErrorCallback,
      modelInitializeSuccessCallback: this.modelInitializeSuccessCallback,
      modelPredictionCallback: this.modelPredictionCallback,
      modelPredictionErrorCallback: this.modelPredictionErrorCallback,
      modelWarmupRounds: this.modelWarmupRounds,
      modelWarmupBatchSize: this.modelWarmupBatchSize,
      modelWarmupInputShape: this.modelWarmupInputShape,
      modelWarmupDataType: this.modelWarmupDataType,
      modelPredictionDataType: this.modelPredictionDataType,
      modelPredictionBatchSize: this.modelPredictionBatchSize,
      modelPredictionInputShape: this.modelPredictionInputShape,
      modelPredictionRounds: this.modelPredictionRounds,
      modelPredictionThreshold: this.modelPredictionThreshold,
      modelPredictionSmoothingFactor: this.modelPredictionSmoothingFactor,
      modelPredictionSmoothingThreshold: this.modelPredictionSmoothingThreshold,
      modelPredictionSmoothingRounds: this.modelPredictionSmoothingRounds,
      modelPredictionSmoothingDataType: this.modelPredictionSmoothingDataType,
      modelPredictionSmoothingBatchSize: this.modelPredictionSmoothingBatchSize,
      modelPredictionSmoothingInputShape: this.modelPredictionSmoothingInputShape,
      modelPredictionSmoothingThresholdFactor: this.modelPredictionSmoothingThresholdFactor,
      modelPredictionSmoothingThresholdOffset: this.modelPredictionSmoothingThresholdOffset,
      modelPredictionSmoothingThresholdRounds: this.modelPredictionSmoothingThresholdRounds,
      modelPredictionSmoothingThresholdDataType: this.modelPredictionSmoothingThresholdDataType,
      modelPredictionSmoothingThresholdBatchSize: this.modelPredictionSmoothingThresholdBatchSize,
      modelPredictionSmoothingThresholdInputShape: this.modelPredictionSmoothingThresholdInputShape,
      modelPredictionSmoothingThresholdThresholdFactor: this.modelPredictionSmoothingThresholdThresholdFactor,
      modelPredictionSmoothingThresholdThresholdOffset: this.modelPredictionSmoothingThresholdThresholdOffset,
      modelPredictionSmoothingThresholdThresholdRounds: this.modelPredictionSmoothingThresholdThresholdRounds,
      modelPredictionSmoothingThresholdThresholdDataType: this.modelPredictionSmoothingThresholdThresholdDataType,
      modelPredictionSmoothingThresholdThresholdBatchSize: this.modelPredictionSmoothingThresholdThresholdBatchSize,
      modelPredictionSmoothingThresholdThresholdInputShape: this.modelPredictionSmoothingThresholdThresholdInputShape,
      modelPredictionSmoothingThresholdThresholdThresholdFactor: this.modelPredictionSmoothingThresholdThresholdThresholdFactor,
      modelPredictionSmoothingThresholdThresholdOffset: this.modelPredictionSmoothingThresholdThresholdOffset,
      modelPredictionSmoothingThresholdThresholdRounds: this.modelPredictionSmoothingThresholdThresholdRounds,
      modelPredictionSmoothingThresholdThresholdDataType: this.modelPredictionSmoothingThresholdThresholdDataType,
      modelPredictionSmoothingThresholdThresholdBatchSize: this.modelPredictionSmoothingThresholdThresholdBatchSize,
    };
  }

  /**
   * Initializes the TensorFlow model.
   * @returns {Promise<void>} - A promise that resolves when the model is initialized.
   */
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

      this.model = await loadGraphModel(this.modelURL, {
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

      AlertService.showAlert({
        title: `Error initializing model: ${this.modelName}`,
        description: `Error initializing model: ${this.modelName} - ${error}`,
        variant: "destructive",
      });

      throw new Error(`Error initializing model: ${this.modelName} - ${error}`);
    }
  }

  /**
   * Warms up the model by running a few inference rounds.
   * @returns {Promise<void>} - A promise that resolves when the model is warmed up.
   */
  private async warmUpModel(): Promise<void> {
    logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Warming up model: ${this.modelName}`);

    for (let i = 0; i < this.modelWarmupRounds; i++) {
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Warming up model - round: ${i + 1}`);
      const inputTensor = tf.randomNormal(this.modelWarmupInputShape, 0, 1, this.modelWarmupDataType as tf.DType, null);
      const batchInput = tf.stack([inputTensor.reshape(this.modelWarmupInputShape)]);

      try {
        const result = await this.model?.executeAsync(batchInput);

        if (Array.isArray(result)) {
          result.forEach(tensor => tensor.dispose());
        } else if (result instanceof tf.Tensor) {
          result.dispose();
        }

        inputTensor.dispose();
        batchInput.dispose();
      } catch (error: any) {
        logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Error warming up model: ${this.modelName} - ${error}`);
        inputTensor.dispose();
        batchInput.dispose();
        throw new Error(`Error warming up model: ${this.modelName} - ${error}`);
      }
    }

    logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model warmed up successfully: ${this.modelName}`);
  }

  /**
   * Predicts the output for a given input.
   * @param {T} input - The input for the model.
   * @returns {Promise<tf.Tensor | null>} - A promise that resolves with the output of the model.
   */
  public async predict(input: T): Promise<tf.Tensor | null> {
    if (!this.model) {
      logSignalProcessing(LogLevel.ERROR, `[TFModelInitializer] Model is not initialized: ${this.modelName}`);
      AlertService.showAlert({
        title: `Model is not initialized: ${this.modelName}`,
        description: `Model is not initialized: ${this.modelName}`,
        variant: "destructive",
      });
      throw new Error(`Model is not initialized: ${this.modelName}`);
    }

    try {
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Predicting output for model: ${this.modelName}`);
      const inputTensor = tf.tensor(input as any, this.modelPredictionDataType as tf.DType,);
      const batchInput = tf.stack([inputTensor.reshape(this.modelPredictionInputShape)]);

      const result = await this.model.executeAsync(batchInput) as tf.Tensor;
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Prediction result: ${result}`);

      inputTensor.dispose();
      batchInput.dispose();

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

      AlertService.showAlert({
        title: `Error predicting output for model: ${this.modelName}`,
        description: `Error predicting output for model: ${this.modelName} - ${error}`,
        variant: "destructive",
      });

      throw new Error(`Error predicting output for model: ${this.modelName} - ${error}`);
    }
  }

  /**
   * Disposes of the model and releases the memory.
   * @returns {void}
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      logSignalProcessing(LogLevel.INFO, `[TFModelInitializer] Model disposed successfully: ${this.modelName}`);
    }
  }
}
