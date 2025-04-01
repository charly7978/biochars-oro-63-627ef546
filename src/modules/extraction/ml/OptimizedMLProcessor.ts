
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador ML optimizado con cuantización de 8-bits y gestión eficiente de memoria
 */
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { getOptimizationManager } from '../optimization/OptimizationManager';

export interface OptimizedMLProcessorConfig {
  enableQuantization: boolean;
  enableMemoryOptimization: boolean;
  batchSize: number;
  inputSize: number;
  useGPU: boolean;
}

export interface OptimizedMLResult {
  original: number;
  enhanced: number;
  quality: number;
  confidence: number;
  processingTime: number;
  memoryUsage?: number;
}

export class OptimizedMLProcessor {
  private config: OptimizedMLProcessorConfig;
  private model: tf.GraphModel | tf.LayersModel | null = null;
  private isInitialized: boolean = false;
  private inputBuffer: number[] = [];
  private lastEnhanced: number = 0;
  private lastConfidence: number = 0;
  private lastMemoryStats: tf.MemoryInfo | null = null;
  private processingTimes: number[] = [];
  
  constructor(config?: Partial<OptimizedMLProcessorConfig>) {
    // Configuración por defecto con cuantización habilitada
    this.config = {
      enableQuantization: true,
      enableMemoryOptimization: true,
      batchSize: 1,
      inputSize: 64,
      useGPU: true,
      ...config
    };
    
    console.log("[OptimizedMLProcessor] Inicializado con configuración:", {
      cuantización: this.config.enableQuantization,
      optimizaciónMemoria: this.config.enableMemoryOptimization,
      GPU: this.config.useGPU
    });
  }
  
  /**
   * Inicializa el procesador optimizado
   */
  public async initialize(modelPath?: string): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Configurar backend optimizado
      if (this.config.useGPU) {
        await tf.setBackend('webgl');
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
        console.log("[OptimizedMLProcessor] Usando GPU con WebGL optimizado");
      }
      
      await tf.ready();
      console.log("[OptimizedMLProcessor] TensorFlow.js inicializado con backend:", tf.getBackend());
      
      // Cargar modelo (preferiblemente cuantizado si está habilitado)
      if (modelPath) {
        // Si se especifica un modelo, intentar cargarlo
        if (this.config.enableQuantization && getOptimizationManager().isFeatureEnabled('model-quantization')) {
          // Intentar cargar versión cuantizada
          const quantizedPath = modelPath.replace('.json', '_quantized.json');
          try {
            this.model = await tf.loadGraphModel(quantizedPath);
            console.log("[OptimizedMLProcessor] Modelo cuantizado cargado correctamente");
          } catch (e) {
            console.warn("[OptimizedMLProcessor] No se pudo cargar modelo cuantizado, intentando modelo normal");
            this.model = await tf.loadLayersModel(modelPath);
          }
        } else {
          // Cargar modelo normal
          this.model = await tf.loadLayersModel(modelPath);
          console.log("[OptimizedMLProcessor] Modelo estándar cargado correctamente");
        }
      } else {
        // Si no hay modelo externo, crear uno básico
        this.model = await this.createOptimizedModel();
        console.log("[OptimizedMLProcessor] Modelo optimizado creado localmente");
      }
      
      // Realizar calentamiento del modelo para mejor rendimiento inicial
      await this.warmupModel();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("[OptimizedMLProcessor] Error inicializando:", error);
      return false;
    }
  }
  
  /**
   * Crea un modelo optimizado con arquitectura eficiente
   */
  private async createOptimizedModel(): Promise<tf.LayersModel> {
    // Usar tf.tidy para gestión automática de memoria
    return tf.tidy(() => {
      const input = tf.input({shape: [this.config.inputSize, 1]});
      
      // Capa de entrada con normalización
      let x = tf.layers.conv1d({
        filters: 16,
        kernelSize: 3,
        padding: 'same',
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }).apply(input);
      
      // Arquitectura eficiente (reducida para optimización)
      x = tf.layers.batchNormalization().apply(x);
      
      // Residual block
      const shortcut = x;
      let y = tf.layers.conv1d({
        filters: 16, 
        kernelSize: 3,
        padding: 'same',
        activation: 'relu'
      }).apply(x);
      
      y = tf.layers.conv1d({
        filters: 16,
        kernelSize: 3,
        padding: 'same',
        activation: 'linear'
      }).apply(y);
      
      x = tf.layers.add().apply([shortcut, y]);
      x = tf.layers.activation({activation: 'relu'}).apply(x);
      
      // Capa de salida
      const output = tf.layers.conv1d({
        filters: 1,
        kernelSize: 3,
        padding: 'same',
        activation: 'tanh'
      }).apply(x);
      
      // Crear y compilar modelo
      const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });
      
      return model;
    });
  }
  
  /**
   * Realiza un calentamiento del modelo para mejor rendimiento inicial
   */
  private async warmupModel(): Promise<void> {
    if (!this.model) return;
    
    try {
      // Crear datos sintéticos para el calentamiento
      const dummyInput = tf.zeros([1, this.config.inputSize, 1]);
      
      // Realizar predicción de calentamiento
      const result = this.model.predict(dummyInput);
      
      // Asegurar que se complete la ejecución
      await (Array.isArray(result) ? result[0].data() : result.data());
      
      // Limpiar tensores
      tf.dispose([dummyInput, result]);
      
      console.log("[OptimizedMLProcessor] Calentamiento del modelo completado");
    } catch (error) {
      console.warn("[OptimizedMLProcessor] Error en calentamiento:", error);
    }
  }
  
  /**
   * Procesa un valor con gestión optimizada de memoria
   */
  public async processValue(value: number): Promise<OptimizedMLResult> {
    const startTime = performance.now();
    
    // Si no está inicializado, devolver valor sin cambios
    if (!this.isInitialized || !this.model) {
      return {
        original: value,
        enhanced: value,
        quality: 0.5,
        confidence: 0.5,
        processingTime: 0
      };
    }
    
    // Actualizar buffer de entrada
    this.inputBuffer.push(value);
    if (this.inputBuffer.length > this.config.inputSize) {
      this.inputBuffer.shift();
    }
    
    // Si no hay suficientes datos, devolver sin procesar
    if (this.inputBuffer.length < this.config.inputSize) {
      return {
        original: value,
        enhanced: value,
        quality: 0.5,
        confidence: 0.5,
        processingTime: performance.now() - startTime
      };
    }
    
    try {
      let enhanced: number = value;
      let quality: number = 0.5;
      let confidence: number = 0.5;
      
      // Usar tf.tidy para gestión automática de memoria si está habilitado
      if (this.config.enableMemoryOptimization && 
          getOptimizationManager().isFeatureEnabled('memory-optimization')) {
        
        // Procesar con gestión optimizada de memoria
        const result = tf.tidy(() => {
          // Normalizar y preparar datos
          const normalizedBuffer = this.normalizeBuffer(this.inputBuffer);
          const inputTensor = tf.tensor(normalizedBuffer, [1, this.config.inputSize, 1]);
          
          // Predicción del modelo
          const output = this.model!.predict(inputTensor) as tf.Tensor;
          
          // Extraer último valor
          const outputArray = output.reshape([this.config.inputSize]).arraySync() as number[];
          const lastValue = outputArray[outputArray.length - 1];
          
          // Calcular métricas de calidad
          const calculatedQuality = this.calculateQuality(normalizedBuffer);
          const calculatedConfidence = this.calculateConfidence(normalizedBuffer);
          
          // Devolver resultados dentro del tidy
          return {
            enhancedValue: this.denormalizeValue(lastValue, normalizedBuffer),
            quality: calculatedQuality,
            confidence: calculatedConfidence
          };
        });
        
        // Asignar resultados
        enhanced = result.enhancedValue;
        quality = result.quality;
        confidence = result.confidence;
        
      } else {
        // Procesamiento estándar sin optimización de memoria
        const normalizedBuffer = this.normalizeBuffer(this.inputBuffer);
        const inputTensor = tf.tensor(normalizedBuffer, [1, this.config.inputSize, 1]);
        
        const output = this.model.predict(inputTensor) as tf.Tensor;
        const outputArray = await output.reshape([this.config.inputSize]).array() as number[];
        const lastValue = outputArray[outputArray.length - 1];
        
        enhanced = this.denormalizeValue(lastValue, normalizedBuffer);
        quality = this.calculateQuality(normalizedBuffer);
        confidence = this.calculateConfidence(normalizedBuffer);
        
        // Limpieza manual de tensores
        tf.dispose([inputTensor, output]);
      }
      
      // Guardar últimos valores procesados
      this.lastEnhanced = enhanced;
      this.lastConfidence = confidence;
      
      // Capturar estadísticas de memoria si está habilitado
      let memoryUsage: number | undefined = undefined;
      if (this.config.enableMemoryOptimization) {
        this.lastMemoryStats = tf.memory();
        memoryUsage = this.lastMemoryStats.numBytes;
        
        // Log periódico de uso de memoria (cada 100 procesados)
        if (this.processingTimes.length % 100 === 0) {
          console.log("[OptimizedMLProcessor] Estadísticas de memoria:", {
            numBytes: this.lastMemoryStats.numBytes,
            numTensors: this.lastMemoryStats.numTensors,
            numDataBuffers: this.lastMemoryStats.numDataBuffers
          });
        }
      }
      
      // Calcular tiempo de procesamiento
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Mantener solo últimos 50 tiempos para cálculos
      if (this.processingTimes.length > 50) {
        this.processingTimes.shift();
      }
      
      // Log periódico de rendimiento
      if (this.processingTimes.length % 100 === 0) {
        const avgTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
        console.log(`[OptimizedMLProcessor] Tiempo promedio: ${avgTime.toFixed(2)}ms`);
      }
      
      // Actualizar estadísticas globales
      getOptimizationManager().updateStats({
        memoryUsage,
        processingTime: this.getAverageProcessingTime()
      });
      
      return {
        original: value,
        enhanced,
        quality,
        confidence,
        processingTime,
        memoryUsage
      };
      
    } catch (error) {
      console.error("[OptimizedMLProcessor] Error procesando valor:", error);
      
      // En caso de error, devolver último valor válido o original
      return {
        original: value,
        enhanced: this.lastEnhanced || value,
        quality: 0.5,
        confidence: this.lastConfidence || 0.5,
        processingTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Normalización robusta para entrada del modelo
   */
  private normalizeBuffer(buffer: number[]): number[] {
    const sorted = [...buffer].sort((a, b) => a - b);
    const q10 = sorted[Math.floor(buffer.length * 0.1)];
    const q90 = sorted[Math.floor(buffer.length * 0.9)];
    
    const range = q90 - q10 || 1;
    const center = (q90 + q10) / 2;
    
    return buffer.map(v => {
      const normalized = (v - center) / range;
      return Math.max(-1, Math.min(1, normalized)); // Clamp a [-1, 1]
    });
  }
  
  /**
   * Desnormaliza un valor de salida del modelo
   */
  private denormalizeValue(normalizedValue: number, normalizedBuffer: number[]): number {
    // Usar estadísticas del buffer original para desnormalización
    const sorted = [...this.inputBuffer].sort((a, b) => a - b);
    const q10 = sorted[Math.floor(sorted.length * 0.1)];
    const q90 = sorted[Math.floor(sorted.length * 0.9)];
    
    const range = q90 - q10 || 1;
    const center = (q90 + q10) / 2;
    
    // Limitar a rango razonable
    const clamped = Math.max(-1, Math.min(1, normalizedValue));
    return clamped * range + center;
  }
  
  /**
   * Calcula métrica de calidad basada en características de la señal
   */
  private calculateQuality(buffer: number[]): number {
    // Cálculo simple de calidad basado en varianza
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const variance = buffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buffer.length;
    
    // Señal de calidad tiene varianza moderada (ni muy alta ni muy baja)
    const varianceScore = Math.exp(-Math.pow((variance - 0.2), 2) / 0.05);
    
    // Detectar periodicidad (señal cardíaca)
    const periodicityScore = this.detectPeriodicity(buffer);
    
    // Combinación ponderada
    return Math.max(0, Math.min(1, 0.7 * varianceScore + 0.3 * periodicityScore));
  }
  
  /**
   * Calcula confianza en los resultados
   */
  private calculateConfidence(buffer: number[]): number {
    // Varianza de la señal (una medida de "energía")
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const variance = buffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buffer.length;
    
    // Completitud de datos
    const completenessScore = Math.min(buffer.length / this.config.inputSize, 1);
    
    // Puntaje combinado con peso en varianza
    const combinedScore = 0.7 * Math.min(variance * 5, 1) + 0.3 * completenessScore;
    
    // Limitar a rango [0.4, 0.95]
    return Math.max(0.4, Math.min(0.95, combinedScore));
  }
  
  /**
   * Detecta periodicidad en la señal (útil para señales cardíacas)
   */
  private detectPeriodicity(buffer: number[]): number {
    if (buffer.length < 20) return 0.5;
    
    // Calcular autocorrelación para detectar periodicidad
    const maxLag = Math.floor(buffer.length / 2);
    const correlations: number[] = [];
    
    // Calcular media
    const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    
    // Buffer normalizado
    const normalized = buffer.map(v => v - mean);
    
    // Calcular autocorrelación para diferentes lags
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let normalization = 0;
      
      for (let i = 0; i < buffer.length - lag; i++) {
        correlation += normalized[i] * normalized[i + lag];
        normalization += normalized[i] * normalized[i];
      }
      
      correlations.push(normalization ? correlation / Math.sqrt(normalization) : 0);
    }
    
    // Encontrar picos en autocorrelación
    let maxCorrelation = 0;
    
    for (let i = 1; i < correlations.length - 1; i++) {
      if (correlations[i] > correlations[i - 1] && correlations[i] > correlations[i + 1]) {
        if (correlations[i] > maxCorrelation) {
          maxCorrelation = correlations[i];
        }
      }
    }
    
    return Math.max(0, Math.min(1, maxCorrelation));
  }
  
  /**
   * Obtiene el tiempo promedio de procesamiento
   */
  public getAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    return this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }
  
  /**
   * Libera recursos del modelo
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    this.inputBuffer = [];
    this.lastEnhanced = 0;
    this.lastConfidence = 0;
    this.processingTimes = [];
    this.isInitialized = false;
    
    console.log("[OptimizedMLProcessor] Recursos liberados");
  }
}

/**
 * Crea una instancia del procesador ML optimizado
 */
export const createOptimizedMLProcessor = (
  config?: Partial<OptimizedMLProcessorConfig>
): OptimizedMLProcessor => {
  return new OptimizedMLProcessor(config);
};
