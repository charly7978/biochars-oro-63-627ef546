/**
 * Web Worker para procesamiento con TensorFlow.js
 * Ejecuta inferencia de modelos en segundo plano
 */
import * as tf from '@tensorflow/tfjs';
import { TensorFlowConfig, DEFAULT_TENSORFLOW_CONFIG } from '../core/neural/tensorflow/TensorFlowConfig';

// Configuración actual
let config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG;

// Caché de modelos
const modelCache = new Map<string, tf.LayersModel>();

// Inicializar TensorFlow.js
async function initTensorFlow() {
  try {
    // Intentar usar el backend configurado
    await tf.setBackend(config.backend);
    
    // Aplicar configuraciones de memoria
    if (config.memoryOptions.useFloat16) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    }
    
    if (config.memoryOptions.enableTensorPacking) {
      tf.env().set('WEBGL_PACK', true);
    }
    
    console.log(`TensorFlow Worker: Inicializado con backend ${tf.getBackend()}`);
    
    self.postMessage({ type: 'init', status: 'ready', backend: tf.getBackend() });
  } catch (error) {
    console.error('TensorFlow Worker: Error inicializando TensorFlow.js:', error);
    self.postMessage({ 
      type: 'init', 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
    
    // Intentar fallback a CPU
    try {
      await tf.setBackend('cpu');
      console.log('TensorFlow Worker: Fallback a CPU exitoso');
      self.postMessage({ type: 'init', status: 'ready', backend: 'cpu' });
    } catch (fbError) {
      console.error('TensorFlow Worker: Error en fallback a CPU:', fbError);
    }
  }
}

// Cargar un modelo
async function loadModel(modelType: string): Promise<tf.LayersModel> {
  // Si ya está en caché, devolverlo
  if (modelCache.has(modelType)) {
    return modelCache.get(modelType)!;
  }
  
  try {
    console.log(`TensorFlow Worker: Cargando modelo ${modelType}`);
    
    // Intentar cargar desde IndexedDB
    const model = await tf.loadLayersModel(`indexeddb://${modelType}-model`)
      .catch(() => null);
    
    if (model) {
      console.log(`TensorFlow Worker: Modelo ${modelType} cargado desde IndexedDB`);
      modelCache.set(modelType, model);
      return model;
    }
    
    // Si no se encontró el modelo en IndexedDB, lanzar un error.
    throw new Error(`Modelo ${modelType} no encontrado en IndexedDB y no se creará un fallback.`);

  } catch (error) {
    console.error(`TensorFlow Worker: Error cargando modelo ${modelType}:`, error);
    // Re-throw the error to signal failure without fallback
    throw error;
  }
}

// Realizar predicción
async function predict(modelType: string, inputData: number[]): Promise<number[]> {
  try {
    const model = await loadModel(modelType);
    
    // Preparar input según tipo de modelo
    let tensor;
    if (modelType === 'arrhythmia') {
      // Para modelos que requieren entrada 2D
      tensor = tf.tensor2d([inputData], [1, inputData.length]);
    } else {
      // Para modelos convolucionales que requieren entrada 3D
      const reshapedInput: number[][][] = [];
      const row: number[][] = [];
      
      // Crear estructura 3D adecuada: [1, inputData.length, 1]
      for (let i = 0; i < inputData.length; i++) {
        row.push([inputData[i]]);
      }
      reshapedInput.push(row);
      
      tensor = tf.tensor3d(reshapedInput);
    }
    
    // Realizar predicción
    const result = model.predict(tensor) as tf.Tensor;
    const prediction = await result.data();
    
    // Limpiar tensores
    tensor.dispose();
    result.dispose();
    
    return Array.from(prediction);
  } catch (error) {
    console.error(`TensorFlow Worker: Error en predicción con modelo ${modelType}:`, error);
    throw error;
  }
}

// Configurar TensorFlow.js
function setConfig(newConfig: TensorFlowConfig): void {
  config = newConfig;
  
  // Aplicar cambios que no requieran reinicio
  if (tf.getBackend()) {
    if (config.memoryOptions.useFloat16) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    } else {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
    }
    
    if (config.memoryOptions.enableTensorPacking) {
      tf.env().set('WEBGL_PACK', true);
    } else {
      tf.env().set('WEBGL_PACK', false);
    }
  }
}

// Liberar modelo
async function disposeModel(modelType: string): Promise<boolean> {
  if (modelCache.has(modelType)) {
    const model = modelCache.get(modelType)!;
    model.dispose();
    modelCache.delete(modelType);
    return true;
  }
  return false;
}

// Manejar mensajes
self.addEventListener('message', async (e: MessageEvent) => {
  const { id, type, data } = e.data;
  
  try {
    switch (type) {
      case 'init':
        await initTensorFlow();
        break;
        
      case 'setConfig':
        setConfig(data.config);
        self.postMessage({ id, type: 'configSet' });
        break;
        
      case 'loadModel':
        try {
          await loadModel(data.modelType);
          self.postMessage({ id, type: 'modelLoaded', modelType: data.modelType });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido',
            modelType: data.modelType
          });
        }
        break;
        
      case 'predict':
        try {
          const result = await predict(data.modelType, data.input);
          self.postMessage({ id, type: 'result', result });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido' 
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
            success: disposed
          });
        } catch (error) {
          self.postMessage({ 
            id, 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Error desconocido' 
          });
        }
        break;
        
      case 'getMemoryInfo':
        const memoryInfo = tf.memory();
        self.postMessage({ id, type: 'memoryInfo', info: memoryInfo });
        break;
        
      case 'cleanupMemory':
        tf.disposeVariables();
        tf.engine().startScope(); // Start fresh scope
        self.postMessage({ id, type: 'memoryCleanup', success: true });
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
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

// Inicializar al cargar
initTensorFlow();
