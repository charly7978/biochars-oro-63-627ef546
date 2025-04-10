
import * as tf from '@tensorflow/tfjs';

// Configurar mensaje de inicialización
self.postMessage({ type: 'init', status: 'starting' });

// Configurar TensorFlow para rendimiento óptimo
async function setupTensorFlow() {
  try {
    // Intentar usar WebGL primero para GPU
    await tf.setBackend('webgl');
    
    // Configurar optimizaciones
    tf.env().set('WEBGL_CPU_FORWARD', false);
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    
    // Informar sobre el backend y dispositivo
    const backend = tf.getBackend();
    let deviceInfo = 'generic';
    
    if (backend === 'webgl') {
      const gl = (tf.backend() as any).gpgpu.gl;
      deviceInfo = gl.getParameter(gl.RENDERER);
    }
    
    self.postMessage({ 
      type: 'init', 
      status: 'ready', 
      backend,
      deviceInfo
    });
  } catch (error) {
    console.error('Error setupTensorFlow:', error);
    
    // Intentar fallback a CPU
    try {
      await tf.setBackend('cpu');
      self.postMessage({ 
        type: 'init', 
        status: 'ready', 
        backend: 'cpu',
        deviceInfo: 'CPU fallback'
      });
    } catch (fallbackError) {
      self.postMessage({ 
        type: 'init', 
        status: 'error', 
        error: String(fallbackError)
      });
    }
  }
}

// Inicializar TensorFlow
setupTensorFlow().catch(error => {
  self.postMessage({ 
    type: 'init', 
    status: 'error', 
    error: String(error) 
  });
});

// Caché de modelos
const modelCache = new Map<string, tf.LayersModel>();

// Cargar modelo pre-entrenado o crear desde cero
async function loadModel(modelType: string): Promise<tf.LayersModel> {
  if (modelCache.has(modelType)) {
    return modelCache.get(modelType)!;
  }
  
  let model: tf.LayersModel;
  
  try {
    // Intentar cargar desde IndexedDB
    model = await tf.loadLayersModel(`indexeddb://${modelType}-model`);
    console.log(`Modelo ${modelType} cargado desde IndexedDB`);
  } catch (error) {
    console.log(`Modelo ${modelType} no encontrado en IndexedDB, creando nuevo modelo`);
    
    // Si no se puede cargar, crear modelo desde cero
    model = createModel(modelType);
    
    // Guardar el modelo en IndexedDB para próximas cargas
    await model.save(`indexeddb://${modelType}-model`);
  }
  
  modelCache.set(modelType, model);
  return model;
}

// Crear modelo según tipo
function createModel(modelType: string): tf.LayersModel {
  switch (modelType) {
    case 'heartRate':
      return createHeartRateModel();
    case 'spo2':
      return createSpO2Model();
    case 'bloodPressure':
      return createBloodPressureModel();
    case 'arrhythmia':
      return createArrhythmiaModel();
    default:
      throw new Error(`Tipo de modelo desconocido: ${modelType}`);
  }
}

// Crear modelo de frecuencia cardíaca
function createHeartRateModel(): tf.LayersModel {
  const input = tf.input({shape: [300, 1]});
  
  // Primera capa convolucional
  let x = tf.layers.conv1d({
    filters: 16,
    kernelSize: 9,
    activation: 'relu',
    padding: 'same'
  }).apply(input);
  
  x = tf.layers.batchNormalization().apply(x);
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  
  // Segunda capa convolucional
  x = tf.layers.conv1d({
    filters: 32,
    kernelSize: 7,
    activation: 'relu',
    padding: 'same'
  }).apply(x);
  
  x = tf.layers.batchNormalization().apply(x);
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  
  // Capas densas finales
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dense({units: 64, activation: 'relu'}).apply(x);
  x = tf.layers.dropout({rate: 0.2}).apply(x);
  x = tf.layers.dense({units: 32, activation: 'relu'}).apply(x);
  const output = tf.layers.dense({units: 1, activation: 'linear'}).apply(x);
  
  // Crear y compilar modelo
  const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae']
  });
  
  return model;
}

// Crear modelo de SpO2
function createSpO2Model(): tf.LayersModel {
  // Implementación simplificada para ejemplo
  const input = tf.input({shape: [300, 1]});
  
  let x = tf.layers.conv1d({
    filters: 16,
    kernelSize: 7,
    activation: 'relu',
    padding: 'same'
  }).apply(input);
  
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dense({units: 32, activation: 'relu'}).apply(x);
  const output = tf.layers.dense({units: 1, activation: 'sigmoid'}).apply(x);
  
  const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });
  
  return model;
}

// Crear modelo de presión arterial
function createBloodPressureModel(): tf.LayersModel {
  // Implementación simplificada para ejemplo
  const input = tf.input({shape: [300, 1]});
  
  let x = tf.layers.conv1d({
    filters: 16,
    kernelSize: 9,
    activation: 'relu',
    padding: 'same'
  }).apply(input);
  
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dense({units: 32, activation: 'relu'}).apply(x);
  const output = tf.layers.dense({units: 2, activation: 'linear'}).apply(x);
  
  const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });
  
  return model;
}

// Crear modelo de arritmia
function createArrhythmiaModel(): tf.LayersModel {
  // Implementación simplificada para ejemplo
  const input = tf.input({shape: [300, 1]});
  
  let x = tf.layers.conv1d({
    filters: 16,
    kernelSize: 9,
    activation: 'relu',
    padding: 'same'
  }).apply(input);
  
  x = tf.layers.maxPooling1d({poolSize: 2}).apply(x);
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dense({units: 32, activation: 'relu'}).apply(x);
  const output = tf.layers.dense({units: 1, activation: 'sigmoid'}).apply(x);
  
  const model = tf.model({inputs: input, outputs: output as tf.SymbolicTensor});
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy'
  });
  
  return model;
}

// Preprocesar la entrada para modelos
function preprocessInput(input: number[]): tf.Tensor {
  // Ajustar longitud
  const targetLength = 300;
  let adjustedInput: number[];
  
  if (input.length < targetLength) {
    const padding = Array(targetLength - input.length).fill(0);
    adjustedInput = [...input, ...padding];
  } else if (input.length > targetLength) {
    adjustedInput = input.slice(-targetLength);
  } else {
    adjustedInput = input;
  }
  
  // Convertir a tensor y normalizar
  const tensor = tf.tensor1d(adjustedInput);
  
  // Normalizar a media 0, std 1
  const mean = tensor.mean();
  const std = tensor.sub(mean).square().mean().sqrt();
  const normalized = tensor.sub(mean).div(std.add(tf.scalar(1e-5)));
  
  // Añadir dimensiones para batch y canal
  const reshaped = normalized.expandDims(0).expandDims(-1);
  
  // Limpiar tensores intermedios
  tensor.dispose();
  mean.dispose();
  std.dispose();
  normalized.dispose();
  
  return reshaped;
}

// Procesar mensaje
self.addEventListener('message', async (e) => {
  const { id, type, data } = e.data;
  
  switch (type) {
    case 'predict': {
      try {
        const { modelType, input } = data;
        
        // Cargar modelo
        const model = await loadModel(modelType);
        
        // Preprocesar entrada
        const tensor = preprocessInput(input);
        
        // Ejecutar predicción
        const startTime = performance.now();
        const prediction = model.predict(tensor) as tf.Tensor;
        const result = await prediction.data();
        const endTime = performance.now();
        
        // Liberar tensores
        tensor.dispose();
        prediction.dispose();
        
        // Aplicar post-procesamiento según tipo de modelo
        let processedResult: number[];
        
        switch (modelType) {
          case 'heartRate':
            // Limitar a rango fisiológico
            processedResult = [Math.max(40, Math.min(200, result[0]))];
            break;
          case 'spo2':
            // Convertir de [0,1] a [90,100]
            processedResult = [90 + (result[0] * 10)];
            break;
          case 'bloodPressure':
            // [systolic, diastolic]
            processedResult = [
              Math.max(90, Math.min(180, result[0])),
              Math.max(60, Math.min(110, result[1]))
            ];
            break;
          case 'arrhythmia':
            // Probabilidad [0,1]
            processedResult = [result[0]];
            break;
          default:
            processedResult = Array.from(result);
        }
        
        // Enviar resultado
        self.postMessage({
          id,
          type: 'result',
          modelType,
          result: processedResult,
          processingTime: endTime - startTime
        });
      } catch (error) {
        console.error('Error al predecir:', error);
        self.postMessage({
          id,
          type: 'error',
          modelType: data.modelType,
          error: String(error)
        });
      }
      break;
    }
    
    case 'loadModel': {
      try {
        const { modelType } = data;
        await loadModel(modelType);
        self.postMessage({
          id,
          type: 'modelLoaded',
          modelType
        });
      } catch (error) {
        console.error('Error al cargar modelo:', error);
        self.postMessage({
          id,
          type: 'error',
          modelType: data.modelType,
          error: String(error)
        });
      }
      break;
    }
    
    case 'disposeModel': {
      try {
        const { modelType } = data;
        const model = modelCache.get(modelType);
        if (model) {
          model.dispose();
          modelCache.delete(modelType);
        }
        self.postMessage({
          id,
          type: 'modelDisposed',
          modelType
        });
      } catch (error) {
        console.error('Error al liberar modelo:', error);
        self.postMessage({
          id,
          type: 'error',
          error: String(error)
        });
      }
      break;
    }
    
    default:
      self.postMessage({
        id,
        type: 'error',
        error: `Tipo de mensaje desconocido: ${type}`
      });
  }
});

// Limpiar en unload
self.addEventListener('unload', () => {
  // Liberar todos los modelos
  modelCache.forEach(model => {
    model.dispose();
  });
  modelCache.clear();
  
  // Liberar memoria TensorFlow
  tf.disposeVariables();
});
