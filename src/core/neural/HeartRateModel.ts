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
      // Siempre marcar como no cargado si hay error
      this.isModelLoaded = false;
      // Eliminar la lógica de fallback que establecía isModelLoaded = true en dev
    }
  }
  
  /**
   * Realiza la predicción de frecuencia cardíaca usando el modelo cargado
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();
    
    // Si el modelo no está cargado o es nulo, intentar cargarlo de nuevo.
    // Si sigue sin estar disponible, retornar un valor por defecto.
    if (!this.isModelLoaded || !this.model) {
      await this.loadModel(); // Intenta cargar si es necesario
      if (!this.isModelLoaded || !this.model) {
        console.error('HeartRateNeuralModel: Modelo no cargado, no se puede predecir.');
        return [0]; // Devolver 0 o NaN si el modelo no está disponible
      }
    }
    
    try {
      // La lógica de fallback de desarrollo se elimina, siempre se usa el modelo real o se falla.
      
      // Convertir entrada a tensor
      const inputTensor = tf.tensor2d([input], [1, input.length]);
      
      // Realizar predicción
      // La aserción de no nulidad (!) es segura aquí debido a la comprobación anterior
      const outputTensor = this.model!.predict(inputTensor) as tf.Tensor;
      
      // Convertir resultado a array
      const result = await outputTensor.array();
      
      // Limpiar tensores para evitar memory leaks
      inputTensor.dispose();
      outputTensor.dispose();
      
      this.updatePredictionTime(startTime);
      
      // Obtener el valor y aplicar restricciones fisiológicas
      // Corregimos aquí la conversión de tipos para manejar correctamente los arrays anidados
      let heartRate = 0;
      
      // Extraer el valor numérico del resultado del tensor
      if (Array.isArray(result) && result.length > 0) {
        const firstElement = result[0];
        if (Array.isArray(firstElement) && firstElement.length > 0) {
          heartRate = Number(firstElement[0]);
        } else if (typeof firstElement === 'number') {
          heartRate = firstElement;
        }
      }
      
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
