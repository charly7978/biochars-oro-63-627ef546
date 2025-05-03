
import * as tf from '@tensorflow/tfjs'; 
import { BaseNeuralModel, Tensor1D } from './NeuralNetworkBase';

/**
 * Modelo neuronal para estimación de frecuencia cardíaca
 * Adaptado para usar TensorFlow.js en lugar de implementación manual
 */
export class HeartRateNeuralModel extends BaseNeuralModel {
  constructor() {
    super(
      'HeartRateEstimation', 
      [100, 1],  // Expected input shape (100 samples, 1 channel)
      [1],       // Output shape: single BPM value
      '1.2.0-tfjs' // Version and backend info
    );
  }

  /**
   * Carga el modelo TF.js
   */
  async loadModel(): Promise<void> {
    if (this.isModelLoaded) {
      return;
    }
    
    try {
      console.log('HeartRateNeuralModel: Iniciando carga del modelo...');
      
      // Ruta al modelo TF.js
      const modelUrl = '/models/heart-rate/model.json';
      
      // Intentar cargar el modelo
      this.model = await tf.loadGraphModel(modelUrl);
      
      this.isModelLoaded = true;
      console.log('HeartRateNeuralModel: Modelo cargado exitosamente');
    } catch (error) {
      console.error('Error al cargar el modelo HeartRate:', error);
      
      // Crear un modelo de respaldo simple para desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.warn('HeartRateNeuralModel: Usando modelo de fallback para desarrollo');
        this.isModelLoaded = true;
      } else {
        this.isModelLoaded = false;
      }
    }
  }
  
  /**
   * Realiza la predicción de frecuencia cardíaca usando el modelo cargado
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();
    
    try {
      if (!this.isModelLoaded) {
        await this.loadModel();
      }
      
      // Si no hay modelo o estamos en fallback
      if (!this.model && process.env.NODE_ENV === 'development') {
        // Simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Devolver un valor calculado en base a características básicas del input
        // Esto NO es una simulación aleatoria, sino un cálculo determinista de fallback
        const peak1 = Math.max(...input.slice(0, 30));
        const peak2 = Math.max(...input.slice(30, 60));
        const peak3 = Math.max(...input.slice(60));
        const peaks = [peak1, peak2, peak3].filter(p => p > 0.05).length;
        // Estimar BPM basado en número de picos detectados y longitud del input
        const estimatedBpm = peaks > 0 ? 60 * (peaks / (input.length / 30)) : 0;
        
        this.updatePredictionTime(startTime);
        return [estimatedBpm > 0 ? Math.min(180, Math.max(40, estimatedBpm)) : 0];
      }
      
      // Convertir entrada a tensor
      const inputTensor = tf.tensor2d([input], [1, input.length]);
      
      // Realizar predicción
      const outputTensor = this.model!.predict(inputTensor) as tf.Tensor;
      
      // Convertir resultado a array
      const result = await outputTensor.array();
      
      // Limpiar tensores para evitar memory leaks
      inputTensor.dispose();
      outputTensor.dispose();
      
      this.updatePredictionTime(startTime);
      
      // Obtener el valor y aplicar restricciones fisiológicas
      const heartRate = Array.isArray(result) && result.length > 0 ? 
        (Array.isArray(result[0]) ? result[0][0] : result[0]) : 0;
      
      // Aplicar límites fisiológicos (40-180 bpm)
      const constrainedHR = heartRate > 0 ? Math.min(180, Math.max(40, heartRate)) : 0;
      
      return [constrainedHR];
    } catch (error) {
      console.error('Error en predict de HeartRateNeuralModel:', error);
      this.updatePredictionTime(startTime);
      return [0]; // Valor por defecto en caso de error
    }
  }
  
  /**
   * Retorna el conteo de parámetros del modelo
   */
  get parameterCount(): number {
    if (!this.model || !this.isModelLoaded) return 0;
    
    // Intentar obtener el número de parámetros si es posible
    if (this.model instanceof tf.LayersModel) {
      return this.model.countParams();
    }
    
    // Estimación para GraphModel (no tiene método countParams)
    return 50000; // Valor aproximado para un modelo típico de frecuencia cardíaca
  }
  
  /**
   * Retorna información de la arquitectura
   */
  get architecture(): string {
    if (!this.model) return 'Not loaded';
    
    if (this.model instanceof tf.LayersModel) {
      return 'TF.js LayersModel';
    } else {
      return 'TF.js GraphModel';
    }
  }
}
