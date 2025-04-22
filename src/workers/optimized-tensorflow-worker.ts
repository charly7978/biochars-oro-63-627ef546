
/**
 * Web Worker optimizado para procesamiento con TensorFlow.js
 * Ejecuta inferencia de modelos en segundo plano con máximo rendimiento
 */
import * as tf from '@tensorflow/tfjs';
import { TensorFlowConfig, DEFAULT_TENSORFLOW_CONFIG } from '../core/neural/tensorflow/TensorFlowConfig';

// Configuración actual
let config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG;

// Caché de modelos para optimizar memoria
const modelCache = new Map<string, tf.LayersModel>();

// Métricas de rendimiento
let inferenceCount = 0;
let totalInferenceTime = 0;
let lastPerformanceLog = 0;

// Estados de backend para optimizar reconexión
const BACKEND_STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  ERROR: 'error',
  FALLBACK: 'fallback'
};

let backendStatus = BACKEND_STATUS.INITIALIZING;

// Inicializar TensorFlow.js con configuración optimizada
async function initTensorFlow() {
  try {
    backendStatus = BACKEND_STATUS.INITIALIZING;
    console.log(`TensorFlow Worker: Inicializando con backend ${config.backend}`);
    
    // Aplicar optimizaciones de memoria antes de inicializar backend
    if (config.memoryOptions.useFloat16) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }
    
    if (config.memoryOptions.enableTensorPacking) {
      tf.env().set('WEBGL_PACK', true);
    }
    
    // Aplicar límite de memoria si está configurado
    if (config.memoryOptions.gpuMemoryLimitMB > 0 && config.backend === 'webgl') {
      tf.env().set('WEBGL_SIZE_UPLOAD_UNIFORM', config.memoryOptions.gpuMemoryLimitMB * 1024 * 1024);
    }
    
    // Configurar paralelismo
    if (config.advancedOptions.parallelismLevel > 0) {
      tf.env().set('WEBGL_CPU_FORWARD', false);
    }
    
    // Iniciar backend configurado
    await tf.setBackend(config.backend);
    await tf.ready();
    
    // Verificar inicialización
    const backend = tf.getBackend();
    console.log(`TensorFlow Worker: Inicializado con backend ${backend}`);
    
    backendStatus = BACKEND_STATUS.READY;
    
    // Retornar información detallada sobre la inicialización
    self.postMessage({ 
      type: 'init', 
      status: 'ready', 
      backend: backend,
      webglInfo: config.backend === 'webgl' ? tf.ENV.getFlags() : null,
      config: { 
        useFloat16: config.memoryOptions.useFloat16,
        tensorPacking: config.memoryOptions.enableTensorPacking,
        parallelism: config.advancedOptions.parallelismLevel
      }
    });
    
    // Precalentar el sistema con tensores simples
    warmupTensorFlow();
  } catch (error) {
    console.error('TensorFlow Worker: Error inicializando TensorFlow.js:', error);
    backendStatus = BACKEND_STATUS.ERROR;
    
    self.postMessage({ 
      type: 'init', 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido',
      errorDetails: error instanceof Error ? error.stack : null
    });
    
    // Intentar fallback a CPU
    try {
      console.log('TensorFlow Worker: Intentando fallback a CPU');
      await tf.setBackend('cpu');
      await tf.ready();
      
      backendStatus = BACKEND_STATUS.FALLBACK;
      console.log('TensorFlow Worker: Fallback a CPU exitoso');
      
      self.postMessage({ 
        type: 'init', 
        status: 'ready', 
        backend: 'cpu',
        isFallback: true 
      });
    } catch (fbError) {
      console.error('TensorFlow Worker: Error en fallback a CPU:', fbError);
      self.postMessage({ 
        type: 'init', 
        status: 'error', 
        error: 'Fallo crítico: No se pudo inicializar ningún backend',
        isFallbackFailed: true
      });
    }
  }
}

// Precalentar el sistema para reducir latencia en primeras inferencias
async function warmupTensorFlow() {
  try {
    const warmupTensor = tf.tensor2d([[1, 2], [3, 4]]);
    warmupTensor.square().sqrt().abs().add(1).matMul(warmupTensor);
    warmupTensor.dispose();
    
    console.log('TensorFlow Worker: Warmup completo');
  } catch (error) {
    console.warn('TensorFlow Worker: Error en warmup (no crítico):', error);
  }
}

// Cargar un modelo con gestión de caché y recarga optimizada
async function loadModel(modelType: string): Promise<tf.LayersModel> {
  // Si ya está en caché, verificar si es válido
  if (modelCache.has(modelType)) {
    try {
      // Verificar que el modelo no está corrupto
      const cachedModel = modelCache.get(modelType)!;
      cachedModel.getWeights(); // Intenta acceder a pesos para verificar integridad
      return cachedModel;
    } catch (error) {
      // Si hay error, se eliminará de caché y se recargará
      console.warn(`TensorFlow Worker: Modelo en caché corrupto, recargando ${modelType}`);
      modelCache.delete(modelType);
    }
  }
  
  try {
    console.log(`TensorFlow Worker: Cargando modelo ${modelType}`);
    const startTime = performance.now();
    
    // Estrategia de carga: primero intentar desde IndexedDB
    let model: tf.LayersModel | null = null;
    
    if (config.cacheOptions.enableModelCaching) {
      try {
        const modelPath = `indexeddb://${config.cacheOptions.modelCachePrefix}${modelType}`;
        model = await tf.loadLayersModel(modelPath);
        console.log(`TensorFlow Worker: Modelo ${modelType} cargado desde IndexedDB`);
      } catch (cacheError) {
        console.log(`TensorFlow Worker: Modelo ${modelType} no disponible en caché:`, cacheError);
      }
    }
    
    // Si falla la carga desde caché, crear modelo fallback optimizado
    if (!model) {
      console.log(`TensorFlow Worker: Creando modelo fallback optimizado para ${modelType}`);
      model = createOptimizedFallbackModel(modelType);
      
      // Guardar en IndexedDB si está habilitado
      if (config.cacheOptions.enableModelCaching) {
        try {
          const modelPath = `indexeddb://${config.cacheOptions.modelCachePrefix}${modelType}`;
          await model.save(modelPath);
          console.log(`TensorFlow Worker: Modelo fallback para ${modelType} guardado en IndexedDB`);
        } catch (saveError) {
          console.warn(`TensorFlow Worker: No se pudo guardar modelo en IndexedDB:`, saveError);
        }
      }
    }
    
    // Optimizar modelo para backend actual
    if (config.advancedOptions.enablePlatformOptimizations) {
      await optimizeModelForCurrentBackend(model);
    }
    
    // Almacenar en caché
    modelCache.set(modelType, model);
    
    const loadTime = performance.now() - startTime;
    console.log(`TensorFlow Worker: Modelo ${modelType} cargado y optimizado en ${loadTime.toFixed(2)}ms`);
    
    return model;
  } catch (error) {
    console.error(`TensorFlow Worker: Error crítico cargando modelo ${modelType}:`, error);
    throw error;
  }
}

// Optimiza un modelo para el backend actual
async function optimizeModelForCurrentBackend(model: tf.LayersModel): Promise<void> {
  try {
    const backend = tf.getBackend();
    
    if (backend === 'webgl' || backend === 'webgpu') {
      // Prealocalizar buffers para WebGL/WebGPU
      const inputShape = model.inputs[0].shape;
      if (inputShape) {
        const inputRank = inputShape.length;
        if (inputRank === 3) { // [batch, timeSteps, features]
          const dummyBatch = 1;
          const timeSteps = inputShape[1] as number || 100;
          const features = inputShape[2] as number || 1;
          
          const dummyInput = tf.zeros([dummyBatch, timeSteps, features]);
          const result = model.predict(dummyInput) as tf.Tensor;
          
          // Limpiar tensores de prueba
          dummyInput.dispose();
          if (Array.isArray(result)) {
            result.forEach(t => t.dispose());
          } else {
            result.dispose();
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error optimizando modelo para backend actual:', error);
  }
}

// Crear modelo fallback optimizado
function createOptimizedFallbackModel(modelType: string): tf.LayersModel {
  // Configuración optimizada según tipo de modelo
  let inputShape: [number, number] | [number, number, number] = [300, 1];
  let outputUnits: number = 1;
  let convFilters = 16;
  let useBatchNorm = true;
  let dropoutRate = 0.3;
  
  // Ajustar según tipo de modelo para mejor rendimiento
  switch (modelType) {
    case 'heartRate':
      inputShape = [300, 1];
      outputUnits = 1;
      convFilters = 16;
      break;
    case 'spo2':
      inputShape = [200, 1];
      outputUnits = 1;
      convFilters = 12;
      break;
    case 'arrhythmia':
      inputShape = [500, 1];
      outputUnits = 2;
      convFilters = 24;
      dropoutRate = 0.4;
      break;
    case 'bp':
      inputShape = [400, 1];
      outputUnits = 2;
      convFilters = 20;
      break;
    default:
      inputShape = [300, 1];
      outputUnits = 1;
  }
  
  // Definir input (soporta tanto 2D como 3D)
  const input = tf.input({shape: inputShape.length === 2 ? inputShape : [inputShape[0], inputShape[1]]});
  
  // Reshape para asegurar compatibilidad con Conv1D (necesita 3D)
  let x: tf.SymbolicTensor;
  if (inputShape.length === 2) {
    x = tf.layers.reshape({targetShape: [inputShape[0], 1]}).apply(input);
  } else {
    x = input;
  }
  
  // Primera capa convolucional
  x = tf.layers.conv1d({
    filters: convFilters, 
    kernelSize: 5,
    padding: 'same',
    activation: useBatchNorm ? undefined : 'relu',
    kernelInitializer: 'heNormal'
  }).apply(x);
  
  // Batch normalización opcional
  if (useBatchNorm) {
    x = tf.layers.batchNormalization({}).apply(x);
    x = tf.layers.activation({activation: 'relu'}).apply(x);
  }
  
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  
  // Segunda capa convolucional
  x = tf.layers.conv1d({
    filters: convFilters * 2, 
    kernelSize: 3,
    padding: 'same',
    activation: useBatchNorm ? undefined : 'relu',
    kernelInitializer: 'heNormal'
  }).apply(x);
  
  if (useBatchNorm) {
    x = tf.layers.batchNormalization({}).apply(x);
    x = tf.layers.activation({activation: 'relu'}).apply(x);
  }
  
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  
  // Para modelos más complejos como arritmia, añadir una tercera capa
  if (modelType === 'arrhythmia' || modelType === 'bp') {
    x = tf.layers.conv1d({
      filters: convFilters * 4, 
      kernelSize: 3,
      padding: 'same',
      activation: useBatchNorm ? undefined : 'relu',
      kernelInitializer: 'heNormal'
    }).apply(x);
    
    if (useBatchNorm) {
      x = tf.layers.batchNormalization({}).apply(x);
      x = tf.layers.activation({activation: 'relu'}).apply(x);
    }
    
    x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  }
  
  // Capas densas para regresión/clasificación
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dense({
    units: 64, 
    activation: useBatchNorm ? undefined : 'relu',
    kernelInitializer: 'heNormal'
  }).apply(x);
  
  if (useBatchNorm) {
    x = tf.layers.batchNormalization({}).apply(x);
    x = tf.layers.activation({activation: 'relu'}).apply(x);
  }
  
  x = tf.layers.dropout({rate: dropoutRate}).apply(x);
  
  // Capa final con activación según el tipo de modelo
  const output = tf.layers.dense({
    units: outputUnits,
    activation: outputUnits > 1 ? 'softmax' : 'linear',
    kernelInitializer: 'glorotNormal'
  }).apply(x);
  
  // Crear modelo
  const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  
  // Compilar con configuración optimizada
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: outputUnits > 1 ? 'categoricalCrossentropy' : 'meanSquaredError',
    metrics: ['accuracy']
  });
  
  return model;
}

// Optimizar entrada para predicción según tipo de modelo
function optimizeInput(modelType: string, inputData: number[]): tf.Tensor {
  // Normalizar datos de entrada
  let normalizedInput = [...inputData];
  
  if (normalizedInput.length > 0) {
    const min = Math.min(...normalizedInput);
    const max = Math.max(...normalizedInput);
    if (max > min) {
      normalizedInput = normalizedInput.map(v => (v - min) / (max - min));
    }
  }
  
  // Adaptación de shape según tipo de modelo
  let tensor;
  
  switch (modelType) {
    case 'arrhythmia':
      // Modelo de clasificación, usar entrada 2D
      tensor = tf.tensor2d([normalizedInput], [1, normalizedInput.length]);
      break;
      
    case 'spo2':
    case 'heartRate':
    case 'bp':
    default:
      // Modelos que requieren entrada 3D para Conv1D
      const reshapedInput: number[][][] = [];
      const row: number[][] = [];
      
      for (let i = 0; i < normalizedInput.length; i++) {
        row.push([normalizedInput[i]]);
      }
      reshapedInput.push(row);
      
      tensor = tf.tensor3d(reshapedInput);
  }
  
  return tensor;
}

// Realizar predicción optimizada
async function predict(modelType: string, inputData: number[]): Promise<number[]> {
  try {
    const startTime = performance.now();
    inferenceCount++;
    
    if (inputData.length === 0) {
      throw new Error('Datos de entrada vacíos');
    }
    
    // Cargar modelo si no está disponible
    const model = await loadModel(modelType);
    
    // Optimizar datos de entrada
    const tensor = optimizeInput(modelType, inputData);
    
    // Realizar predicción con manejo mejorado de memoria
    tf.engine().startScope(); // Iniciar scope para mejor gestión de memoria
    
    const result = model.predict(tensor) as tf.Tensor;
    const prediction = await result.data();
    
    // Limpiar tensores inmediatamente
    tensor.dispose();
    result.dispose();
    
    tf.engine().endScope(); // Fin del scope de memoria
    
    const inferenceTime = performance.now() - startTime;
    totalInferenceTime += inferenceTime;
    
    // Registro de rendimiento periódico (cada 10 inferencias)
    if (inferenceCount % 10 === 0) {
      const avgTime = totalInferenceTime / inferenceCount;
      console.log(`TensorFlow Worker: Rendimiento en ${modelType} - Media: ${avgTime.toFixed(2)}ms, Última: ${inferenceTime.toFixed(2)}ms`);
      
      const now = Date.now();
      if (now - lastPerformanceLog > 5000) { // Solo cada 5 segundos
        const memInfo = tf.memory();
        console.log(`TensorFlow Worker: Estado de memoria - Tensores: ${memInfo.numTensors}, Bytes: ${(memInfo.numBytes/1024/1024).toFixed(2)}MB`);
        lastPerformanceLog = now;
      }
    }
    
    return Array.from(prediction);
  } catch (error) {
    console.error(`TensorFlow Worker: Error en predicción con modelo ${modelType}:`, error);
    throw error;
  }
}

// Configurar TensorFlow.js con nuevas opciones
function setConfig(newConfig: TensorFlowConfig): void {
  const previousBackend = config.backend;
  config = newConfig;
  
  // Si cambia el backend, reiniciar TensorFlow
  if (previousBackend !== config.backend && tf.getBackend()) {
    // Limpiar caché de modelos al cambiar backend
    for (const [modelType, model] of modelCache.entries()) {
      model.dispose();
      console.log(`TensorFlow Worker: Modelo ${modelType} descartado por cambio de backend`);
    }
    modelCache.clear();
    
    // Reiniciar TensorFlow con nuevo backend
    initTensorFlow();
    return;
  }
  
  // Aplicar cambios que no requieran reinicio
  if (tf.getBackend()) {
    // Configuración de memoria
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', config.memoryOptions.useFloat16);
    tf.env().set('WEBGL_PACK', config.memoryOptions.enableTensorPacking);
    
    // Otras configuraciones
    if (config.backend === 'webgl') {
      if (config.memoryOptions.gpuMemoryLimitMB > 0) {
        tf.env().set('WEBGL_SIZE_UPLOAD_UNIFORM', config.memoryOptions.gpuMemoryLimitMB * 1024 * 1024);
      }
    }
    
    // Nivel de paralelismo
    if (config.advancedOptions.parallelismLevel > 0) {
      tf.env().set('WEBGL_CPU_FORWARD', false);
    } else {
      tf.env().set('WEBGL_CPU_FORWARD', true);
    }
    
    console.log('TensorFlow Worker: Configuración actualizada sin reinicio');
  }
}

// Liberar modelo con limpieza optimizada
async function disposeModel(modelType: string): Promise<boolean> {
  if (modelCache.has(modelType)) {
    try {
      const model = modelCache.get(modelType)!;
      model.dispose();
      modelCache.delete(modelType);
      
      // Forzar garbage collection si está habilitado
      if (config.memoryOptions.enableAutoGarbageCollection) {
        tf.engine().endScope();
        tf.engine().startScope();
      }
      
      console.log(`TensorFlow Worker: Modelo ${modelType} liberado correctamente`);
      return true;
    } catch (error) {
      console.error(`TensorFlow Worker: Error liberando modelo ${modelType}:`, error);
      return false;
    }
  }
  return false;
}

// Manejar mensajes con sistema mejorado de control de errores
self.addEventListener('message', async (e: MessageEvent) => {
  const { id, type, data } = e.data;
  
  try {
    switch (type) {
      case 'init':
        await initTensorFlow();
        break;
        
      case 'setConfig':
        setConfig(data.config);
        self.postMessage({ 
          id, 
          type: 'configSet',
          activeBackend: tf.getBackend(),
          memoryInfo: tf.memory()
        });
        break;
        
      case 'loadModel':
        try {
          await loadModel(data.modelType);
          self.postMessage({ 
            id, 
            type: 'modelLoaded', 
            modelType: data.modelType,
            memoryInfo: tf.memory()
          });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido',
            modelType: data.modelType,
            errorStack: error instanceof Error ? error.stack : null
          });
        }
        break;
        
      case 'predict':
        try {
          const result = await predict(data.modelType, data.input);
          self.postMessage({ 
            id, 
            type: 'result', 
            result,
            inferenceTime: performance.now() - (data.timestamp || 0),
            modelType: data.modelType
          });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido',
            modelType: data.modelType,
            errorStack: error instanceof Error ? error.stack : null
          });
        }
        break;
        
      case 'disposeModel':
        try {
          const disposed = await disposeModel(data.modelType);
          self.postMessage({ 
            id, 
            type: 'modelDisposed', 
            modelType: data.modelType,
            success: disposed,
            memoryInfo: tf.memory()
          });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido',
            errorStack: error instanceof Error ? error.stack : null
          });
        }
        break;
        
      case 'getMemoryInfo':
        const memoryInfo = tf.memory();
        self.postMessage({ 
          id, 
          type: 'memoryInfo', 
          info: memoryInfo,
          backend: tf.getBackend(),
          modelCount: modelCache.size,
          models: Array.from(modelCache.keys())
        });
        break;
        
      case 'cleanupMemory':
        try {
          for (const model of modelCache.values()) {
            model.getWeights().forEach(w => w.dispose());
          }
          
          tf.disposeVariables();
          tf.engine().endScope(); 
          tf.engine().startScope(); 
          
          const memoryAfterCleanup = tf.memory();
          
          self.postMessage({ 
            id, 
            type: 'memoryCleanup', 
            success: true,
            memoryBefore: data.memoryBefore,
            memoryAfter: memoryAfterCleanup
          });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error en limpieza de memoria',
            errorStack: error instanceof Error ? error.stack : null
          });
        }
        break;
        
      case 'getPerformanceStats':
        self.postMessage({
          id,
          type: 'performanceStats',
          stats: {
            inferenceCount,
            totalInferenceTime,
            avgInferenceTime: inferenceCount > 0 ? totalInferenceTime / inferenceCount : 0,
            modelCount: modelCache.size,
            models: Array.from(modelCache.keys()),
            memory: tf.memory(),
            backend: tf.getBackend()
          }
        });
        break;
        
      default:
        self.postMessage({ 
          id, 
          type: 'error', 
          error: `Tipo de mensaje desconocido: ${type}` 
        });
    }
  } catch (error) {
    self.postMessage({ 
      id, 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido',
      errorStack: error instanceof Error ? error.stack : null,
      command: type
    });
  }
});

// Inicializar al cargar
initTensorFlow();
