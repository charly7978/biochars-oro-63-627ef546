import * as tf from '@tensorflow/tfjs';
import {
  BaseNeuralModel,
  Tensor1D,
  // Tensor2D, // No longer needed directly here if using TFJS model
  // Conv1DLayer, // Removed
  // BatchNormLayer, // Removed
  // Pooling1DLayer, // Removed
  // ResidualBlock, // Removed
  // LSTMLayer, // Removed
  // DenseLayer // Removed
} from './NeuralNetworkBase'; // Mantener importaciones si BaseNeuralModel las usa

// Configuración específica del modelo BP
const BP_MODEL_CONFIG = {
  name: 'BloodPressureEstimator',
  version: '1.1.0-tfjs', // Versión indicando que usa TFJS
  expectedInputShape: [128, 1], // Ejemplo: secuencia de 128 puntos, 1 canal
  modelUrl: '/models/bloodPressure/model.json' // Ruta al modelo TFJS
};

/**
 * Modelo neuronal para estimar presión arterial (sistólica y diastólica)
 * utilizando TensorFlow.js.
 */
export class BloodPressureNeuralModel extends BaseNeuralModel {
  
  constructor() {
    super(
      BP_MODEL_CONFIG.name,
      BP_MODEL_CONFIG.expectedInputShape,
      BP_MODEL_CONFIG.version
    );
    // Iniciar la carga del modelo automáticamente
    this.loadModel(BP_MODEL_CONFIG.modelUrl).catch(err => {
      console.error("Initial Blood Pressure model load failed:", err)
    });
  }

  /**
   * Predice los valores de presión sistólica y diastólica.
   * @param ppgSignal Array numérico representando la señal PPG.
   * @returns Un array con [systolic, diastolic] o null si falla.
   */
  public predict(ppgSignal: Tensor1D): Tensor1D | null {
    if (!this.isLoaded()) {
      console.warn("Blood Pressure model not loaded yet.");
      return null;
    }
    // Llama al método predict de la clase base que usa TFJS
    const result = super.predict(ppgSignal);
    
    if (result && result.length === 2) {
        // Post-procesamiento si es necesario (ej. asegurar SBP > DBP)
        // const [systolic, diastolic] = result;
        // if (systolic <= diastolic) { return null; /* Predicción inválida */ }
        return result;
    } else {
        console.error("BP model prediction did not return expected [systolic, diastolic] format.");
        return null;
    }
  }
  
  // --- Métodos Anteriores de Cálculo Manual --- 
  // Estos métodos (preprocessInput, bandpassFilter, findMinMax, etc.) 
  // ya no son necesarios aquí si el modelo TFJS cargado maneja 
  // internamente el preprocesamiento o si se realiza antes de llamar a predict.
  // Los dejo comentados por si alguna lógica de preprocesamiento 
  // debe realizarse *antes* de pasar los datos al modelo TFJS.
  /*
  private preprocessInput(input: Tensor1D): Tensor1D { ... }
  private bandpassFilter(signal: Tensor1D): Tensor1D { ... }
  private findMinMax(array: Tensor1D): { min: number; max: number } { ... }
  private globalAveragePooling(features: Tensor1D[]): Tensor1D { ... }
  */
  
  // Los getters parameterCount y architecture ahora provienen de BaseNeuralModel.
}
