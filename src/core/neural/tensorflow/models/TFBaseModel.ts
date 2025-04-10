
import * as tf from '@tensorflow/tfjs';
import { BaseNeuralModel, Tensor1D } from '../../NeuralNetworkBase';
import { TensorUtils } from '../TensorAdapter';
import { CalibrableModel } from '../TensorFlowModelRegistry';

/**
 * Clase base para todos los modelos de TensorFlow
 * Implementa la interfaz BaseNeuralModel y CalibrableModel
 */
export abstract class TFBaseModel extends BaseNeuralModel implements CalibrableModel {
  protected tfModel: tf.LayersModel | null = null;
  protected calibrationFactor: number = 1.0;
  protected isCalibrating: boolean = false;
  protected lastPredictionTime: number = 0;
  
  constructor(
    name: string,
    inputShape: number[],
    outputShape: number[],
    version: string
  ) {
    super(name, inputShape, outputShape, version);
    this.initModel();
  }
  
  /**
   * Inicializa el modelo de TensorFlow (debe ser implementado por subclases)
   */
  protected abstract initModel(): Promise<void>;
  
  /**
   * Crea un modelo de TensorFlow.js (debe ser implementado por subclases)
   */
  protected abstract createModel(): tf.LayersModel;
  
  /**
   * Implementa el método predict de manera sincrónica utilizando un wrapper
   * sobre la implementación asíncrona para mantener compatibilidad con BaseNeuralModel
   */
  predict(input: Tensor1D): Tensor1D {
    try {
      // Si no está inicializado, devolver valores por defecto
      if (!this.tfModel) {
        return this.getDefaultOutput();
      }
      
      // Hacemos una predicción sincrónica usando valores precomputados
      // La inicialización real y actualización se hace de forma asíncrona 
      const startTime = Date.now();
      
      // Aplicar calibración si corresponde
      const calibratedInput = this.applyInputCalibration(input);
      
      // Preprocesar y convertir a tensor
      const tensor = TensorUtils.preprocessForTensorFlow(calibratedInput, this.inputShape[0]);
      
      // Syncronous predict using tf.tidy for automatic memory management
      const result = tf.tidy(() => {
        // Hacer predicción y convertir a JS array
        const prediction = this.tfModel!.predict(tensor) as tf.Tensor;
        return Array.from(prediction.dataSync() as Float32Array);
      });
      
      // Limpiar tensores
      tensor.dispose();
      
      // Aplicar calibración a la salida si corresponde
      const calibratedOutput = this.applyOutputCalibration(result);
      
      // Actualizar tiempo de predicción
      this.lastPredictionTime = Date.now() - startTime;
      
      return calibratedOutput;
    } catch (error) {
      console.error(`Error en ${this.getModelInfo().name}.predict:`, error);
      return this.getDefaultOutput();
    }
  }
  
  /**
   * Versión asíncrona del método predict para ser usada por el worker
   */
  async predictAsync(input: Tensor1D): Promise<Tensor1D> {
    try {
      // Asegurar que el modelo está inicializado
      if (!this.tfModel) {
        await this.initModel();
      }
      
      const startTime = Date.now();
      
      // Aplicar calibración si corresponde
      const calibratedInput = this.applyInputCalibration(input);
      
      // Preprocesar entrada
      const tensor = TensorUtils.preprocessForTensorFlow(calibratedInput, this.inputShape[0]);
      
      // Ejecutar predicción
      const prediction = await this.tfModel!.predict(tensor) as tf.Tensor;
      const result = Array.from(await prediction.data());
      
      // Limpiar tensores
      tensor.dispose();
      prediction.dispose();
      
      // Aplicar calibración a la salida
      const calibratedOutput = this.applyOutputCalibration(result);
      
      // Actualizar tiempo de predicción
      this.lastPredictionTime = Date.now() - startTime;
      
      return calibratedOutput;
    } catch (error) {
      console.error(`Error en ${this.getModelInfo().name}.predictAsync:`, error);
      return this.getDefaultOutput();
    }
  }
  
  /**
   * Aplica calibración a los datos de entrada
   */
  protected applyInputCalibration(input: Tensor1D): Tensor1D {
    // Por defecto, no hace nada - las subclases pueden sobrescribir
    return input;
  }
  
  /**
   * Aplica calibración a los datos de salida
   */
  protected applyOutputCalibration(output: number[]): Tensor1D {
    // Por defecto, aplica el factor de calibración global
    return output.map(val => val * this.calibrationFactor);
  }
  
  /**
   * Devuelve una salida por defecto en caso de error
   */
  protected getDefaultOutput(): Tensor1D {
    return Array(this.outputShape[0]).fill(0);
  }
  
  /**
   * Establece un factor de calibración
   */
  setCalibrationFactor(factor: number): void {
    this.calibrationFactor = Math.max(0.5, Math.min(1.5, factor));
  }
  
  /**
   * Notifica inicio de calibración
   */
  onCalibrationStarted(): void {
    this.isCalibrating = true;
    console.log(`Calibración iniciada para ${this.getModelInfo().name}`);
  }
  
  /**
   * Obtiene el tiempo de la última predicción
   */
  getPredictionTime(): number {
    return this.lastPredictionTime;
  }
  
  /**
   * Actualiza el tiempo de predicción
   */
  protected updatePredictionTime(startTime: number): void {
    this.lastPredictionTime = Date.now() - startTime;
  }
  
  /**
   * Implementación de propiedades abstractas
   */
  get parameterCount(): number {
    return this.tfModel ? this.tfModel.countParams() : 0;
  }
  
  get architecture(): string {
    return `TensorFlow (${this.parameterCount} params)`;
  }
}
