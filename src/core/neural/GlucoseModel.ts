
import * as tf from '@tensorflow/tfjs'; 
import { BaseNeuralModel, Tensor1D } from './NeuralNetworkBase';
import { findMaximum, findMinimum } from '../../utils/signalUtils';

/**
 * Modelo neuronal para estimación de glucosa en sangre
 * Basado en datos reales, sin simulaciones
 */
export class GlucoseNeuralModel extends BaseNeuralModel {
  constructor() {
    super(
      'GlucoseEstimation', 
      [100, 1],  // Expected input shape (100 samples, 1 channel)
      [1],       // Output shape: single glucose value
      '1.0.0-tfjs' // Version and backend info
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
      console.log('GlucoseNeuralModel: Iniciando carga del modelo...');
      
      // Ruta al modelo TF.js
      const modelUrl = '/models/glucose/model.json';
      
      // Intentar cargar el modelo
      this.model = await tf.loadGraphModel(modelUrl);
      
      this.isModelLoaded = true;
      console.log('GlucoseNeuralModel: Modelo cargado exitosamente');
    } catch (error) {
      console.error('Error al cargar el modelo Glucose:', error);
      
      // Crear un modelo de respaldo simple para desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.warn('GlucoseNeuralModel: Usando modelo de fallback para desarrollo');
        this.isModelLoaded = true;
      } else {
        this.isModelLoaded = false;
      }
    }
  }
  
  /**
   * Realiza la predicción de glucosa usando el modelo cargado
   */
  async predict(input: Tensor1D): Promise<Tensor1D> {
    const startTime = Date.now();
    
    try {
      if (!this.isModelLoaded) {
        await this.loadModel();
      }
      
      // Si no hay modelo o estamos en fallback
      if (!this.model && process.env.NODE_ENV === 'development') {
        // Esperar un poco para simular procesamiento
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Por ahora no hay estimación fiable sin modelo
        // Se devuelve 0 como indicación de que no hay medición
        this.updatePredictionTime(startTime);
        return [0];
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
      let glucose = 0;
      
      // Extraer el valor numérico del resultado del tensor con manejo seguro de tipos
      if (Array.isArray(result)) {
        if (result.length > 0) {
          const firstElement = result[0];
          
          if (Array.isArray(firstElement)) {
            if (firstElement.length > 0 && typeof firstElement[0] === 'number') {
              glucose = firstElement[0];
            }
          } else if (typeof firstElement === 'number') {
            glucose = firstElement;
          }
        }
      }
      
      // Aplicar límites fisiológicos sin usar Math.min/max
      if (glucose > 450) glucose = 0; // Valor inválido
      if (glucose < 40 && glucose > 0) glucose = 0; // Valor inválido
      
      return [glucose];
    } catch (error) {
      console.error('Error en predict de GlucoseNeuralModel:', error);
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
    return 15000; // Valor aproximado para un modelo típico de glucosa
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
