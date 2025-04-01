
/**
 * Procesador de señales basado en Machine Learning
 * Utiliza TensorFlow.js para mejorar la calidad de señal
 */
import { MLProcessedSignal } from '../types/processing';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// Cargamos el modelo específico de capas
import * as tfjs from '@tensorflow/tfjs';
import * as tfjsLayers from '@tensorflow/tfjs-layers';

/**
 * Clase para procesamiento ML de señales
 */
export class MLSignalProcessor {
  private model: tfjsLayers.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private inputBuffer: number[] = [];
  private readonly BUFFER_SIZE = 64;
  private readonly MODEL_URL = '/assets/signal_model/model.json';
  
  // Información de rendimiento
  private processingTimes: number[] = [];
  private readonly MAX_TIMES = 20;
  
  constructor() {
    // Inicializar buffer
    this.inputBuffer = Array(this.BUFFER_SIZE).fill(0);
    
    // Configurar backend preferido
    tf.setBackend('webgl').then(() => {
      console.log('MLSignalProcessor: Backend WebGL activado');
    }).catch(err => {
      console.warn('MLSignalProcessor: Error activando WebGL, usando fallback:', err);
    });
  }
  
  /**
   * Inicializa y carga el modelo
   */
  async initialize(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    
    try {
      console.log('MLSignalProcessor: Cargando modelo...');
      
      // Utilizar tfjsLayers para cargar específicamente un modelo de capas
      this.model = await tfjsLayers.loadLayersModel(this.MODEL_URL);
      
      // Verificar modelo cargado
      if (!this.model) {
        throw new Error('Modelo de ML no cargado correctamente');
      }
      
      // Calentar el modelo con una pasada inicial
      const warmupTensor = tf.tensor2d([[0, 0, 0, 0]], [1, 4]);
      const result = this.model.predict(warmupTensor);
      
      if (Array.isArray(result)) {
        result.forEach(tensor => tensor.dispose());
      } else {
        result.dispose();
      }
      warmupTensor.dispose();
      
      this.isModelLoaded = true;
      console.log('MLSignalProcessor: Modelo cargado correctamente');
      
      return true;
    } catch (error) {
      console.error('MLSignalProcessor: Error inicializando modelo:', error);
      this.isModelLoaded = false;
      return false;
    }
  }
  
  /**
   * Procesa un valor utilizando el modelo ML
   */
  async processValue(value: number): Promise<MLProcessedSignal> {
    const startTime = performance.now();
    
    // Actualizar buffer
    this.inputBuffer.push(value);
    if (this.inputBuffer.length > this.BUFFER_SIZE) {
      this.inputBuffer.shift();
    }
    
    try {
      // Si el modelo no está cargado, devolver resultado básico
      if (!this.isModelLoaded || !this.model) {
        return this.createBasicResult(value, startTime);
      }
      
      // Preparar datos para el modelo
      const inputData = this.prepareInputData();
      
      // Ejecutar inferencia
      const outputTensor = this.model.predict(inputData);
      
      // Procesar resultado
      let enhancedValue = value;
      let confidence = 0.5;
      let prediction: number[] = [];
      
      // Extraer valores del tensor
      if (Array.isArray(outputTensor)) {
        // Modelo con múltiples salidas
        enhancedValue = outputTensor[0].dataSync()[0];
        confidence = outputTensor[1].dataSync()[0];
        
        // Limpiar memoria
        outputTensor.forEach(tensor => tensor.dispose());
      } else {
        // Modelo con una única salida
        const outputData = outputTensor.dataSync();
        enhancedValue = outputData[0];
        confidence = outputData.length > 1 ? outputData[1] : 0.7;
        
        // Convertir resto de la salida a prediction si hay más valores
        if (outputData.length > 2) {
          prediction = Array.from(outputData.slice(2));
        }
        
        // Limpiar memoria
        outputTensor.dispose();
      }
      
      // Limpiar memoria del tensor de entrada
      inputData.dispose();
      
      // Calcular tiempo de procesamiento
      const processingTime = performance.now() - startTime;
      this.updateProcessingTimes(processingTime);
      
      return {
        timestamp: Date.now(),
        input: value,
        enhanced: enhancedValue,
        confidence,
        prediction,
        processingTime,
        modelVersion: '1.0'
      };
    } catch (error) {
      console.error('MLSignalProcessor: Error procesando valor:', error);
      return this.createBasicResult(value, startTime);
    }
  }
  
  /**
   * Prepara los datos de entrada para el modelo
   */
  private prepareInputData(): tf.Tensor {
    // Normalizar datos
    const normalizedData = this.normalizeData(this.inputBuffer);
    
    // Extraer características
    const features = this.extractFeatures(normalizedData);
    
    // Convertir a tensor
    return tf.tensor2d([features], [1, features.length]);
  }
  
  /**
   * Normaliza los datos de entrada
   */
  private normalizeData(data: number[]): number[] {
    // Encontrar min y max para normalización
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min > 0 ? max - min : 1;
    
    // Normalizar entre 0 y 1
    return data.map(val => (val - min) / range);
  }
  
  /**
   * Extrae características de los datos
   */
  private extractFeatures(data: number[]): number[] {
    // Características básicas
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    // Varianza
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    
    // Diferencias
    const diffs = data.slice(1).map((val, i) => val - data[i]);
    const diffsMean = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    
    // Extraer último valor como característica adicional
    const lastValue = data[data.length - 1];
    
    return [lastValue, mean, Math.sqrt(variance), diffsMean];
  }
  
  /**
   * Crea un resultado básico cuando el modelo no está disponible
   */
  private createBasicResult(value: number, startTime: number): MLProcessedSignal {
    return {
      timestamp: Date.now(),
      input: value,
      enhanced: value,
      confidence: 0.1,
      prediction: [],
      processingTime: performance.now() - startTime,
      modelVersion: 'basic'
    };
  }
  
  /**
   * Actualiza las estadísticas de tiempo de procesamiento
   */
  private updateProcessingTimes(time: number): void {
    this.processingTimes.push(time);
    if (this.processingTimes.length > this.MAX_TIMES) {
      this.processingTimes.shift();
    }
  }
  
  /**
   * Obtiene el tiempo promedio de procesamiento
   */
  getAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    return this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }
  
  /**
   * Cierra el modelo y libera recursos
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelLoaded = false;
    }
    
    // Limpiar cualquier tensor en memoria
    tf.dispose();
  }
}

/**
 * Crea una instancia del procesador ML
 */
export function createMLSignalProcessor(): MLSignalProcessor {
  return new MLSignalProcessor();
}
