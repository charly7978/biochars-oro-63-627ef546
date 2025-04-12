/**
 * Web Worker para procesamiento con TensorFlow.js
 * Ejecuta inferencia de modelos en segundo plano
 */
import * as tf from '@tensorflow/tfjs';
import { TensorFlowConfig, DEFAULT_TENSORFLOW_CONFIG } from '../core/neural/tensorflow/TensorFlowConfig';
import { TensorUtils as TensorAdapter } from '../core/neural/tensorflow/TensorAdapter'; // Renombrado para claridad

// Mapa para almacenar los modelos cargados
const loadedModels = new Map<string, tf.LayersModel>();
let currentConfig: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG;

console.log('TensorFlow Worker: Initializing...');

// --- Inicialización de TensorFlow ---
async function initTensorFlow() {
    console.log('TensorFlow Worker: Setting backend:', currentConfig.backend);
    try {
        await tf.setBackend(currentConfig.backend);
        await tf.ready();
        console.log(`TensorFlow Worker: Backend set to ${tf.getBackend()}. Ready.`);

        // Aplicar configuraciones de memoria y avanzadas
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', currentConfig.memoryOptions.useFloat16);
        tf.env().set('WEBGL_PACK', currentConfig.memoryOptions.enableTensorPacking);
        if (currentConfig.memoryOptions.gpuMemoryLimitMB > 0 && (currentConfig.backend === 'webgl' || currentConfig.backend === 'webgpu')) {
            // Nota: La limitación directa de memoria no es una API estándar de TFJS.
            // Se pueden necesitar workarounds o simplemente monitorear el uso.
             console.warn(`TensorFlow Worker: GPU Memory Limit (${currentConfig.memoryOptions.gpuMemoryLimitMB}MB) is indicative, direct limiting not standard.`);
        }
         if (currentConfig.advancedOptions.parallelismLevel > 0) {
             // Nota: El paralelismo a nivel de TFJS suele ser gestionado por el backend.
             console.warn(`TensorFlow Worker: Parallelism level (${currentConfig.advancedOptions.parallelismLevel}) suggestion noted, backend handles actual parallelism.`);
         }
         if (currentConfig.advancedOptions.enableDebugMode) {
            tf.enableDebugMode();
            console.log("TensorFlow Worker: Debug mode enabled.");
         }

        postMessage({ type: 'initComplete', success: true });
    } catch (error) {
        console.error('TensorFlow Worker: Backend initialization failed:', error);
        postMessage({ type: 'initComplete', success: false, error: error.message });
        // Intentar con CPU como último recurso si falla el backend preferido
        if (currentConfig.backend !== 'cpu') {
            console.log('TensorFlow Worker: Trying CPU backend as fallback...');
            currentConfig.backend = 'cpu';
            await initTensorFlow(); // Reintentar con CPU
        }
    }
}

// --- Carga de Modelos ---
async function loadModel(modelType: string): Promise<tf.LayersModel | null> {
    if (loadedModels.has(modelType)) {
        console.log(`TensorFlow Worker: Model ${modelType} already loaded.`);
        return loadedModels.get(modelType)!;
    }

    // TODO: Implementar lógica real de carga de modelos
    // Esto debería cargar modelos pre-entrenados desde una URL o almacenamiento local.
    // La URL podría depender del modelType.
    const modelUrl = `/models/${modelType}/model.json`; // Ejemplo de ruta
    console.log(`TensorFlow Worker: Loading model ${modelType} from ${modelUrl}...`);

    try {
        // tf.loadGraphModel es generalmente para modelos convertidos desde TF/Keras SavedModel
        // tf.loadLayersModel es para modelos guardados en formato Keras JSON
        const model = await tf.loadLayersModel(modelUrl, {
             strict: true, // Asegura que los pesos coincidan con la arquitectura
             // Considerar requestInit para caché si el servidor lo soporta
             // requestInit: { cache: 'force-cache' } // Si se usa caché del navegador
        });
        console.log(`TensorFlow Worker: Model ${modelType} loaded successfully.`);
        loadedModels.set(modelType, model);
        return model;
    } catch (error) {
        console.error(`TensorFlow Worker: Failed to load real model ${modelType} from ${modelUrl}:`, error);
        // Propagar el error al cliente, no crear fallback
        throw new Error(`Failed to load model ${modelType}: ${error.message}`);
    }
}

// --- Predicción ---
async function predict(modelType: string, inputData: number[]): Promise<number[]> {
    let model = loadedModels.get(modelType);

    if (!model) {
        console.log(`TensorFlow Worker: Model ${modelType} not loaded. Attempting to load...`);
        model = await loadModel(modelType);
        if (!model) {
             // Si loadModel ahora lanza error, esto podría no alcanzarse, pero es seguro mantenerlo
             console.error(`TensorFlow Worker: Prediction failed, model ${modelType} could not be loaded.`);
             throw new Error(`Prediction failed: Model ${modelType} could not be loaded.`);
        }
    }

    console.log(`TensorFlow Worker: Predicting with model ${modelType}...`);
    const startTime = performance.now();

    try {
        // Preprocesamiento: Adaptar según las necesidades del modelo REAL
        // El tamaño de entrada debe coincidir con lo esperado por el modelo cargado.
        // Obtener inputShape del modelo cargado si es necesario para el preprocesamiento.
        const inputShape = model.inputs[0].shape; // ej: [null, 100, 1] -> necesitamos 100
        const requiredInputLength = inputShape.length > 1 ? inputShape[1] : 100; // Asume que la longitud está en la segunda dimensión

        let inputTensor: tf.Tensor;
        // Adaptar preprocesamiento según el tipo de modelo o su arquitectura
        if (model.layers.some(layer => layer.getClassName().includes('Conv1D'))) {
             inputTensor = TensorAdapter.preprocessForConv1D(inputData, requiredInputLength || 128); // Usar longitud requerida
        } else {
            inputTensor = TensorAdapter.preprocessForTensorFlow(inputData, requiredInputLength || 100); // Usar longitud requerida
        }

        // Realizar predicción
        const prediction = model.predict(inputTensor) as tf.Tensor;
        const outputData = await prediction.data();

        // Limpieza de tensores
        inputTensor.dispose();
        prediction.dispose();

        const endTime = performance.now();
        console.log(`TensorFlow Worker: Prediction for ${modelType} took ${(endTime - startTime).toFixed(2)} ms.`);

        // Asegurarse de devolver un Array<number>
        return Array.from(outputData);
    } catch (error) {
        console.error(`TensorFlow Worker: Prediction failed for model ${modelType}:`, error);
        // Ya no intenta usar fallback, simplemente lanza el error
        throw new Error(`Prediction failed for model ${modelType}: ${error.message}`);
    }
}

// --- Gestión de Configuración ---
function setConfig(newConfig: TensorFlowConfig): void {
    console.log('TensorFlow Worker: Updating configuration...');
    // Fusionar la nueva configuración con la existente o por defecto
     currentConfig = {
        ...DEFAULT_TENSORFLOW_CONFIG, // Empezar con los defaults
        ...currentConfig, // Sobrescribir con la actual
        ...newConfig, // Sobrescribir con la nueva parcial
        // Asegurar que los objetos anidados se fusionen correctamente
        memoryOptions: {
            ...DEFAULT_TENSORFLOW_CONFIG.memoryOptions,
            ...currentConfig.memoryOptions,
            ...newConfig.memoryOptions,
        },
        cacheOptions: {
             ...DEFAULT_TENSORFLOW_CONFIG.cacheOptions,
             ...currentConfig.cacheOptions,
             ...newConfig.cacheOptions,
        },
        loadOptions: {
            ...DEFAULT_TENSORFLOW_CONFIG.loadOptions,
            ...currentConfig.loadOptions,
            ...newConfig.loadOptions,
        },
        calibrationOptions: {
             ...DEFAULT_TENSORFLOW_CONFIG.calibrationOptions,
             ...currentConfig.calibrationOptions,
             ...newConfig.calibrationOptions,
        },
         advancedOptions: {
            ...DEFAULT_TENSORFLOW_CONFIG.advancedOptions,
            ...currentConfig.advancedOptions,
            ...newConfig.advancedOptions,
         }
    };
    console.log('TensorFlow Worker: Configuration updated:', currentConfig);
    // Re-inicializar TF si el backend cambió? Podría ser disruptivo.
    // Por ahora, solo actualiza la config. El backend se aplica en initTensorFlow.
}

// --- Limpieza ---
async function disposeModel(modelType: string): Promise<boolean> {
    const model = loadedModels.get(modelType);
    if (model) {
        console.log(`TensorFlow Worker: Disposing model ${modelType}...`);
        model.dispose();
        loadedModels.delete(modelType);
        console.log(`TensorFlow Worker: Model ${modelType} disposed.`);
        return true;
    } else {
        console.log(`TensorFlow Worker: Model ${modelType} not found for disposal.`);
        return false;
    }
}

async function cleanupMemory() {
     console.log('TensorFlow Worker: Cleaning up memory (disposing all models)...');
     loadedModels.forEach((model, key) => {
         model.dispose();
         console.log(`TensorFlow Worker: Disposed model ${key}`);
     });
     loadedModels.clear();
     tf.disposeVariables(); // Eliminar variables globales si las hubiera
     console.log('TensorFlow Worker: All models disposed.');
}

// --- Manejador de Mensajes ---
self.onmessage = async (e: MessageEvent) => {
    const { type, id, data } = e.data;
    console.log('TensorFlow Worker: Received message:', type, 'ID:', id);

    try {
        switch (type) {
            case 'init':
                setConfig(data.config || DEFAULT_TENSORFLOW_CONFIG); // Establecer config antes de inicializar
                await initTensorFlow();
                // La respuesta se envía dentro de initTensorFlow
                break;
            case 'setConfig':
                 setConfig(data.config);
                 postMessage({ type: 'setConfigComplete', id, success: true });
                 break;
            case 'loadModel':
                await loadModel(data.modelType);
                postMessage({ type: 'loadComplete', id, success: true, modelType: data.modelType });
                break;
            case 'predict':
                const result = await predict(data.modelType, data.input);
                postMessage({ type: 'predictComplete', id, result });
                break;
            case 'disposeModel':
                await disposeModel(data.modelType);
                postMessage({ type: 'disposeComplete', id, success: true, modelType: data.modelType });
                break;
             case 'cleanupMemory':
                 await cleanupMemory();
                 postMessage({ type: 'cleanupComplete', id, success: true });
                 break;
             case 'getMemoryInfo':
                  const memoryInfo = tf.memory();
                  postMessage({ type: 'memoryInfo', id, memoryInfo });
                  break;

            default:
                console.warn('TensorFlow Worker: Unknown message type:', type);
                 postMessage({ type: 'error', id, error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        console.error('TensorFlow Worker: Error processing message:', type, 'ID:', id, error);
        postMessage({ type: 'error', id, error: error.message || 'Unknown worker error', modelType: data?.modelType });
    }
};

// Indicar que el worker está listo para recibir mensajes (opcional)
console.log('TensorFlow Worker: Ready for messages.');
postMessage({ type: 'workerReady' });
