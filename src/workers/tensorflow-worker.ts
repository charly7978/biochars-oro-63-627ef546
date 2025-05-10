/**
 * Worker para TensorFlow.js
 * Permite ejecutar inferencias en un thread separado
 */

import * as tf from '@tensorflow/tfjs';

// Configuración inicial
let models: Record<string, tf.LayersModel> = {};
let isInitializing = false;
let tfBackend = 'cpu';
let modelDir = '/models/';

// Inicializar TensorFlow en worker
async function initTensorFlow(backend: string) {
  if (isInitializing) return;
  isInitializing = true;
  
  try {
    console.log(`[TF Worker] Inicializando TensorFlow con backend: ${backend}`);
    await tf.setBackend(backend);
    await tf.ready();
    tfBackend = tf.getBackend();
    console.log(`[TF Worker] TensorFlow inicializado con backend: ${tfBackend}`);
    // Configurar flags para rendimiento
    if (tfBackend === 'webgl') {
      // Nota: No podemos acceder a getGPGPUContext directamente
      // Configuramos las optimizaciones de entorno en su lugar
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
      console.log("[TF Worker] WebGL habilitado para TensorFlow con optimizaciones");
    }
  } catch (error) {
    console.error('[TF Worker] Error inicializando TensorFlow:', error);
    // Intentar fallback a CPU
    if (backend !== 'cpu') {
      console.log('[TF Worker] Intentando fallback a CPU');
      await initTensorFlow('cpu');
    }
  } finally {
    isInitializing = false;
  }
}

// Cargar modelo
async function loadModel(modelType: string): Promise<tf.LayersModel> {
  if (modelType === 'vital-signs-ppg') {
    console.warn(`[TF Worker] Carga del modelo '${modelType}' está deshabilitada intencionalmente.`);
    throw new Error(`Carga del modelo '${modelType}' deshabilitada intencionalmente en el worker.`);
  }

  if (models[modelType]) {
    return models[modelType];
  }
  
  try {
    const modelPath = `${modelDir}${modelType}/model.json`;
    console.log(`[TF Worker] Cargando modelo: ${modelPath}`);
    const model = await tf.loadLayersModel(modelPath);
    models[modelType] = model;
    console.log(`[TF Worker] Modelo ${modelType} cargado correctamente`);
    return model;
  } catch (error) {
    console.error(`[TF Worker] Error cargando modelo ${modelType}:`, error);
    throw error;
  }
}

// Realizar predicción
async function predict(modelType: string, input: number[]): Promise<number[]> {
  try {
    const model = await loadModel(modelType);
    const tensor = tf.tensor2d([input]);
    
    const outputTensor = model.predict(tensor) as tf.Tensor;
    const outputData = await outputTensor.data();
    const outputArray = Array.from(outputData);
    
    // Limpiar recursos
    tensor.dispose();
    outputTensor.dispose();
    
    return outputArray;
  } catch (error) {
    console.error(`[TF Worker] Error en predicción con modelo ${modelType}:`, error);
    throw error;
  }
}

// Liberar modelo de memoria
async function disposeModel(modelType: string): Promise<void> {
  if (models[modelType]) {
    models[modelType].dispose();
    delete models[modelType];
    console.log(`[TF Worker] Modelo ${modelType} liberado`);
  }
}

// Obtener información de memoria
async function getMemoryInfo(): Promise<tf.MemoryInfo> {
  return tf.memory();
}

// Limpiar memoria
async function cleanupMemory(): Promise<void> {
  try {
    const beforeMemory = tf.memory();
    console.log('[TF Worker] Memoria antes de limpieza:', beforeMemory.numBytes, 'bytes');
    
    // Limpiar variables no referenciadas
    tf.tidy(() => {});
    
    // Forzar recolección de basura
    const afterMemory = tf.memory();
    console.log('[TF Worker] Memoria después de limpieza:', afterMemory.numBytes, 'bytes');
    console.log('[TF Worker] Memoria liberada:', beforeMemory.numBytes - afterMemory.numBytes, 'bytes');
  } catch (error) {
    console.error('[TF Worker] Error limpiando memoria:', error);
  }
}

// Register all TensorFlow ops manually instead of using the import
function registerAllOps() {
  // This is a simplified approach, since we can't import the register_all_ops module
  // TensorFlow.js will register the necessary ops when used
  console.log('[TF Worker] Registering TensorFlow ops manually');
}

// Call the function to register ops
registerAllOps();

// Escuchar mensajes
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  try {
    let result;
    
    switch (type) {
      case 'init':
        await initTensorFlow(data.backend || 'webgl');
        result = { success: true, backend: tfBackend };
        break;
        
      case 'load':
        await loadModel(data.modelType);
        result = { success: true, modelType: data.modelType };
        break;
        
      case 'predict':
        const prediction = await predict(data.modelType, data.input);
        result = { success: true, prediction };
        break;
        
      case 'dispose':
        await disposeModel(data.modelType);
        result = { success: true };
        break;
        
      case 'memory':
        const memoryInfo = await getMemoryInfo();
        result = { success: true, memoryInfo };
        break;
        
      case 'cleanup':
        await cleanupMemory();
        result = { success: true };
        break;
        
      default:
        throw new Error(`Comando desconocido: ${type}`);
    }
    
    self.postMessage({ type: `${type}_response`, data: result });
  } catch (error) {
    console.error(`[TF Worker] Error procesando comando ${type}:`, error);
    self.postMessage({ 
      type: `${type}_error`, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Inicializar automáticamente
initTensorFlow('webgl').catch(console.error);

// Notificar que el worker está listo
self.postMessage({ type: 'ready' });
