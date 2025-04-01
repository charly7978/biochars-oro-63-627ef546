
/**
 * Procesador ML optimizado con TensorFlow.js
 * Implementa mejoras de rendimiento para procesamiento de señales
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// Importar específicamente los módulos necesarios
import * as tfjs from '@tensorflow/tfjs';
import * as tfjsLayers from '@tensorflow/tfjs-layers';

// Importar tipos
import { MLProcessedSignal } from '../types/processing';

// Tipos de modelo ML
enum ModelType {
  GRAPH = 'graph',
  LAYERS = 'layers',
  QUANTIZED = 'quantized'
}

// Configuración del procesador ML
interface OptimizedMLConfig {
  useQuantizedModel?: boolean;
  useGPU?: boolean;
  batchProcessing?: boolean;
  modelType?: ModelType;
}

/**
 * Clase para procesamiento ML optimizado
 */
export class OptimizedMLProcessor {
  private model: tfjs.GraphModel | tfjsLayers.LayersModel | null = null;
  private isModelLoaded: boolean = false;
  private modelType: ModelType;
  private useGPU: boolean;
  private batchProcessing: boolean;
  private inputBuffer: number[] = [];
  private readonly BUFFER_SIZE = 128;
  
  // Configuración de modelos
  private readonly MODEL_URLS = {
    [ModelType.GRAPH]: '/assets/signal_model/model.json',
    [ModelType.LAYERS]: '/assets/signal_model/layers_model.json',
    [ModelType.QUANTIZED]: '/assets/signal_model/model_quantized.json'
  };
  
  // Caché de resultados
  private resultCache: Map<string, MLProcessedSignal> = new Map();
  private readonly CACHE_SIZE = 100;
  
  constructor(config: OptimizedMLConfig = {}) {
    this.modelType = config.modelType || (config.useQuantizedModel ? ModelType.QUANTIZED : ModelType.LAYERS);
    this.useGPU = config.useGPU !== false;
    this.batchProcessing = config.batchProcessing === true;
    
    // Inicializar buffer
    this.inputBuffer = Array(this.BUFFER_SIZE).fill(0);
    
    // Configurar backend
    if (this.useGPU) {
      tf.setBackend('webgl').catch(err => {
        console.warn('OptimizedMLProcessor: Error activando WebGL, usando fallback:', err);
        this.useGPU = false;
      });
    }
  }
  
  /**
   * Inicializa y carga el modelo
   */
  async initialize(): Promise<boolean> {
    if (this.isModelLoaded) return true;
    
    try {
      console.log(`OptimizedMLProcessor: Cargando modelo ${this.modelType}...`);
      
      // Seleccionar tipo de carga según el tipo de modelo
      const modelUrl = this.MODEL_URLS[this.modelType];
      
      if (this.modelType === ModelType.GRAPH) {
        this.model = await tf.loadGraphModel(modelUrl);
      } else if (this.modelType === ModelType.QUANTIZED) {
        this.model = await tf.loadLayersModel(modelUrl);
      } else {
        this.model = await tfjsLayers.loadLayersModel(modelUrl);
      }
      
      // Verificar modelo cargado
      if (!this.model) {
        throw new Error('Modelo ML no cargado correctamente');
      }
      
      // Calentar el modelo
      this.warmupModel();
      
      this.isModelLoaded = true;
      console.log('OptimizedMLProcessor: Modelo cargado correctamente');
      
      return true;
    } catch (error) {
      console.error('OptimizedMLProcessor: Error inicializando modelo:', error);
      this.isModelLoaded = false;
      return false;
    }
  }
  
  /**
   * Calienta el modelo para optimizar primera inferencia
   */
  private warmupModel(): void {
    try {
      // Crear tensor de entrada ficticio
      const warmupTensor = this.createWarmupTensor();
      
      // Ejecutar predicción
      const result = this.model!.predict(warmupTensor);
      
      // Limpiar tensores
      if (Array.isArray(result)) {
        result.forEach(tensor => tensor.dispose());
      } else {
        result.dispose();
      }
      warmupTensor.dispose();
      
      console.log('OptimizedMLProcessor: Modelo calentado correctamente');
    } catch (error) {
      console.warn('OptimizedMLProcessor: Error calentando modelo:', error);
    }
  }
  
  /**
   * Crea un tensor para calentamiento
   */
  private createWarmupTensor(): tf.Tensor {
    if (this.modelType === ModelType.GRAPH) {
      // Los modelos de grafo pueden requerir un formato específico
      return tf.tensor2d([[0, 0, 0, 0]], [1, 4]);
    } else {
      // Para modelos de capas usamos un formato estándar
      return tf.tensor2d([[0, 0, 0, 0]], [1, 4]);
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
      // Comprobar caché
      const cacheKey = this.calculateCacheKey(value);
      const cachedResult = this.resultCache.get(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          timestamp: Date.now(),
          processingTime: performance.now() - startTime
        };
      }
      
      // Si el modelo no está cargado, devolver resultado básico
      if (!this.isModelLoaded || !this.model) {
        return this.createBasicResult(value, startTime);
      }
      
      // Preparar datos para el modelo
      const inputData = this.prepareInputData(value);
      
      // Ejecutar inferencia con control de memoria
      let output;
      let enhancedValue = value;
      let confidence = 0.5;
      let prediction: number[] = [];
      
      // Usar tidy para gestión automática de memoria
      tf.tidy(() => {
        output = this.model!.predict(inputData);
        
        // Procesar resultado según tipo
        if (Array.isArray(output)) {
          // Modelo con múltiples salidas
          enhancedValue = output[0].dataSync()[0];
          confidence = output[1].dataSync()[0];
          
          // Si hay más salidas, guardar como predicción
          if (output.length > 2) {
            prediction = Array.from(output[2].dataSync());
          }
        } else {
          // Modelo con una única salida
          const outputData = output.dataSync();
          enhancedValue = outputData[0];
          confidence = outputData.length > 1 ? outputData[1] : 0.7;
          
          // Convertir resto a predicción si hay más valores
          if (outputData.length > 2) {
            prediction = Array.from(outputData.slice(2));
          }
        }
      });
      
      // Limpiar explícitamente tensores
      if (typeof inputData.dispose === 'function') {
        inputData.dispose();
      }
      
      const processingTime = performance.now() - startTime;
      
      // Crear resultado
      const result: MLProcessedSignal = {
        timestamp: Date.now(),
        input: value,
        enhanced: enhancedValue,
        confidence,
        prediction,
        processingTime,
        modelVersion: `${this.modelType}_v1.0`
      };
      
      // Guardar en caché
      this.resultCache.set(cacheKey, result);
      if (this.resultCache.size > this.CACHE_SIZE) {
        // Eliminar la entrada más antigua
        const oldestKey = this.resultCache.keys().next().value;
        this.resultCache.delete(oldestKey);
      }
      
      return result;
    } catch (error) {
      console.error('OptimizedMLProcessor: Error procesando valor:', error);
      return this.createBasicResult(value, startTime);
    }
  }
  
  /**
   * Procesa un lote de valores en conjunto
   * Optimizado para rendimiento
   */
  async processBatch(values: number[]): Promise<MLProcessedSignal[]> {
    if (!this.isModelLoaded || !this.model) {
      return values.map(v => this.createBasicResult(v, performance.now()));
    }
    
    try {
      const batchStartTime = performance.now();
      
      // Preparar datos del lote
      const batchTensor = this.prepareBatchInput(values);
      
      // Procesar lote
      const batchOutput = this.model.predict(batchTensor);
      
      // Extraer resultados
      const results: MLProcessedSignal[] = [];
      
      // Procesar resultados según formato
      if (Array.isArray(batchOutput)) {
        // Modelo con múltiples salidas
        const enhancedValues = batchOutput[0].dataSync();
        const confidences = batchOutput[1].dataSync();
        
        for (let i = 0; i < values.length; i++) {
          results.push({
            timestamp: Date.now(),
            input: values[i],
            enhanced: enhancedValues[i],
            confidence: confidences[i],
            prediction: [],
            processingTime: (performance.now() - batchStartTime) / values.length,
            modelVersion: `${this.modelType}_batch_v1.0`
          });
        }
        
        // Limpiar memoria
        batchOutput.forEach(tensor => tensor.dispose());
      } else {
        // Modelo con una única salida
        const outputData = batchOutput.dataSync();
        const outputSize = outputData.length / values.length;
        
        for (let i = 0; i < values.length; i++) {
          const offset = i * outputSize;
          results.push({
            timestamp: Date.now(),
            input: values[i],
            enhanced: outputData[offset],
            confidence: outputSize > 1 ? outputData[offset + 1] : 0.7,
            prediction: outputSize > 2 ? Array.from(outputData.slice(offset + 2, offset + outputSize)) : [],
            processingTime: (performance.now() - batchStartTime) / values.length,
            modelVersion: `${this.modelType}_batch_v1.0`
          });
        }
        
        // Limpiar memoria
        batchOutput.dispose();
      }
      
      // Limpiar tensores de entrada
      batchTensor.dispose();
      
      return results;
    } catch (error) {
      console.error('OptimizedMLProcessor: Error procesando lote:', error);
      return values.map(v => this.createBasicResult(v, performance.now()));
    }
  }
  
  /**
   * Prepara el tensor de entrada para un lote
   */
  private prepareBatchInput(values: number[]): tf.Tensor {
    // Crear features para cada valor
    const features: number[][] = values.map(value => {
      // Crear buffer temporal para cada valor
      const tempBuffer = [...this.inputBuffer.slice(-10), value];
      const normalizedData = this.normalizeData(tempBuffer);
      return this.extractFeatures(normalizedData);
    });
    
    // Crear tensor del lote
    return tf.tensor2d(features);
  }
  
  /**
   * Prepara los datos de entrada para el modelo
   */
  private prepareInputData(value: number): tf.Tensor {
    // Normalizar datos
    const buffer = [...this.inputBuffer.slice(-10), value];
    const normalizedData = this.normalizeData(buffer);
    
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
   * Calcula una clave de caché para el valor
   */
  private calculateCacheKey(value: number): string {
    // Usar un valor redondeado para mejorar hit ratio
    const roundedValue = Math.round(value * 1000) / 1000;
    
    // Obtener contexto del buffer (valores recientes)
    const context = this.inputBuffer.slice(-5).map(v => Math.round(v * 100) / 100);
    
    return `${roundedValue}_${context.join('_')}`;
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
   * Cierra el modelo y libera recursos
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
      this.isModelLoaded = false;
    }
    
    // Limpiar caché
    this.resultCache.clear();
    
    // Limpiar cualquier tensor en memoria
    tf.dispose();
  }
}

/**
 * Crea una instancia del procesador ML optimizado
 */
export function createOptimizedMLProcessor(config: OptimizedMLConfig = {}): OptimizedMLProcessor {
  return new OptimizedMLProcessor(config);
}
